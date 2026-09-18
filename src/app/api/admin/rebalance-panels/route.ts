import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const PANEL_SIZE = 3;

/** Recomputes every judge's panel from scratch so no panel ends up under
 * PANEL_SIZE — useful once all judges are in for the day, since the
 * fill-smallest-first assignment at registration can leave one short panel
 * if the final headcount isn't a multiple of PANEL_SIZE. */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_DASHBOARD_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: judges, error } = await admin
    .from("people")
    .select("id")
    .eq("role", "judge")
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (judges ?? []).map((j) => j.id);
  if (ids.length === 0) return NextResponse.json({ panels: 0, judges: 0 });

  const numPanels = Math.max(1, Math.floor(ids.length / PANEL_SIZE));
  const remainder = ids.length % PANEL_SIZE;

  let cursor = 0;
  for (let panel = 1; panel <= numPanels; panel++) {
    const size = PANEL_SIZE + (panel <= remainder ? 1 : 0);
    const panelIds = ids.slice(cursor, cursor + size);
    cursor += size;
    if (panelIds.length > 0) {
      await admin.from("people").update({ panel_number: panel }).in("id", panelIds);
    }
  }

  return NextResponse.json({ panels: numPanels, judges: ids.length });
}
