"use client";

import { useEffect, useState } from "react";

/**
 * Reactive online/offline detector. We keep a tiny local mirror of
 * `navigator.onLine` so React re-renders when connectivity flips. Used
 * by the mobile shell to surface an offline banner.
 */
export function useOnlineStatus(): { online: boolean } {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine);

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return { online };
}
