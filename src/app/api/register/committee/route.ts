import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { fullName, portfolio, accessKey } = await req.json();

  if (accessKey !== process.env.COMMITTEE_ACCESS_KEY) {
    return NextResponse.json({ error: "Invalid access key" }, { status: 401 });
  }
  if (!fullName?.trim() || !portfolio?.trim()) {
    return NextResponse.json({ error: "Name and portfolio are required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("people")
    .insert({
      role: "committee",
      full_name: fullName.trim(),
      portfolio: portfolio.trim(),
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
