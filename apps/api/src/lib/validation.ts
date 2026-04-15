import type { Context } from "hono";
import type { core } from "zod";

type ValidationResult<T> = { success: true; data: T } | { success: false; error: core.$ZodError; data: T };

export const validationHook = <T>(result: ValidationResult<T>, c: Context) => {
  if (result.success) return;

  const issues = result.error.issues;
  const fieldErrors: Record<string, string> = {};

  for (const issue of issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return c.json({ message: issues[0]?.message ?? "Invalid input.", fieldErrors }, 400);
};
