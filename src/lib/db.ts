import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
let pool: pg.Pool | undefined;

const globalForLocal = globalThis as typeof globalThis & {
  planformPglite?: Promise<PGlite>;
};

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl !== "") {
    pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return (await pool.query(text, params)).rows as T[];
  }
  globalForLocal.planformPglite ??= startLocal().catch((error: unknown) => {
    globalForLocal.planformPglite = undefined;
    throw error;
  });
  return (await (await globalForLocal.planformPglite).query<T>(text, params)).rows;
}

async function startLocal(): Promise<PGlite> {
  const dir = path.join(process.cwd(), ".data", "pglite");
  await mkdir(dir, { recursive: true });
  const db = new PGlite(dir);
  const files = (await readdir("migrations").catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  return db;
}
