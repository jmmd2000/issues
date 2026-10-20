// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  // Set by `define` in vite.config.ts when the app is built.
  const __SITE_VERSION__: string;
  const __GIT_SHA__: string;
  const __BUILT_AT__: string | null;
  const __WEB_PACKAGES__: { name: string; version: string }[];
}

export {};
