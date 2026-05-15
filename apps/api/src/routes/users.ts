import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "../middleware/auth";
import { UserService } from "../services/userService";

export const users = new Hono()
  .post("/api/users/me/avatar", requireAuth, async (c) => {
    const userID = c.get("userID");

    const body = await c.req.parseBody({ all: false });
    const file = body["file"];
    if (!(file instanceof File)) throw new HTTPException(400, { message: "Multipart `file` field is required." });
    if (!file.type.startsWith("image/")) throw new HTTPException(415, { message: "Avatar must be an image." });

    const bytes = Buffer.from(await file.arrayBuffer());
    const user = await UserService.setAvatar(userID, bytes);

    return c.json({ user }, 200);
  })
  .delete("/api/users/me/avatar", requireAuth, async (c) => {
    const userID = c.get("userID");
    const user = await UserService.clearAvatar(userID);

    return c.json({ user }, 200);
  });
