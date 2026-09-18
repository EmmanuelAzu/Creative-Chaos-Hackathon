import { createClient } from "@supabase/supabase-js";

// Browser / general client — safe to use anywhere, respects RLS.
// Falls back to placeholder values so a missing/misnamed env var fails at
// request time (a clear runtime error) instead of crashing the Next.js
// build for every route that happens to import this module — including
// server routes that only use supabaseAdmin() below and never touch this.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
);

// Server-only client with the service role key — bypasses RLS.
// NEVER import this from a "use client" component. Only use it inside
// route handlers under src/app/api/admin/*.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: {
        // Next.js patches global fetch() to cache GET requests by default —
        // including these, since supabase-js's reads are plain GETs under
        // the hood. Without opting out, a route can keep serving whatever
        // the table looked like on its first read of a process's lifetime
        // (e.g. a certificate rendered before a reveal, forever after).
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    }
  );
}
