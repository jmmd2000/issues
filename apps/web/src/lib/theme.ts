export type ThemeChoice = "system" | "light" | "dark";

/** The key under which the choice is saved. The inline script in `app.html` reads the same key. */
export const THEME_STORAGE_KEY = "theme";

/** Turns any saved value into a theme choice. Anything unknown means `system`. */
export function parseThemeChoice(value: unknown): ThemeChoice {
  if (value === "light" || value === "dark") return value;
  return "system";
}

/**
 * Reads the saved choice. Browsers can block or clear storage, for example in a
 * private window, so a failed read means `system`.
 */
export function readStoredTheme(storage: Pick<Storage, "getItem"> = localStorage): ThemeChoice {
  try {
    return parseThemeChoice(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

/** Saves the choice. A blocked write is ignored, so the choice then lasts until the page closes. */
export function storeTheme(choice: ThemeChoice, storage: Pick<Storage, "setItem"> = localStorage): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    return;
  }
}

/** Tells whether the page shows the dark theme. A theme set on the page wins, otherwise the browser setting decides. */
export function isShowingDark(root: Pick<HTMLElement, "dataset"> = document.documentElement, prefersDark: () => boolean = () => matchMedia("(prefers-color-scheme: dark)").matches): boolean {
  const applied = root.dataset.theme;
  if (applied === "light" || applied === "dark") return applied === "dark";
  return prefersDark();
}

/** Sets the theme on the page. `system` removes the attribute, so the browser setting decides. */
export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement): void {
  if (choice === "system") {
    delete root.dataset.theme;
    return;
  }
  root.dataset.theme = choice;
}
