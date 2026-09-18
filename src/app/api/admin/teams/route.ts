import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/** Deletes a team AND its roster — a team with nobody on it isn't useful to
 * keep around, and leaving orphaned participants behind would just confuse
 * the "People" list. */
export async function DELETE(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_DASHBOARD_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id }: { id: string } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const admin = supabaseAdmin();
  const { error: peopleErr } = await admin.from("people").delete().eq("team_id", id);
  if (peopleErr) return NextResponse.json({ error: peopleErr.message }, { status: 500 });

  const { error: teamErr } = await admin.from("teams").delete().eq("id", id);
  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 });

  return NextResponse.json({ deleted: id });
}
