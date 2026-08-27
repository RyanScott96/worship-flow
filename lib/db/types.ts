export interface SongRow {
  id: string;
  title: string;
  authors: string | null;
  ccli_number: string | null;
  copyright: string | null;
  default_key: string | null;
  notes: string | null;
  created_at: string;
}

export type ReviewStatus = "unverified" | "verified" | "flagged";
export type ExtractionMethod = "vlm" | "ocr_geometric" | "manual";

export interface ArrangementRow {
  id: string;
  song_id: string;
  name: string;
  chordpro_body: string;
  source_key: string;
  bpm: number | null;
  time_signature: string | null;
  scan_pdf_path: string | null;
  scan_page_count: number | null;
  review_status: ReviewStatus;
  review_note: string | null;
  verified_at: string | null;
  verified_by: string | null;
  extraction_method: ExtractionMethod | null;
  extraction_warnings: unknown;
  created_at: string;
  updated_at: string;
}

/** Summary shape used for arrangement lists (song detail page). */
export type ArrangementSummary = Pick<
  ArrangementRow,
  "id" | "name" | "source_key" | "review_status" | "updated_at"
>;
