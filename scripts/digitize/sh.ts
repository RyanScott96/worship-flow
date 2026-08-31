// Thin wrapper around execFile with a useful error message. The pipeline only
// ever runs fixed binaries (tesseract, pdftoppm, pdfseparate, pdfunite) with
// argument arrays — never a shell string.

import { execFile } from "node:child_process";

export interface RunResult {
  stdout: string;
  stderr: string;
}

export function run(
  bin: string,
  args: string[],
  opts: { cwd?: string; maxBuffer?: number } = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      { cwd: opts.cwd, maxBuffer: opts.maxBuffer ?? 64 * 1024 * 1024, encoding: "utf8" },
      (err, stdout, stderr) => {
        if (err) {
          reject(
            new Error(
              `\`${bin} ${args.join(" ")}\` failed: ${err.message}\n${String(stderr).slice(0, 2000)}`,
            ),
          );
          return;
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}
