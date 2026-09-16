import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Auto-distributes judges across teams: every team gets `judgesPerTeam` judges,
 * spread as evenly as possible round-robin. Re-running clears prior assignments
 * first, so it's safe to re-balance after late judge registrations.
 */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_DASHBOARD_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { judgesPerTeam = 3 }: { judgesPerTeam?: number } = await req
    .json()
    .catch(() => ({}));

  const admin = supabaseAdmin();
  const { data: judges } = await admin.from("people").select("id").eq("role", "judge");
  const { data: teams } = await admin.from("teams").select("id");

  if (!judges?.length || !teams?.length) {
    return NextResponse.json({ error: "Need at least one judge and one team" }, { status: 400 });
  }

  await admin.from("judge_assignments").delete().neq("judge_id", "");

  const rows: { judge_id: string; team_id: string }[] = [];
  teams.forEach((team, teamIdx) => {
    for (let i = 0; i < judgesPerTeam; i++) {
      const judge = judges[(teamIdx * judgesPerTeam + i) % judges.length];
      rows.push({ judge_id: judge.id, team_id: team.id });
    }
  });
  // de-dupe (small judge pools can otherwise assign the same judge twice to one team)
  const seen = new Set<string>();
  const deduped = rows.filter((r) => {
    const k = `${r.judge_id}:${r.team_id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const { error } = await admin.from("judge_assignments").insert(deduped);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignments: deduped.length, teams: teams.length, judges: judges.length });
}
