import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_DASHBOARD_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { teamNames }: { teamNames: string[] } = await req.json();
  const clean = [...new Set(teamNames.map((n) => n.trim()).filter(Boolean))];
  if (clean.length === 0) {
    return NextResponse.json({ error: "No team names provided" }, { status: 400 });
  }
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("teams")
    .upsert(
      clean.map((name) => ({ name })),
      { onConflict: "name", ignoreDuplicates: true }
    )
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: data?.length ?? 0 });
}
