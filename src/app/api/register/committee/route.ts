import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { fullName, portfolio, accessKey } = await req.json();

  if (accessKey !== process.env.COMMITTEE_ACCESS_KEY) {
    return NextResponse.json({ error: "Invalid access key" }, { status: 401 });
  }
  if (!fullName?.trim() || !portfolio?.trim()) {
    return NextResponse.json({ error: "Name and portfolio/company are required" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Already registered under this exact name? Hand back their existing
  // identity instead of creating a duplicate committee row.
  const { data: existing } = await admin
    .from("people")
    .select("id")
    .eq("role", "committee")
    .ilike("full_name", fullName.trim())
    .maybeSingle();
  if (existing) return NextResponse.json(existing);

  const { data, error } = await admin
    .from("people")
    .insert({
      role: "committee",
      full_name: fullName.trim(),
      portfolio: portfolio.trim(),
    })
    .select("id")
    .single();

  if (error) {
    // Race: two near-simultaneous submissions for the same name — the
    // unique index caught it, so fetch and return the one that won.
    if (error.code === "23505") {
      const { data: winner } = await admin
        .from("people")
        .select("id")
        .eq("role", "committee")
        .ilike("full_name", fullName.trim())
        .maybeSingle();
      if (winner) return NextResponse.json(winner);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
