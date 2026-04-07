import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { AuthService } from "../services/authService";

const registerSchema = z.object({ name: z.string(), email: z.email(), password: z.string().min(8) });

export const auth = new Hono().post("/api/auth/register", zValidator("json", registerSchema), async (c) => {
  const { name, email, password } = c.req.valid("json");
  const user = await AuthService.createUser(name, email, password);
  return c.json({ user: user }, 201);
});
