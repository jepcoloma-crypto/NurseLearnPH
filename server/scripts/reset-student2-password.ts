import bcrypt from "bcrypt";
import { db } from "../src/database/index.js";
import { users } from "../src/database/schema/index.js";
import { eq } from "drizzle-orm";

const hash = await bcrypt.hash("student123", 12);
const [updated] = await db
  .update(users)
  .set({ passwordHash: hash, updatedAt: new Date() })
  .where(eq(users.username, "student2"))
  .returning({ username: users.username });
console.log("Reset password for:", updated?.username ?? "NOT FOUND");
process.exit(0);
