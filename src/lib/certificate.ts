import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";
import path from "path";
import type { Person, Team } from "./types";
import { supabaseAdmin } from "./supabase";

export interface Tier {
  title: string; // e.g. "1st Place"
  medal?: "gold" | "silver" | "bronze";
  accentHex: string;
  resultLine: string; // sentence describing the achievement
}

const HEX = {
  gold: "#D4AF37",
  silver: "#C0C0C0",
  bronze: "#CD7F32",
  volt: "#B6FF3D",
  teal: "#12736F",
};

/** Works out what a participant's certificate should say, based on live standings. */
export async function resolveTier(person: Person): Promise<Tier> {
  if (person.role === "judge") {
    return {
      title: "Certificate of Appreciation",
      accentHex: HEX.teal,
      resultLine: "for generously giving their time and expertise as a judge",
    };
  }
  if (person.role === "committee") {
    return {
      title: "Certificate of Appreciation",
      accentHex: HEX.teal,
      resultLine: "for their contribution to organizing the event",
    };
  }

  const admin = supabaseAdmin();

  // Final stage rank takes priority — it's the result of the presentation & vote.
  if (person.team_id) {
    const { data: team } = await admin
      .from("teams")
      .select("final_rank")
      .eq("id", person.team_id)
      .maybeSingle();

    const rank = team?.final_rank as number | null | undefined;
    if (rank === 1) return { title: "1st Place", medal: "gold", accentHex: HEX.gold, resultLine: "for taking 1st place" };
    if (rank === 2) return { title: "2nd Place", medal: "silver", accentHex: HEX.silver, resultLine: "for taking 2nd place" };
    if (rank === 3) return { title: "3rd Place", medal: "bronze", accentHex: HEX.bronze, resultLine: "for taking 3rd place" };
    if (rank === 4) return { title: "4th Place", accentHex: HEX.volt, resultLine: "for reaching the final stage and placing 4th" };
    if (rank === 5) return { title: "5th Place", accentHex: HEX.volt, resultLine: "for reaching the final stage and placing 5th" };

    // Not in the final 5 — fall back to round-1 standing for a top-10 shout-out.
    const { data: ranked } = await admin
      .from("round1_team_scores")
      .select("team_id")
      .order("aggregate_score", { ascending: false, nullsFirst: false });
    const position = (ranked ?? []).findIndex((r) => r.team_id === person.team_id) + 1;
    if (position >= 6 && position <= 10) {
      return {
        title: "Top 10 Finalist",
        accentHex: HEX.teal,
        resultLine: "for placing in the top 10 teams",
      };
    }
  }

  return {
    title: "Certificate of Participation",
    accentHex: HEX.teal,
    resultLine: "for taking part and building something in the time given",
  };
}

function readPublic(...parts: string[]) {
  return fs.readFileSync(path.join(process.cwd(), "public", ...parts));
}

export async function renderCertificatePdf(
  person: Person,
  team: Team | null,
  tier: Tier
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([841.89, 595.28]); // A4 landscape
  const { width, height } = page.getSize();

  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const ink = rgb(0x12 / 255, 0x14 / 255, 0x3d / 255);
  const paper = rgb(0xf5 / 255, 0xf7 / 255, 0xf0 / 255);
  const accent = hexToRgb(tier.accentHex);

  // Background
  page.drawRectangle({ x: 0, y: 0, width, height, color: ink });
  // Inner border
  page.drawRectangle({
    x: 28,
    y: 28,
    width: width - 56,
    height: height - 56,
    borderColor: accent,
    borderWidth: 2,
  });
  // Accent bar under the header
  page.drawRectangle({ x: 28, y: height - 150, width: width - 56, height: 3, color: accent });

  // Kudu logo, top-left
  try {
    const logoBytes = readPublic("logo.png");
    const logo = await doc.embedPng(logoBytes);
    const logoDim = logo.scale(60 / logo.width);
    page.drawImage(logo, { x: 55, y: height - 115, width: logoDim.width, height: logoDim.height });
  } catch {
    /* logo optional */
  }

  page.drawText("CREATIVE CHAOS HACKATHON 2026", {
    x: 130,
    y: height - 75,
    size: 16,
    font: bold,
    color: paper,
  });
  page.drawText("Wits Developer Society \u2014 Finals Day, MSL", {
    x: 130,
    y: height - 95,
    size: 10,
    font: regular,
    color: paper,
    opacity: 0.7,
  });

  centerText(page, tier.title.toUpperCase(), height - 210, 30, bold, accent);

  centerText(page, "This certifies that", height - 260, 13, italic, paper, 0.75);
  centerText(page, person.full_name, height - 305, 34, bold, paper);

  if (team) {
    centerText(page, `of team "${team.name}"`, height - 335, 14, italic, paper, 0.85);
  }

  centerText(page, tier.resultLine, height - 375, 15, regular, paper);

  centerText(
    page,
    "19 September 2026",
    height - 440,
    11,
    regular,
    paper,
    0.6
  );

  // Sponsor logos along the bottom
  const sponsorFiles: { file: string; kind: "png" | "jpg" }[] = [
    { file: "sponsors/bbd.png", kind: "png" },
    { file: "sponsors/boxfusion.png", kind: "png" },
    { file: "sponsors/offerzen.jpg", kind: "jpg" },
  ];
  const targetH = 26;
  const gap = 28;
  const embedded: { img: any; w: number; h: number }[] = [];
  for (const s of sponsorFiles) {
    try {
      const bytes = readPublic(s.file);
      const img = s.kind === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const scale = targetH / img.height;
      embedded.push({ img, w: img.width * scale, h: targetH });
    } catch {
      /* skip missing sponsor asset */
    }
  }
  const totalW = embedded.reduce((s, e) => s + e.w, 0) + gap * (embedded.length - 1);
  let cursorX = width / 2 - totalW / 2;
  const sponsorY = 55;
  // white chip behind sponsor row for contrast on the navy background
  page.drawRectangle({
    x: cursorX - 16,
    y: sponsorY - 10,
    width: totalW + 32,
    height: targetH + 20,
    color: paper,
  });
  for (const e of embedded) {
    page.drawImage(e.img, { x: cursorX, y: sponsorY, width: e.w, height: e.h });
    cursorX += e.w + gap;
  }

  return doc.save();
}

function centerText(
  page: any,
  text: string,
  y: number,
  size: number,
  font: any,
  color: any,
  opacity = 1
) {
  const width = page.getSize().width;
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: width / 2 - textWidth / 2, y, size, font, color, opacity });
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}
