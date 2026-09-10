"use client";

import { useEffect } from "react";

// A chart left open on a music stand shouldn't dim or sleep mid-song (ROADMAP
// Phase 3). While the calling component is mounted, hold a screen wake lock.
//
// The browser drops the lock whenever the tab is hidden or the screen locks, so
// re-acquire it on `visibilitychange` — the real Sunday-morning case is picking
// the tablet back up after it slept, not the first open. The re-acquire guard
// tests `sentinel.released` rather than trusting the `release` event alone, so a
// lock the browser dropped without firing the event still gets replaced.
//
// Best-effort by design: browsers without the API (older iOS Safari, Firefox)
// and a rejected request (not focused, low battery) are swallowed. There is
// nothing for a volunteer to act on, and the fallback is the pre-tablet norm.
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let stopped = false;
    let acquiring = false;

    const acquire = async () => {
      // One in-flight request at a time, and none while a live lock is held —
      // otherwise overlapping calls (mount + a visibilitychange firing before
      // the first resolves) can each get a sentinel and orphan the earlier one.
      if (stopped || acquiring || (sentinel && !sentinel.released)) return;
      acquiring = true;
      try {
        const s = await navigator.wakeLock.request("screen");
        if (stopped) {
          s.release().catch(() => {});
          return;
        }
        sentinel = s;
        s.addEventListener("release", () => {
          if (sentinel === s) sentinel = null;
        });
      } catch {
        // denied — leave it; visibilitychange will try again on the next return
      } finally {
        acquiring = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      sentinel?.release().catch(() => {});
    };
  }, []);
}
