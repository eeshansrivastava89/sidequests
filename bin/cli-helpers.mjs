/**
 * Pure helpers extracted from cli.mjs for testability.
 */

import net from "node:net";
import http from "node:http";
import os from "node:os";
import path from "node:path";

/**
 * Resolve the data directory for Sidequests: ~/.sidequests
 * @returns {string}
 */
export function resolveDataDir() {
  return path.join(os.homedir(), ".sidequests");
}

/**
 * Find a free TCP port. If preferred is given, tries that first.
 * @param {number|null} [preferred]
 * @returns {Promise<number>}
 */
export function findFreePort(preferred) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(preferred ?? 0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        reject(new Error("Could not determine port"));
      }
    });
    srv.on("error", (err) => {
      if (preferred && err.code === "EADDRINUSE") {
        findFreePort(null).then(resolve, reject);
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Poll a URL until it responds with status < 500 or timeout.
 * @param {string} url
 * @param {number} [timeoutMs=30000]
 * @returns {Promise<void>}
 */
export function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server did not start within ${timeoutMs}ms`));
        return;
      }
      const req = http.get(url, (res) => {
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          setTimeout(check, 200);
        }
      });
      req.on("error", () => setTimeout(check, 200));
      req.end();
    };
    check();
  });
}

/**
 * Parse CLI arguments.
 * @param {string[]} argv — process.argv.slice(2)
 * @returns {{ port: number|null, noOpen: boolean, help: boolean, version: boolean }}
 */
export function parseArgs(argv) {
  const help = argv.includes("--help") || argv.includes("-h");
  const version = argv.includes("--version") || argv.includes("-v");
  const noOpen = argv.includes("--no-open");
  const portIdx = argv.indexOf("--port");
  const port = portIdx !== -1 ? Number(argv[portIdx + 1]) : null;
  return { port, noOpen, help, version };
}
