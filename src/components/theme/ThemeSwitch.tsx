"use client";

import { Segmented } from "@/components/ui/Segmented";
import { useTheme, type ThemeChoice } from "./ThemeProvider";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function ThemeSwitch() {
  const { choice, setChoice } = useTheme();
  return <Segmented label="Theme" options={OPTIONS} value={choice} onChange={setChoice} />;
}
