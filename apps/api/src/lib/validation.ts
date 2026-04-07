import type { Context } from "hono";

export const validationHook = (result: { success: boolean; error?: { issues: { message: string }[] } }, c: Context) => {
  if (!result.success) return c.json({ message: result.error!.issues[0].message }, 400);
};
