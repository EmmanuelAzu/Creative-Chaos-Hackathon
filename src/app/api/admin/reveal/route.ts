import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_DASHBOARD_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const {
    action,
    stage = "final",
  }: { action: "next" | "reset" | "revealAll"; stage?: "round1" | "final" } = await req.json();
  const admin = supabaseAdmin();

  if (stage === "round1") return handleRound1(admin, action);
  return handleFinal(admin, action);
}

async function handleFinal(admin: ReturnType<typeof supabaseAdmin>, action: "next" | "reset" | "revealAll") {
  if (action === "reset") {
    const { data } = await admin
      .from("settings")
      .update({ reveal_step: 0 })
      .eq("id", true)
      .select()
      .single();
    return NextResponse.json(data);
  }

  // On the very first "next"/"revealAll", freeze final_rank for all top-5
  // teams based on the current weighted scores, so the reveal order can't
  // shift mid-ceremony.
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

  const next = action === "revealAll" ? 5 : Math.min(step + 1, 5);
  const { data } = await admin
    .from("settings")
    .update({ reveal_step: next })
    .eq("id", true)
    .select()
    .single();
  return NextResponse.json(data);
}

async function handleRound1(admin: ReturnType<typeof supabaseAdmin>, action: "next" | "reset" | "revealAll") {
  if (action === "reset") {
    const { data } = await admin
      .from("settings")
      .update({ round1_reveal_step: 0 })
      .eq("id", true)
      .select()
      .single();
    return NextResponse.json(data);
  }

  // On the very first "next"/"revealAll", freeze round1_rank (top 10) from
  // the current aggregate scores, so late scores can't shift places mid-ceremony.
  const { data: settings } = await admin.from("settings").select("round1_reveal_step").single();
  const step = settings?.round1_reveal_step ?? 0;

  if (step === 0) {
    const { data: ranked } = await admin
      .from("round1_team_scores")
      .select("team_id, aggregate_score")
      .order("aggregate_score", { ascending: false, nullsFirst: false })
      .limit(10);
    await admin.from("teams").update({ round1_rank: null }).not("id", "is", null);
    for (let i = 0; i < (ranked?.length ?? 0); i++) {
      await admin.from("teams").update({ round1_rank: i + 1 }).eq("id", ranked![i].team_id);
    }
  }

  const next = action === "revealAll" ? 10 : Math.min(step + 1, 10);
  const { data } = await admin
    .from("settings")
    .update({ round1_reveal_step: next })
    .eq("id", true)
    .select()
    .single();
  return NextResponse.json(data);
}
