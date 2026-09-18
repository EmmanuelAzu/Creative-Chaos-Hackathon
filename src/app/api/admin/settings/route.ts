import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET has no dynamic function calls, so Next's Full Route Cache would
// otherwise cache the response indefinitely and never reflect later PATCHes.
export const dynamic = "force-dynamic";

function checkAuth(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  return key === process.env.ADMIN_DASHBOARD_KEY;
}

export async function GET() {
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("settings").select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("settings")
    .update(body)
    .eq("id", true)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
