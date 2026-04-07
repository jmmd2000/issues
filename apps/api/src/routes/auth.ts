import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { AuthService } from "../services/authService";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

const registerSchema = z.object({ name: z.string(), email: z.email(), password: z.string().min(8) });
const loginSchema = z.object({ email: z.email(), password: z.string() });

export const auth = new Hono()
  .post("/api/auth/register", zValidator("json", registerSchema), async (c) => {
    const { name, email, password } = c.req.valid("json");
    const user = await AuthService.createUser(name, email, password);
    return c.json({ user: user }, 201);
  })
  .post("/api/auth/login", zValidator("json", loginSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const { success, session } = await AuthService.loginUser(email, password);

    setCookie(c, "session_id", session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
      expires: session.expiresAt,
    });

    return c.json({ success }, 200);
  })
  .post("/api/auth/logout", async (c) => {
    const sessionID = getCookie(c, "session_id");
    if (sessionID) await AuthService.logoutUser(sessionID);
    deleteCookie(c, "session_id", { path: "/" });
    return c.json({ success: true }, 200);
  });
