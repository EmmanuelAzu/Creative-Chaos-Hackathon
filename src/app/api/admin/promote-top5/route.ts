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
    // Score first, alphabetical always breaks ties — otherwise Postgres's
    // order for equal (or all-null, e.g. right after a reset) scores is
    // undefined, so it can silently disagree with what every live view
    // already shows.
    .order("aggregate_score", { ascending: false, nullsFirst: false })
    .order("team_name", { ascending: true })
    .limit(5);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: clearErr } = await admin.from("teams").update({ is_top5: false }).not("id", "is", null);
  if (clearErr) return NextResponse.json({ error: clearErr.message }, { status: 500 });
  const ids = (ranked ?? []).map((r) => r.team_id);
  if (ids.length > 0) {
    const { error: setErr } = await admin.from("teams").update({ is_top5: true }).in("id", ids);
    if (setErr) return NextResponse.json({ error: setErr.message }, { status: 500 });
  }
  return NextResponse.json({ promoted: ids.length, teamIds: ids });
}
