import { describe, it, expect, afterAll } from "vitest";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";

const PROJECT_ROOT = path.resolve(__dirname, "../..");

/** Find an available port */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (!addr || typeof addr === "string") {
        srv.close(() => reject(new Error("Could not get port")));
        return;
      }
      const port = addr.port;
      srv.close(() => resolve(port));
    });
  });
}

/** Poll a URL until it returns 200 or timeout */
async function pollUntilReady(
  url: string,
  timeoutMs: number,
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.status;
    } catch {
      // server not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms`);
}

describe("packaging smoke test", () => {
  let tmpDir: string;
  let serverProcess: ChildProcess | null = null;

  afterAll(() => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill("SIGKILL");
    }
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("tarball installs and server starts successfully", { timeout: 180_000 }, async () => {
      // 1. Build
      execSync("npm run build:npx", {
        cwd: PROJECT_ROOT,
        stdio: "pipe",
        timeout: 120_000,
      });

      // Verify Vite SPA output exists
      const distDir = path.join(PROJECT_ROOT, "dist");
      expect(fs.existsSync(path.join(distDir, "index.html"))).toBe(true);
      expect(fs.existsSync(path.join(distDir, "server.js"))).toBe(true);

      // Verify at least one JS and one CSS asset
      const assetsDir = path.join(distDir, "assets");
      expect(fs.existsSync(assetsDir)).toBe(true);
      const assets = fs.readdirSync(assetsDir);
      expect(assets.some((f) => f.endsWith(".js"))).toBe(true);
      expect(assets.some((f) => f.endsWith(".css"))).toBe(true);

      // Verify Prisma generated client was copied
      const nodeModulesDir = path.join(distDir, "node_modules");
      expect(fs.existsSync(path.join(nodeModulesDir, "@prisma", "client"))).toBe(true);

      // Verify libsql native module was copied
      expect(fs.existsSync(path.join(nodeModulesDir, "libsql"))).toBe(true);

      // 2. Pack
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sq-pkg-test-"));
      const packOutput = execSync("npm pack --json", {
        cwd: PROJECT_ROOT,
        encoding: "utf-8",
        timeout: 30_000,
      });
      const packInfo = JSON.parse(packOutput);
      const tarballName = packInfo[0]?.filename;
      expect(tarballName).toBeDefined();
      const tarballSrc = path.join(PROJECT_ROOT, tarballName);
      const tarballDest = path.join(tmpDir, tarballName);
      fs.renameSync(tarballSrc, tarballDest);

      // 2b. Assert no forbidden files in tarball
      const forbiddenPatterns = [/\.db$/, /settings\.json$/, /docs\/internal\//, /\.env\.local$/];
      const fileList = packInfo[0]?.files?.map((f: { path: string }) => f.path) ?? [];
      for (const pattern of forbiddenPatterns) {
        const matches = fileList.filter((f: string) => pattern.test(f));
        expect(matches, `Forbidden pattern ${pattern} found in tarball: ${matches.join(", ")}`).toHaveLength(0);
      }

      // 3. Install into clean directory
      const installDir = path.join(tmpDir, "install");
      fs.mkdirSync(installDir, { recursive: true });
      execSync("npm init -y", {
        cwd: installDir,
        stdio: "pipe",
        timeout: 10_000,
      });
      execSync(`npm install "${tarballDest}"`, {
        cwd: installDir,
        stdio: "pipe",
        timeout: 60_000,
      });

      // 4. Start the server
      const port = await getFreePort();
      const cliPath = path.join(
        installDir,
        "node_modules/@eeshans/sidequests/bin/cli.mjs",
      );
      expect(fs.existsSync(cliPath)).toBe(true);

      serverProcess = spawn(
        process.execPath,
        [cliPath, "--port", String(port), "--no-open"],
        {
          cwd: installDir,
          env: {
            ...process.env,
            APP_DATA_DIR: path.join(tmpDir, "data"),
            NODE_ENV: "production",
          },
          stdio: "pipe",
        },
      );

      // Collect stderr for diagnostics on failure
      let stderr = "";
      serverProcess.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      // 5. Poll preflight
      const url = `http://127.0.0.1:${port}/api/preflight`;
      let status: number;
      try {
        status = await pollUntilReady(url, 30_000);
      } catch (err) {
        // Surface server stderr so failures are diagnosable
        if (stderr) console.error("Server stderr:\n" + stderr);
        throw err;
      }

      // 6. Assert preflight
      expect(status).toBe(200);

      // 7. Hit a DB-touching endpoint to verify @libsql/client works
      const projectsUrl = `http://127.0.0.1:${port}/api/projects`;
      const projectsRes = await fetch(projectsUrl);
      if (!projectsRes.ok) {
        const body = await projectsRes.text();
        if (stderr) console.error("Server stderr:\n" + stderr);
        console.error("GET /api/projects failed:", projectsRes.status, body);
      }
      expect(projectsRes.status).toBe(200);
      const projectsData = await projectsRes.json();
      expect(projectsData.ok).toBe(true);
      expect(Array.isArray(projectsData.projects)).toBe(true);
  });
});