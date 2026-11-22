"use client";

import { useEffect } from "react";
import { watchTheme } from "@/lib/theme";

export function ThemeSync() {
  useEffect(() => watchTheme(), []);
  return null;
}
