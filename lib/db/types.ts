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

export interface ServiceRow {
  id: string;
  name: string;
  starts_at: string;
  notes: string | null;
  created_at: string;
}

export type ServiceItemType =
  | "song"
  | "prayer"
  | "sermon"
  | "announcement"
  | "other";

export interface ServiceItemRow {
  id: string;
  service_id: string;
  position: number;
  arrangement_id: string | null;
  title: string | null;
  item_type: ServiceItemType;
  /** The key FOR THIS SERVICE (D-02). Null -> the arrangement's own source_key. */
  key_override: string | null;
  capo: number | null;
  duration_secs: number | null;
  notes: string | null;
}

/**
 * A service item joined to its song/arrangement (song items only). `source_key`
 * and `chordpro_body` come from the arrangement; `song_title` from the song.
 */
export interface ServiceItemDetail extends ServiceItemRow {
  song_id: string | null;
  song_title: string | null;
  arrangement_name: string | null;
  source_key: string | null;
  chordpro_body: string | null;
  review_status: ReviewStatus | null;
}

export interface ServiceWithItems {
  service: ServiceRow;
  items: ServiceItemDetail[];
}
