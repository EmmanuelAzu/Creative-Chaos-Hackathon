import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_DASHBOARD_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { stage }: { stage: "round1" | "final" } = await req.json();
  const admin = supabaseAdmin();

  if (stage === "round1") {
    await admin.from("scores").delete().neq("id", "");
    await admin.from("teams").update({ round1_rank: null }).neq("id", "");
    await admin.from("settings").update({ round1_reveal_step: 0 }).eq("id", true);
    return NextResponse.json({ reset: "round1" });
  }

  if (stage === "final") {
    await admin.from("final_votes").delete().neq("id", "");
    await admin.from("teams").update({ final_rank: null }).neq("id", "");
    await admin.from("settings").update({ reveal_step: 0 }).eq("id", true);
    return NextResponse.json({ reset: "final" });
  }

  return NextResponse.json({ error: "stage must be round1 or final" }, { status: 400 });
}
