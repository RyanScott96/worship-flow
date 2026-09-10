"use client";

import { useEffect } from "react";

// A chart left open on a music stand shouldn't dim or sleep mid-song (ROADMAP
// Phase 3). While the calling component is mounted, hold a screen wake lock.
//
// The browser drops the lock whenever the tab is hidden or the screen locks, so
// re-acquire it on `visibilitychange` — the real Sunday-morning case is picking
// the tablet back up after it slept, not the first open.
//
// Best-effort by design: browsers without the API (older iOS Safari, Firefox)
// and a rejected request (not focused, low battery) are swallowed. There is
// nothing for a volunteer to act on, and the fallback is the pre-tablet norm.
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let stopped = false;

    const acquire = async () => {
      try {
        const s = await navigator.wakeLock.request("screen");
        // The component may have unmounted while the request was in flight
        // (client-side nav away from the viewer). Cleanup already ran and saw
        // `sentinel` still null, so release this one here or it outlives the
        // viewer until the browser next drops it on its own.
        if (stopped) {
          s.release().catch(() => {});
          return;
        }
        sentinel = s;
      } catch {
        // denied — leave it; visibilitychange will try again on the next return
      }
    };

    const onVisibility = () => {
      if (!stopped && document.visibilityState === "visible") acquire();
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
