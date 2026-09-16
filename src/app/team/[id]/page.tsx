import { supabaseAdmin } from "@/lib/supabase";
import { makeQrDataUrl } from "@/lib/qr";
import { PageShell } from "@/components/PageShell";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: { id: string } }) {
  const admin = supabaseAdmin();
  const { data: team } = await admin
    .from("teams")
    .select("id, name, qr_token")
    .eq("id", params.id)
    .maybeSingle();

  if (!team) notFound();

  const { data: members } = await admin
    .from("people")
    .select("id, full_name")
    .eq("team_id", team.id)
    .eq("role", "participant");

  const qrDataUrl = await makeQrDataUrl(
    JSON.stringify({ type: "team", teamId: team.id, token: team.qr_token })
  );

  return (
    <PageShell eyebrow="TEAM QR">
      <div className="max-w-md mx-auto text-center">
        <p className="font-mono text-xs text-teal mb-2">YOU'RE REGISTERED</p>
        <h1 className="text-3xl tracking-tight mb-1">{team.name}</h1>
        <p className="text-ink/60 mb-8">
          {members?.length ?? 0} member{members?.length === 1 ? "" : "s"} registered
        </p>

        <div className="border border-line bg-white p-8 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={`QR code for ${team.name}`} width={280} height={280} />
        </div>

        <p className="text-sm text-ink/60 mt-6 leading-relaxed">
          Print or screenshot this. A judge will scan it to pull up your team on
          their grading screen — no need to spell your team name out loud.
        </p>

        {members && members.length > 0 && (
          <ul className="mt-8 text-left border-t border-line pt-4 text-sm text-ink/70 flex flex-col gap-1">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between">
                <span>{m.full_name}</span>
                <a
                  href={`/api/certificate/${m.id}`}
                  className="font-mono text-xs text-teal hover:text-teal-deep"
                >
                  certificate ↓
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
