/**
 * Theme selection (D-24). Two independent axes, both stored in cookies and
 * rendered onto <html> server-side (app/layout.tsx), so the first paint is
 * already right — no flash, no inline script. The colors themselves live only
 * in app/globals.css; this file just names the choices.
 */

export const SKINS = ["harbor", "contrast"] as const;
export type Skin = (typeof SKINS)[number];
export const SKIN_LABEL: Record<Skin, string> = {
  harbor: "Harbor",
  contrast: "High contrast",
};

/** `system` is not written to <html>: no `data-mode` means follow the OS. */
export const MODES = ["system", "light", "dark"] as const;
export type Mode = (typeof MODES)[number];
export const MODE_LABEL: Record<Mode, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export const SKIN_COOKIE = "skin";
export const MODE_COOKIE = "mode";

export function parseSkin(value: string | undefined): Skin {
  return (SKINS as readonly string[]).includes(value ?? "") ? (value as Skin) : "harbor";
}

export function parseMode(value: string | undefined): Mode {
  return (MODES as readonly string[]).includes(value ?? "") ? (value as Mode) : "system";
}
