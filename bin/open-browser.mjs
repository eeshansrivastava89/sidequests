#!/usr/bin/env node

import { execFile } from "node:child_process";

/**
 * Open a URL in the default browser.
 * Non-blocking, silent failure with console fallback.
 */
export function openBrowser(url) {
  let cmd;
  let args;

  if (process.platform === "darwin") {
    cmd = "open";
    args = [url];
  } else if (process.platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }

  execFile(cmd, args, (err) => {
    if (err) {
      console.log(`Open ${url} in your browser.`);
    }
  });
}
