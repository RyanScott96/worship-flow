"use client";

import { useState } from "react";
import {
  MODE_COOKIE,
  MODE_LABEL,
  MODES,
  SKIN_COOKIE,
  SKIN_LABEL,
  SKINS,
  type Mode,
  type Skin,
} from "@/lib/theme";

const YEAR = 60 * 60 * 24 * 365;

function remember(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${YEAR}; samesite=lax`;
}

/**
 * Mode + skin pickers. Changing either just flips an attribute on <html> —
 * every color is a token (D-24), so nothing re-renders — and remembers it in a
 * cookie so the server renders the same choice next time.
 */
export function ThemeSwitcher({ mode, skin }: { mode: Mode; skin: Skin }) {
  const [current, setCurrent] = useState({ mode, skin });

  function setMode(next: Mode) {
    remember(MODE_COOKIE, next);
    if (next === "system") delete document.documentElement.dataset.mode;
    else document.documentElement.dataset.mode = next;
    setCurrent((c) => ({ ...c, mode: next }));
  }

  function setSkin(next: Skin) {
    remember(SKIN_COOKIE, next);
    document.documentElement.dataset.skin = next;
    setCurrent((c) => ({ ...c, skin: next }));
  }

  const select = "rounded border border-input bg-card px-1 py-0.5 text-foreground";

  return (
    <div className="ml-auto flex items-center gap-2 text-sm">
      <label className="sr-only" htmlFor="theme-skin">
        Theme
      </label>
      <select
        id="theme-skin"
        className={select}
        value={current.skin}
        onChange={(e) => setSkin(e.target.value as Skin)}
      >
        {SKINS.map((s) => (
          <option key={s} value={s}>
            {SKIN_LABEL[s]}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="theme-mode">
        Light or dark
      </label>
      <select
        id="theme-mode"
        className={select}
        value={current.mode}
        onChange={(e) => setMode(e.target.value as Mode)}
      >
        {MODES.map((m) => (
          <option key={m} value={m}>
            {MODE_LABEL[m]}
          </option>
        ))}
      </select>
    </div>
  );
}
