import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm"; // CORRETO
import * as schema from "@shared/schema";
import bcrypt from "bcryptjs";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

/**
 * Pool PostgreSQL (Railway)
 */
export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

/**
 * Drizzle ORM (PostgreSQL)
 */
export const db = drizzle(pgPool, {
  schema,
});

/**
 * Garante usuário admin
 */
export async function ensureAdminUser() {
  const adminUsername = "admin";
  const adminEmail = "admin@vistasaron.com.br";
  const adminPassword = "admin123";

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const existingAdmin = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, adminUsername));

  if (existingAdmin.length === 0) {
    await db.insert(schema.users).values({
      username: adminUsername,
      email: adminEmail,
      password: passwordHash,
      full_name: "Administrador",
      role: "administrador",
      is_active: true,
      created_at: new Date(),
    });
    console.log("✅ Admin user created");
  } else if (!existingAdmin[0].is_active) {
    await db
      .update(schema.users)
      .set({ is_active: true })
      .where(eq(schema.users.id, existingAdmin[0].id));
    console.log("✅ Admin user reactivated");
  } else {
    console.log("Admin user already exists and active");
  }
}
