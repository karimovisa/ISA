"use client";

import { useEffect } from "react";

/** Registers the service worker so push notifications work when the site is closed. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
