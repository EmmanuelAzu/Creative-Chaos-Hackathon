import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { renderRosterPdf } from "@/lib/roster";

export const runtime = "nodejs";
// A GET handler with no dynamic function calls would otherwise be eligible
// for Next's Full Route Cache — meaning this could keep serving whichever
// roster snapshot it happened to render first, forever after. See the same
// fix on /api/certificate/[personId] for the full story.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_DASHBOARD_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: teams } = await admin.from("teams").select("id, name").order("name");
  const { data: participants } = await admin
    .from("people")
    .select("full_name, team_id")
    .eq("role", "participant")
    .order("full_name");

  const namesByTeam = new Map<string, string[]>();
  for (const p of (participants as { full_name: string; team_id: string | null }[]) ?? []) {
    if (!p.team_id) continue;
    namesByTeam.set(p.team_id, [...(namesByTeam.get(p.team_id) ?? []), p.full_name]);
  }

  const teamsWithPeople = ((teams as { id: string; name: string }[]) ?? []).map((t) => ({
    name: t.name,
    participants: namesByTeam.get(t.id) ?? [],
  }));

  const pdfBytes = await renderRosterPdf(teamsWithPeople);

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="participant-roster.pdf"`,
    },
  });
}
