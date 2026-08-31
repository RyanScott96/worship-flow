// The tuning surface for the digitization pipeline. These are starting values
// picked against born-digital PDFs and a SYNTHETIC scan-degradation corpus
// (scripts/digitize/__fixtures__/scan-*). Expect to move them on the first real
// binder — that is what ROADMAP Phase 1.5 step 1 (the 20-chart pilot) is for.
// Keeping them in one file means a volunteer can find them with one grep.

/** Mean of the per-page OCR confidences below which a chart is a RE-SCAN CANDIDATE. */
export const OCR_CONF_FLOOR = 75;

/** A single page this weak inside an otherwise-OK chart still gets a note. */
export const OCR_CONF_PAGE_FLOOR = 60;

/** Soft section break: vertical gap must exceed this multiple of the median gap
 *  AND the absolute floor below. Raised from a bare 1.8 after real charts with a
 *  blank line between every lyric over-produced untitled sections. */
export const SOFT_BREAK_GAP_MULT = 2.2;
export const SOFT_BREAK_MIN_HEIGHT_MULT = 1.2;

/** ImageMagick `-deskew` threshold. 40% is its usual sweet spot for text pages. */
export const DESKEW_THRESHOLD = "40%";

/** `auto` preprocessing skips a step when the page doesn't need it. */
export const AUTO_SKEW_SKIP_DEG = 0.3; // |angle| below this -> don't rotate
export const AUTO_FLATTEN_STDDEV = 0.16; // normalized std-dev above this -> page is crisp, skip flatten
export const AUTO_FLATTEN_QUADRANT_SPREAD = 0.06; // inter-quadrant mean spread above this -> uneven lighting, flatten
export const AUTO_DESPECKLE_DELTA = 0.006; // mean diff vs a despeckled copy above this -> noisy, despeckle
