import pg from "pg";
import { ENV } from "../config/env.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
  // Railway Postgres requires SSL in production; local dev does not.
  ssl: ENV.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});
