// Check the system binaries the pipeline shells out to. `cli.ts` runs this
// before rasterize / ocr / extract unless --skip-doctor.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

interface Tool {
  bin: string;
  versionArgs: string[];
  /** Package that provides it, Arch / Debian. */
  pkg: string;
}

const TOOLS: Tool[] = [
  { bin: "tesseract", versionArgs: ["--version"], pkg: "tesseract / tesseract-ocr" },
  { bin: "pdftoppm", versionArgs: ["-v"], pkg: "poppler / poppler-utils" },
  { bin: "pdfseparate", versionArgs: ["-v"], pkg: "poppler / poppler-utils" },
  { bin: "pdfunite", versionArgs: ["-v"], pkg: "poppler / poppler-utils" },
];

async function firstLine(bin: string, args: string[]): Promise<string> {
  try {
    const { stdout, stderr } = await run(bin, args);
    const out = (stdout || stderr).trim().split("\n")[0];
    return out || "(installed)";
  } catch {
    // poppler tools print version to stderr and exit non-zero for -v; retry
    // by treating any output as success is handled above, so a throw here is
    // a genuine "not found / not runnable".
    throw new Error("not found on PATH");
  }
}

export interface DoctorResult {
  ok: boolean;
  lines: string[];
}

export async function doctor(): Promise<DoctorResult> {
  const lines: string[] = [];
  let ok = true;

  for (const t of TOOLS) {
    try {
      const v = await firstLine(t.bin, t.versionArgs);
      lines.push(`  ok   ${t.bin.padEnd(14)} ${v}`);
    } catch {
      ok = false;
      lines.push(`  MISSING ${t.bin.padEnd(11)} install: ${t.pkg}`);
    }
  }

  // Tesseract needs the English trained data.
  try {
    const { stdout, stderr } = await run("tesseract", ["--list-langs"]);
    const langs = (stdout || stderr)
      .trim()
      .split("\n")
      .slice(1)
      .map((s) => s.trim());
    if (langs.includes("eng")) {
      lines.push(`  ok   eng traineddata  (${langs.length} langs available)`);
    } else {
      ok = false;
      lines.push(
        `  MISSING eng traineddata  install: tesseract-data-eng / tesseract-ocr-eng`,
      );
    }
  } catch {
    // tesseract itself already reported missing above.
    if (ok) {
      ok = false;
      lines.push("  MISSING eng traineddata  (could not run `tesseract --list-langs`)");
    }
  }

  return { ok, lines };
}
