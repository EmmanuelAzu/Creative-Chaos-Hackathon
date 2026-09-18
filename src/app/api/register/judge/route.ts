import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const PANEL_SIZE = 3;

/** Fills existing under-sized panels first, only starting a new one once every
 * panel has at least PANEL_SIZE judges — so at most one panel is ever short. */
async function assignPanel(admin: ReturnType<typeof supabaseAdmin>): Promise<number> {
  const { data: judges } = await admin
    .from("people")
    .select("panel_number")
    .eq("role", "judge")
    .not("panel_number", "is", null);

  const counts = new Map<number, number>();
  for (const j of judges ?? []) {
    const panel = j.panel_number as number;
    counts.set(panel, (counts.get(panel) ?? 0) + 1);
  }
  if (counts.size === 0) return 1;

  let smallestPanel = 1;
  let smallestCount = Infinity;
  for (const [panel, count] of counts) {
    if (count < smallestCount) {
      smallestCount = count;
      smallestPanel = panel;
    }
  }
  if (smallestCount < PANEL_SIZE) return smallestPanel;
  return Math.max(...counts.keys()) + 1;
}

export async function POST(req: NextRequest) {
  const { fullName, company, isIndependent, accessKey } = await req.json();

  if (accessKey !== process.env.JUDGE_ACCESS_KEY) {
    return NextResponse.json({ error: "Invalid access key" }, { status: 401 });
  }
  if (!fullName?.trim() || (!isIndependent && !company?.trim())) {
    return NextResponse.json({ error: "Name and company (or independent) are required" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Already registered under this exact name? Hand back their existing
  // identity instead of creating a duplicate judge (e.g. a lost session,
  // a double-submit, or a second device).
  const { data: existing } = await admin
    .from("people")
    .select("id, panel_number")
    .eq("role", "judge")
    .ilike("full_name", fullName.trim())
    .maybeSingle();
  if (existing) return NextResponse.json(existing);

  const panelNumber = await assignPanel(admin);
  const { data, error } = await admin
    .from("people")
    .insert({
      role: "judge",
      full_name: fullName.trim(),
      company: isIndependent ? null : company.trim(),
      is_independent: !!isIndependent,
      panel_number: panelNumber,
    })
    .select("id, panel_number")
    .single();

  if (error) {
    // Race: two near-simultaneous submissions for the same name — the
    // unique index caught it, so fetch and return the one that won.
    if (error.code === "23505") {
      const { data: winner } = await admin
        .from("people")
        .select("id, panel_number")
        .eq("role", "judge")
        .ilike("full_name", fullName.trim())
        .maybeSingle();
      if (winner) return NextResponse.json(winner);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
