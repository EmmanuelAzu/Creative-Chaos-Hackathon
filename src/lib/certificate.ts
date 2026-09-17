import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import type { Person, Team } from "./types";
import { supabaseAdmin } from "./supabase";

export interface Tier {
  title: string; // e.g. "1st Place" — used for the certificate's admin-facing label
  subtitle: string; // e.g. "1ST PLACE" — the short line under "CERTIFICATE" on the PDF
  accentHex: string;
  resultLine: string; // clause describing the achievement, appended to the body sentence
}

const HEX = {
  gold: "#D4AF37",
  silver: "#C0C0C0",
  bronze: "#CD7F32",
  volt: "#B6FF3D",
  cyan: "#29D9EA",
  orange: "#F2A93C",
  white: "#F2F5F4",
  muted: "#B7BDC6",
};

const PLACE_WORDS = ["", "1ST", "2ND", "3RD", "4TH", "5TH"];
const PLACE_WORDS_TITLE = ["", "1st", "2nd", "3rd", "4th", "5th"];

/** Works out what a person's certificate should say, based on live standings. */
export async function resolveTier(person: Person): Promise<Tier> {
  if (person.role === "judge") {
    return {
      title: "Certificate of Appreciation",
      subtitle: "OF APPRECIATION",
      accentHex: HEX.orange,
      resultLine: "gave their time and expertise as a judge",
    };
  }
  if (person.role === "committee") {
    return {
      title: "Certificate of Appreciation",
      subtitle: "OF APPRECIATION",
      accentHex: HEX.orange,
      resultLine: "helped organize and run the event",
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
    if (rank && rank >= 1 && rank <= 5) {
      const accent = rank === 1 ? HEX.gold : rank === 2 ? HEX.silver : rank === 3 ? HEX.bronze : HEX.volt;
      return {
        title: `${PLACE_WORDS_TITLE[rank]} Place`,
        subtitle: `${PLACE_WORDS[rank]} PLACE`,
        accentHex: accent,
        resultLine: `and placed ${PLACE_WORDS[rank].toLowerCase()} in the final round`,
      };
    }

    // Not in the final 5 — fall back to round-1 standing for a top-10 shout-out.
    const { data: ranked } = await admin
      .from("round1_team_scores")
      .select("team_id")
      .order("aggregate_score", { ascending: false, nullsFirst: false });
    const position = (ranked ?? []).findIndex((r) => r.team_id === person.team_id) + 1;
    if (position >= 6 && position <= 10) {
      return {
        title: "Top 10 Finalist",
        subtitle: "TOP 10 FINALIST",
        accentHex: HEX.volt,
        resultLine: "placing in the top 10 teams of round one",
      };
    }
  }

  return {
    title: "Certificate of Participation",
    subtitle: "OF PARTICIPATION",
    accentHex: HEX.orange,
    resultLine: "building something real in a room full of people doing the same",
  };
}

function readPublic(...parts: string[]) {
  return fs.readFileSync(path.join(process.cwd(), "public", ...parts));
}

// The template PNG is 2000x1414 — an A4-landscape ratio, same as the page below.
const IMG_W = 2000;
const IMG_H = 1414;
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const SCALE = PAGE_W / IMG_W;

/** Converts a coordinate measured on the 2000x1414 template PNG into PDF points. */
function pt(imgX: number, imgY: number) {
  return { x: imgX * SCALE, y: PAGE_H - imgY * SCALE };
}

// The two placeholder fields baked into the template ("NAME SURNAME" and
// "team name") measured on the 2000x1414 template PNG (image-space px).
// ERASE covers the placeholder text (plus a small margin) so it can be
// painted over before the real value is drawn in the same spot.
const NAME_ERASE = { x0: 600, y0: 560, x1: 1450, y1: 700 };
const NAME_CENTER_X = 1022;
const NAME_BASELINE_Y = 668;
const TEAM_ERASE = { x0: 650, y0: 745, x1: 1370, y1: 797 };
const TEAM_CENTER_X = 1010;
const TEAM_BASELINE_Y = 790;
// Sampled from the template's background right around both placeholders.
const ERASE_FILL = rgb(0 / 255, 5 / 255, 11 / 255);

export async function renderCertificatePdf(
  person: Person,
  team: Team | null,
  tier: Tier
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const page = doc.addPage([PAGE_W, PAGE_H]);

  const bg = await doc.embedPng(readPublic("certificate-bg.png"));
  page.drawImage(bg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  const chakraBold = await doc.embedFont(readPublic("fonts", "ChakraPetch-Bold.ttf"), { subset: true });
  // Rajdhani's glyph tables corrupt under pdf-lib's subsetter (multi-script font) — embed in full.
  const rajSemi = await doc.embedFont(readPublic("fonts", "Rajdhani-SemiBold.ttf"), { subset: false });

  const cyan = hexToRgb(HEX.cyan);
  const accent = hexToRgb(tier.accentHex);

  // ---------- name ----------
  eraseImgRect(page, NAME_ERASE);
  const namePt = pt(NAME_CENTER_X, NAME_BASELINE_Y);
  const nameMaxWidthPt = (NAME_ERASE.x1 - NAME_ERASE.x0) * SCALE * 0.94;
  drawFitCentered(page, person.full_name.toUpperCase(), namePt.x, namePt.y, 31.5, chakraBold, accent, nameMaxWidthPt);

  // ---------- team ----------
  eraseImgRect(page, TEAM_ERASE);
  if (team) {
    const teamPt = pt(TEAM_CENTER_X, TEAM_BASELINE_Y);
    const teamMaxWidthPt = (TEAM_ERASE.x1 - TEAM_ERASE.x0) * SCALE * 0.94;
    drawFitCentered(page, `Of team “${team.name}”`, teamPt.x, teamPt.y, 14.5, rajSemi, cyan, teamMaxWidthPt);
  }

  return doc.save();
}

/** Paints over a region of the template (image-space px) with the sampled background fill. */
function eraseImgRect(page: PDFPage, rect: { x0: number; y0: number; x1: number; y1: number }) {
  const topLeft = pt(rect.x0, rect.y0);
  const bottomRight = pt(rect.x1, rect.y1);
  page.drawRectangle({
    x: topLeft.x,
    y: bottomRight.y,
    width: bottomRight.x - topLeft.x,
    height: topLeft.y - bottomRight.y,
    color: ERASE_FILL,
  });
}

/** Centered text that shrinks to fit maxWidthPt, so long names/team names never overflow the template's placeholder box. */
function drawFitCentered(
  page: PDFPage,
  text: string,
  cx: number,
  y: number,
  startSize: number,
  font: PDFFont,
  color: any,
  maxWidthPt: number
) {
  let size = startSize;
  while (font.widthOfTextAtSize(text, size) > maxWidthPt && size > 8) size -= 0.5;
  centerText(page, text, cx, y, size, font, color);
}

function centerText(page: PDFPage, text: string, cx: number, y: number, size: number, font: PDFFont, color: any) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color });
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}
