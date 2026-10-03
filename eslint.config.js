import path from "node:path";
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import { defineConfig } from "eslint/config";
import { includeIgnoreFile } from "@eslint/compat";
import globals from "globals";
import ts from "typescript-eslint";

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  prettier,
  svelte.configs.prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // TypeScript already catches undefined variables, and this rule gives false positives on TS types.
      // See https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      "no-undef": "off",
    },
  },
  {
    // Type-aware linting for everything TypeScript, including Svelte components
    files: ["**/*.ts", "**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: [".svelte"],
        parser: ts.parser,
      },
    },
    rules: {
      // A forgotten await fails silently: the error is lost and the request carries on.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      // A switch over a union must handle every member, so adding a new one flags every switch to update.
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  {
    rules: {
      // A <button> with no type submits its form, which is rarely what you want.
      "svelte/button-has-type": "error",
      // The Svelte preset turns off prefer-const in components because of $props(); this is the runes-aware version.
      "svelte/prefer-const": "error",
      eqeqeq: "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-non-null-assertion": "error",
      // Dropping a field with `const { field, ...rest } = value` is the usual way to omit it.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
  {
    // CLI scripts and the server's startup messages print on purpose.
    files: ["apps/api/src/scripts/**/*.ts", "apps/api/src/index.ts"],
    rules: { "no-console": "off" },
  }
);
