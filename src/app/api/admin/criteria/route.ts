import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== process.env.ADMIN_DASHBOARD_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { stage, name, max_score = 10, sort_order = 0 } = await req.json();
  if (!stage || !name) {
    return NextResponse.json({ error: "stage and name are required" }, { status: 400 });
  }
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("criteria")
    .insert({ stage, name, max_score, sort_order })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
