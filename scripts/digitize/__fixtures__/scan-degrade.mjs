// Regenerate the synthetic scan-degradation fixtures. Takes the clean seed PNGs
// in _seeds/ and produces degraded twins under scan-<profile>/degraded.png that
// stand in for real paper scans (skew, noise, faded contrast, uneven lighting,
// JPEG blocking, margin shift) while we have no real scans to tune against.
//
//   node scripts/digitize/__fixtures__/scan-degrade.mjs
//
// Grayscale in, grayscale out — never bitonal (D-05). Every command is printed
// so a volunteer can reproduce or extend a profile by hand.
//
// After regenerating, recapture words.tsv per profile:
//   npx tsx -e "import('./scripts/digitize/preprocess.ts').then(async m => {
//     const r = await m.preprocessPage('<profile>/degraded.png', m.DEFAULT_PREPROCESS);
//     console.log(r.pngPath); })"
//   tesseract <that path> stdout --oem 1 --psm 4 -c preserve_interword_spaces=1 \
//     -c tessedit_create_tsv=1 > scan-<profile>/words.tsv
// then update expected.pro / expected.warnings.json / pageconf.json and `npm test`.

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SEEDS = path.join(DIR, "_seeds");
const SCRATCH = process.env.SCRATCHPAD || tmpdir();

function magick(args) {
  console.log("  magick " + args.join(" "));
  execFileSync("magick", args, { stdio: ["ignore", "ignore", "inherit"] });
}

function dims(png) {
  const s = execFileSync("magick", ["identify", "-format", "%wx%h", png], {
    encoding: "utf8",
  });
  const [w, h] = s.split("x").map(Number);
  return { w, h };
}

/** profile -> (src, dst) -> ordered magick arg arrays. */
const PROFILES = {
  // Sheet-fed skew + light sensor noise + a margin shift from imperfect feeding.
  // Mild enough that -deskew still locks onto the text lines — this profile's
  // job is to prove preprocessing straightens and cleans it back to the clean
  // extraction.
  "scan-skew-noise": (src, dst) => {
    const { w, h } = dims(src);
    return [
      [src,
        "-colorspace", "Gray",
        "-background", "white", "-virtual-pixel", "white",
        "-distort", "SRT", "2.5", "+repage",
        "-attenuate", "0.05", "+noise", "Gaussian", "-blur", "0x0.5",
        // shift content down-right by (14, 9), then trim back to the seed size
        "-gravity", "NorthWest", "-background", "white", "-splice", "14x9",
        "-crop", `${w}x${h}+0+0`, "+repage",
        "-scale", "78%",
        "-depth", "8", "-strip", "-define", "png:compression-level=9", dst],
    ];
  },
  // Faded photocopy: one-sided lighting shadow, compressed dynamic range, soft
  // focus, then a low-quality JPEG round trip for blocking artifacts. Tuned to
  // land mean OCR confidence below the 75 RE-SCAN floor while most text survives.
  "scan-faded-vignette": (src, dst) => {
    const { w, h } = dims(src);
    const jpg = path.join(SCRATCH, "scan-faded.jpg");
    return [
      [src,
        "-colorspace", "Gray",
        "(", "-size", `${w}x${h}`, "gradient:gray58-white", ")",
        "-compose", "Multiply", "-composite",
        "+level", "6%,82%",
        "-blur", "0x0.8",
        "-quality", "38", jpg],
      [jpg, "-colorspace", "Gray", "-depth", "8", "-strip", dst],
    ];
  },
};

for (const [profile, build] of Object.entries(PROFILES)) {
  const outDir = path.join(DIR, profile);
  mkdirSync(outDir, { recursive: true });
  const seed =
    profile === "scan-faded-vignette" ? "amazing-grace.png" : "home-on-the-range.png";
  const src = path.join(SEEDS, seed);
  const dst = path.join(outDir, "degraded.png");
  console.log(`${profile}  (seed: ${seed})`);
  for (const args of build(src, dst)) magick(args);
  console.log(`  -> ${path.relative(process.cwd(), dst)}`);
}

console.log("\ndone — recapture words.tsv per the header comment and update expecteds");
