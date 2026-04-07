import argon2 from "argon2";
import { db } from "../db";
import { users } from "../db/schema";
import { count } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

export class AuthService {
  static async createUser(name: string, email: string, password: string) {
    const existingUsers = await db.select({ count: count() }).from(users);
    if (existingUsers[0].count > 0) throw new HTTPException(403, { message: "Max number of users already exists." });

    const passwordHash = await argon2.hash(password);
    return db.insert(users).values({ name, email, passwordHash }).returning({ name: users.name, email: users.email, avatarURL: users.avatarURL, createdAt: users.createdAt });
  }
}
