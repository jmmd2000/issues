export type ThemeChoice = "system" | "light" | "dark";

/** The key under which the choice is saved. The inline script in `app.html` reads the same key. */
export const THEME_STORAGE_KEY = "theme";

const NEXT_CHOICE: Record<ThemeChoice, ThemeChoice> = {
  system: "light",
  light: "dark",
  dark: "system",
};

/** Turns any saved value into a theme choice. Anything unknown means `system`. */
export function parseThemeChoice(value: unknown): ThemeChoice {
  if (value === "light" || value === "dark") return value;
  return "system";
}

/** Returns the choice that follows `choice` when the toggle is pressed. */
export function nextThemeChoice(choice: ThemeChoice): ThemeChoice {
  return NEXT_CHOICE[choice];
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

/** Sets the theme on the page. `system` removes the attribute, so the browser setting decides. */
export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement): void {
  if (choice === "system") {
    delete root.dataset.theme;
    return;
  }
  root.dataset.theme = choice;
}
