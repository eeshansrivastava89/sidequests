import { describe, it, expect } from "vitest";
import { runCli } from "../cli-utils";

describe("runCli", () => {
  it("captures stdout from a simple command", async () => {
    const result = await runCli({
      command: "echo",
      args: ["hello world"],
      timeoutMs: 5_000,
    });
    expect(result.stdout.trim()).toBe("hello world");
    expect(result.stderr).toBe("");
  });

  it("pipes stdinData to the child process", async () => {
    const result = await runCli({
      command: "cat",
      args: [],
      stdinData: "piped input",
      timeoutMs: 5_000,
    });
    expect(result.stdout).toBe("piped input");
  });

  it("rejects on non-zero exit code", async () => {
    await expect(
      runCli({ command: "false", args: [], timeoutMs: 5_000 }),
    ).rejects.toThrow("false exited 1");
  });

  it("rejects when command not found", async () => {
    await expect(
      runCli({
        command: "nonexistent-command-xyz",
        args: [],
        timeoutMs: 5_000,
      }),
    ).rejects.toThrow();
  });

  it("rejects on timeout", async () => {
    await expect(
      runCli({
        command: "sleep",
        args: ["10"],
        timeoutMs: 100,
      }),
    ).rejects.toThrow("timed out");
  });

  it("rejects immediately if signal already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      runCli({
        command: "echo",
        args: ["should not run"],
        timeoutMs: 5_000,
        signal: controller.signal,
      }),
    ).rejects.toThrow("Aborted");
  });

  it("kills child process on abort signal", async () => {
    const controller = new AbortController();

    const promise = runCli({
      command: "sleep",
      args: ["10"],
      timeoutMs: 30_000,
      signal: controller.signal,
    });

    // Abort after a short delay
    setTimeout(() => controller.abort(), 50);

    await expect(promise).rejects.toThrow("Aborted");
  });

  it("strips CLAUDECODE env from child process", async () => {
    // Set the env var so we can verify it's stripped
    const original = process.env.CLAUDECODE;
    process.env.CLAUDECODE = "true";
    try {
      const result = await runCli({
        command: "env",
        args: [],
        timeoutMs: 5_000,
      });
      expect(result.stdout).not.toContain("CLAUDECODE=");
    } finally {
      if (original !== undefined) process.env.CLAUDECODE = original;
      else delete process.env.CLAUDECODE;
    }
  });

  it("captures stderr alongside stdout", async () => {
    const result = await runCli({
      command: "sh",
      args: ["-c", "echo out; echo err >&2"],
      timeoutMs: 5_000,
    });
    expect(result.stdout.trim()).toBe("out");
    expect(result.stderr.trim()).toBe("err");
  });
});
