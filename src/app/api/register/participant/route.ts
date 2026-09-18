import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/** Participant check-in no longer creates teams/people on the fly — both
 * must already exist from the pre-loaded roster. This just verifies the
 * access key and looks the pair up. */
export async function POST(req: NextRequest) {
  const { fullName, teamName, accessKey } = await req.json();

  if (accessKey !== process.env.PARTICIPANT_ACCESS_KEY) {
    return NextResponse.json({ error: "Invalid access key" }, { status: 401 });
  }
  if (!fullName?.trim() || !teamName?.trim()) {
    return NextResponse.json({ error: "Enter your name and your team name" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: team, error: teamErr } = await admin
    .from("teams")
    .select("id, name")
    .ilike("name", teamName.trim())
    .maybeSingle();
  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 });
  if (!team) {
    return NextResponse.json(
      { error: `We don't have a team called "${teamName.trim()}" — check the spelling with organizers.` },
      { status: 404 }
    );
  }

  const { data: person, error: personErr } = await admin
    .from("people")
    .select("id, full_name")
    .eq("role", "participant")
    .eq("team_id", team.id)
    .ilike("full_name", fullName.trim())
    .maybeSingle();
  if (personErr) return NextResponse.json({ error: personErr.message }, { status: 500 });
  if (!person) {
    return NextResponse.json(
      { error: `We don't have "${fullName.trim()}" down for team "${team.name}" — check with organizers.` },
      { status: 404 }
    );
  }

  return NextResponse.json({ id: person.id, teamId: team.id });
}
