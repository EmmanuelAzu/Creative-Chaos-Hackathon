import { createClient } from "@supabase/supabase-js";

// Browser / general client — safe to use anywhere, respects RLS.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-only client with the service role key — bypasses RLS.
// NEVER import this from a "use client" component. Only use it inside
// route handlers under src/app/api/admin/*.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
