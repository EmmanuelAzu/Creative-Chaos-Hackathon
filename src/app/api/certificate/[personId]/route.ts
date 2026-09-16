import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveTier, renderCertificatePdf } from "@/lib/certificate";
import type { Person, Team } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { personId: string } }
) {
  const admin = supabaseAdmin();
  const { data: person } = await admin
    .from("people")
    .select("*")
    .eq("id", params.personId)
    .maybeSingle();

  if (!person) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let team: Team | null = null;
  if ((person as Person).team_id) {
    const { data: t } = await admin
      .from("teams")
      .select("*")
      .eq("id", (person as Person).team_id!)
      .maybeSingle();
    team = (t as Team) ?? null;
  }

  const tier = await resolveTier(person as Person);
  const pdfBytes = await renderCertificatePdf(person as Person, team, tier);

  const fileName = `${(person as Person).full_name.replace(/\s+/g, "_")}_certificate.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
