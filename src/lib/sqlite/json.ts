export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** SQLite stores JSON columns as TEXT; parse them back into JS values for the client, mirroring what Supabase's jsonb did automatically. */
export function parseJsonColumn<T = Json>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
