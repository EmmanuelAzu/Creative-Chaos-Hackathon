import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_DASHBOARD_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = supabaseAdmin();
  const { data: ranked, error } = await admin
    .from("round1_team_scores")
    .select("team_id, aggregate_score")
    .order("aggregate_score", { ascending: false, nullsFirst: false })
    .limit(5);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("teams").update({ is_top5: false }).neq("id", "");
  const ids = (ranked ?? []).map((r) => r.team_id);
  if (ids.length > 0) {
    await admin.from("teams").update({ is_top5: true }).in("id", ids);
  }
  return NextResponse.json({ promoted: ids.length, teamIds: ids });
}
