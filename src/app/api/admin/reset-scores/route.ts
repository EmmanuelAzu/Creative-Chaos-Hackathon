import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_DASHBOARD_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { stage }: { stage: "round1" | "final" } = await req.json();
  const admin = supabaseAdmin();

  if (stage === "round1") {
    const { error: scoresErr } = await admin.from("scores").delete().not("id", "is", null);
    if (scoresErr) return NextResponse.json({ error: scoresErr.message }, { status: 500 });
    const { error: teamsErr } = await admin.from("teams").update({ round1_rank: null }).not("id", "is", null);
    if (teamsErr) return NextResponse.json({ error: teamsErr.message }, { status: 500 });
    await admin.from("settings").update({ round1_reveal_step: 0 }).eq("id", true);
    return NextResponse.json({ reset: "round1" });
  }

  if (stage === "final") {
    const { error: votesErr } = await admin.from("final_votes").delete().not("id", "is", null);
    if (votesErr) return NextResponse.json({ error: votesErr.message }, { status: 500 });
    const { error: teamsErr } = await admin.from("teams").update({ final_rank: null }).not("id", "is", null);
    if (teamsErr) return NextResponse.json({ error: teamsErr.message }, { status: 500 });
    await admin.from("settings").update({ reveal_step: 0 }).eq("id", true);
    return NextResponse.json({ reset: "final" });
  }

  return NextResponse.json({ error: "stage must be round1 or final" }, { status: 400 });
}
