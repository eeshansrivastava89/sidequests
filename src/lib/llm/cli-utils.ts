import { spawn } from "child_process";

export interface CliRunOptions {
  command: string;
  args: string[];
  /** Data to pipe via stdin. If undefined, stdin is closed immediately. */
  stdinData?: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface CliRunResult {
  stdout: string;
  stderr: string;
}

/**
 * Spawn a CLI process with proper timeout, abort handling, and env cleanup.
 *
 * Always strips CLAUDECODE / CLAUDE_CODE_ENTRYPOINT from the child env
 * to prevent nested-session issues when running inside Claude Code.
 *
 * Resolves with { stdout, stderr } on exit code 0.
 * Rejects on non-zero exit, timeout, or abort.
 */
export function runCli(options: CliRunOptions): Promise<CliRunResult> {
  const { command, args, stdinData, timeoutMs, signal } = options;

  if (signal?.aborted) return Promise.reject(new Error("Aborted"));

  return new Promise((resolve, reject) => {
    const cleanEnv = { ...process.env };
    delete cleanEnv.CLAUDECODE;
    delete cleanEnv.CLAUDE_CODE_ENTRYPOINT;

    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: cleanEnv,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (abortHandler) signal?.removeEventListener("abort", abortHandler);
      fn();
    };

    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      child.kill();
      settle(() => reject(new Error(`${command} CLI timed out after ${timeoutMs / 1000}s`)));
    }, timeoutMs);

    const abortHandler = signal
      ? () => {
          child.kill();
          settle(() => reject(new Error("Aborted")));
        }
      : undefined;
    if (abortHandler) signal!.addEventListener("abort", abortHandler);

    child.on("error", (err) => settle(() => reject(err)));
    child.on("close", (code) =>
      settle(() => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(`${command} exited ${code}: ${stderr || stdout}`));
      }),
    );

    if (stdinData !== undefined) {
      child.stdin.write(stdinData);
    }
    child.stdin.end();
  });
}
