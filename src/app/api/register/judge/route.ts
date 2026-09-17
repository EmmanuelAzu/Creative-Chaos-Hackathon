import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { fullName, company, isIndependent, accessKey } = await req.json();

  if (accessKey !== process.env.JUDGE_ACCESS_KEY) {
    return NextResponse.json({ error: "Invalid access key" }, { status: 401 });
  }
  if (!fullName?.trim() || (!isIndependent && !company?.trim())) {
    return NextResponse.json({ error: "Name and company (or independent) are required" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("people")
    .insert({
      role: "judge",
      full_name: fullName.trim(),
      company: isIndependent ? null : company.trim(),
      is_independent: !!isIndependent,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
