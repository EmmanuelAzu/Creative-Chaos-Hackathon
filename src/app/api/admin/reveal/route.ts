import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_DASHBOARD_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { action }: { action: "next" | "reset" } = await req.json();
  const admin = supabaseAdmin();

  if (action === "reset") {
    await admin.from("settings").update({ reveal_step: 0 }).eq("id", true);
    return NextResponse.json({ reveal_step: 0 });
  }

  // On the very first "next", freeze final_rank for all top-5 teams based on
  // the current weighted scores, so the reveal order can't shift mid-ceremony.
  const { data: settings } = await admin.from("settings").select("reveal_step").single();
  const step = settings?.reveal_step ?? 0;

  if (step === 0) {
    const { data: ranked } = await admin
      .from("final_team_scores")
      .select("team_id, weighted_score")
      .order("weighted_score", { ascending: false, nullsFirst: false });
    for (let i = 0; i < (ranked?.length ?? 0); i++) {
      await admin.from("teams").update({ final_rank: i + 1 }).eq("id", ranked![i].team_id);
    }
  }

  const next = Math.min(step + 1, 5);
  const { data } = await admin
    .from("settings")
    .update({ reveal_step: next })
    .eq("id", true)
    .select()
    .single();
  return NextResponse.json(data);
}
