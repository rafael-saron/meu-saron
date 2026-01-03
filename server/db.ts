import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import bcrypt from "bcrypt";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

/**
 * Pool PostgreSQL (Railway - TCP)
 */
export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

/**
 * Drizzle ORM (PostgreSQL)
 */
export const db = drizzle(pgPool, {
  schema,
});

/**
 * Função para garantir que o usuário admin exista
 */
export async function ensureAdminUser() {
  const adminUsername = "admin";
  const adminPassword = "admin123";

  // Hash da senha
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // Verifica se o usuário admin já existe
  const existingAdmin = await db
    .select()
    .from(schema.users)
    .where(schema.users.username.eq(adminUsername));

  if (existingAdmin.length === 0) {
    await db.insert(schema.users).values({
      username: adminUsername,
      password: passwordHash,
      role: "admin",
      created_at: new Date(),
    });
    console.log("Admin user created successfully");
  } else {
    console.log("Admin user already exists");
  }
}
