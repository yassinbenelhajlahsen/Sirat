// app/index.tsx
import { Redirect } from "expo-router";
import { useEffect } from "react";

import { preloadQuranData } from "@/services/quranData";

export default function Index() {
  useEffect(() => {
    preloadQuranData().catch((error) => {
      console.error("Failed to ensure Quran data is preloaded", error);
    });
  }, []);

  return <Redirect href="/(tabs)" />;
}
