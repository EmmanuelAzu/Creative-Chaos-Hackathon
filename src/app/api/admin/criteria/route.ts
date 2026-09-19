import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_DASHBOARD_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { stage, name, category = null, prompt = null, max_score = 10, sort_order = 0 } = await req.json();
  if (!stage || !name) {
    return NextResponse.json({ error: "stage and name are required" }, { status: 400 });
  }
  // A fat-fingered max_score (e.g. 1200 instead of 12) silently inflates
  // every team's total by that same factor the moment one judge maxes out
  // the slider — cap it at something no single criterion could plausibly
  // need, well above the biggest one either rubric currently uses (35).
  const maxScoreNum = Number(max_score);
  if (!Number.isInteger(maxScoreNum) || maxScoreNum < 1 || maxScoreNum > 100) {
    return NextResponse.json({ error: "max_score must be a whole number between 1 and 100" }, { status: 400 });
  }
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("criteria")
    .insert({ stage, name, category, prompt, max_score: maxScoreNum, sort_order })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_DASHBOARD_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const admin = supabaseAdmin();
  const { error } = await admin.from("criteria").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
