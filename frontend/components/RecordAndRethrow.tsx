import { useEffect, useState } from "react";
import type { ErrorBoundaryProps } from "expo-router";

import { flushDiagnostics, recordError } from "@/services/diagnostics";

/**
 * Root error boundary: logs a render crash for the next bug report, then lets it
 * crash the app as if no boundary existed. A surviving app would stop expo-updates
 * from rolling back a broken OTA.
 */
export default function RecordAndRethrow({ error }: ErrorBoundaryProps) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    recordError("render", error);
    void flushDiagnostics().finally(() => setSaved(true));
  }, [error]);

  if (saved) throw error;
  return null;
}
