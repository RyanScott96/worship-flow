// Scan files are stored as paths RELATIVE to a base that isn't wired up yet.
// `arrangement.scan_pdf_path` and `arrangement_page.image_path` hold values like
// `scans/<slug>-<index>/page-01.webp` (see scripts/digitize/paths.ts). Nothing
// resolves them today — the storage hop (church Google Drive, D-10, provisional)
// is still undesigned; see docs/DIGITIZATION.md § Storage.
//
// Everything that needs to show a scan goes through resolveScanUrl, so when the
// Drive base + access model lands there is exactly one place to wire it.

/**
 * Turn a stored relative scan path into something an `<img>` / `<a href>` can
 * load. For now it just normalizes the path; once storage is decided this
 * prefixes the Drive base (or proxies through a route).
 */
export function resolveScanUrl(storedPath: string): string {
  return storedPath.replace(/^\/+/, "");
}
