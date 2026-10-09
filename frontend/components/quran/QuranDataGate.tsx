import { useEffect, useState, type ReactNode } from "react";

import { isQuranDataLoaded, preloadQuranData } from "@/services/quranData";

/**
 * Holds the reader back until the Quran data is loaded. The root layout mounts
 * every route while the splash is up, so a cold open straight onto the Quran tab
 * (a widget tap) would otherwise read the data before it exists.
 */
export default function QuranDataGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(isQuranDataLoaded);

  useEffect(() => {
    if (ready) return;
    let mounted = true;
    preloadQuranData()
      .then(() => mounted && setReady(true))
      .catch((error) => console.error("Failed to load Quran data", error));
    return () => {
      mounted = false;
    };
  }, [ready]);

  return ready ? <>{children}</> : null;
}
