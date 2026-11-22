export type ThemeChoice = "system" | "light" | "dark";
type Theme = "light" | "dark";

const THEME_KEY = "pinky.theme";

// Must match --bg in app/globals.css. Used for the browser / status bar color.
const THEME_BG: Record<Theme, string> = { light: "#fff7f3", dark: "#141015" };

// Inlined into <head> so the right theme is set before the first paint (no flash).
// Plain ES5 on purpose: it runs before any bundle loads.
export const themeInitScript = `(function(){var d=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)").matches,c=null;try{c=localStorage.getItem("${THEME_KEY}")}catch(e){}d.dataset.theme=c==="dark"||(c!=="light"&&m)?"dark":"light"})();`;

export function getThemeChoice(): ThemeChoice {
  try {
    const c = localStorage.getItem(THEME_KEY);
    return c === "light" || c === "dark" ? c : "system";
  } catch {
    return "system";
  }
}

function resolve(choice: ThemeChoice): Theme {
  if (choice !== "system") return choice;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(choice: ThemeChoice = getThemeChoice()): void {
  const theme = resolve(choice);
  document.documentElement.dataset.theme = theme;
  // Next renders one theme-color tag per color scheme. On "system" each keeps its own color;
  // with a chosen theme both point at it, so the status bar matches the app.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const own: Theme = (m.media || "").includes("dark") ? "dark" : "light";
    m.content = THEME_BG[choice === "system" ? own : theme];
  });
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {}
  applyTheme(choice);
}

/** Keeps "system" in sync with the device setting, and other open tabs in sync with each other. */
export function watchTheme(): () => void {
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (getThemeChoice() === "system") applyTheme("system");
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY || e.key === null) applyTheme();
  };
  mq.addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage);
  applyTheme();
  return () => {
    mq.removeEventListener("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}
