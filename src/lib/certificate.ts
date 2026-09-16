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
  const chakraSemi = await doc.embedFont(readPublic("fonts", "ChakraPetch-SemiBold.ttf"), { subset: true });
  // Rajdhani's glyph tables corrupt under pdf-lib's subsetter (multi-script font) — embed in full.
  const rajMed = await doc.embedFont(readPublic("fonts", "Rajdhani-Medium.ttf"), { subset: false });
  const rajSemi = await doc.embedFont(readPublic("fonts", "Rajdhani-SemiBold.ttf"), { subset: false });

  const white = hexToRgb(HEX.white);
  const muted = hexToRgb(HEX.muted);
  const cyan = hexToRgb(HEX.cyan);
  const accent = hexToRgb(tier.accentHex);

  // ---------- header: Wits Developer Society (left) + event mark (right) ----------
  try {
    const logoBytes = readPublic("logo-icon.png");
    const logo = await doc.embedPng(logoBytes);
    // chip in image-space px, converted to pt at draw time — chip spans imgX 90-210, imgY 60-180
    const chipTopLeft = pt(90, 60);
    const chipBottomRight = pt(210, 180);
    const chipW = chipBottomRight.x - chipTopLeft.x;
    const chipH = chipTopLeft.y - chipBottomRight.y;
    page.drawRectangle({ x: chipTopLeft.x, y: chipBottomRight.y, width: chipW, height: chipH, color: white });
    const iconPad = chipW * 0.16;
    const logoDim = logo.scale((chipW - iconPad * 2) / logo.width);
    page.drawImage(logo, {
      x: chipTopLeft.x + (chipW - logoDim.width) / 2,
      y: chipBottomRight.y + (chipH - logoDim.height) / 2,
      width: logoDim.width,
      height: logoDim.height,
    });
    drawText(page, "WITS DEVELOPER SOCIETY", pt(232, 100), 11, chakraSemi, white);
    drawTracked(page, "ORGANIZED BY", pt(232, 122), 7.5, rajSemi, cyan, 1.2);
  } catch {
    /* logo optional */
  }
  drawTextRight(page, "CREATIVE CHAOS HACKATHON 2026", pt(1890, 100), 10.5, chakraSemi, white);
  drawTextRight(page, "FINALS DAY · MSL", pt(1890, 122), 8, rajSemi, muted);

  // ---------- headline ----------
  const certer = pt(1000, 250);
  drawTrackedCentered(page, "CERTIFICATE", certer.x, certer.y, 34, chakraBold, white, 1.5);
  const suber = pt(1000, 345);
  drawTrackedCentered(page, tier.subtitle, suber.x, suber.y, 15, chakraSemi, cyan, 4);

  // ---------- body ----------
  const lead = pt(1000, 515);
  centerText(page, "This certifies that", lead.x, lead.y, 12.5, rajMed, muted);

  const namePt = pt(1000, 600);
  centerText(page, person.full_name.toUpperCase(), namePt.x, namePt.y, 30, chakraBold, accent);

  let cursorImgY = 655;
  if (team) {
    const teamPt = pt(1000, cursorImgY);
    centerText(page, `of team “${team.name}”`, teamPt.x, teamPt.y, 13, rajSemi, cyan);
    cursorImgY += 55;
  } else {
    cursorImgY += 10;
  }

  const bodySentence =
    person.role === "participant"
      ? `took part in the Creative Chaos Hackathon 2026 from the 13th to the 19th of September 2026, ${tier.resultLine}.`
      : `${tier.resultLine} at the Creative Chaos Hackathon 2026, held from the 13th to the 19th of September 2026.`;
  cursorImgY = wrapCentered(page, bodySentence, 1000, cursorImgY, 620, 11.5, rajMed, muted, 22);

  // ---------- seal ----------
  const sealCenterImgY = 890;
  const sealCenter = pt(1000, sealCenterImgY);
  const sealR = 30;
  page.drawCircle({ x: sealCenter.x, y: sealCenter.y, size: sealR, borderColor: cyan, borderWidth: 1, borderOpacity: 0.4 });
  page.drawCircle({ x: sealCenter.x, y: sealCenter.y, size: sealR - 8, borderColor: cyan, borderWidth: 0.6, borderOpacity: 0.25 });
  try {
    const kudu = await doc.embedPng(readPublic("logo-icon.png"));
    const badgeR = 24;
    page.drawCircle({ x: sealCenter.x, y: sealCenter.y, size: badgeR, color: white });
    const kd = kudu.scale((badgeR * 1.5) / kudu.width);
    page.drawImage(kudu, { x: sealCenter.x - kd.width / 2, y: sealCenter.y - kd.height / 2, width: kd.width, height: kd.height });
  } catch {
    /* optional */
  }
  const captionPt = pt(1000, 1000);
  drawTracked(
    page,
    "WITS DEVELOPER SOCIETY × CREATIVE CHAOS 2026 ORGANIZING COMMITTEE",
    { x: captionPt.x - trackedWidth("WITS DEVELOPER SOCIETY × CREATIVE CHAOS 2026 ORGANIZING COMMITTEE", 8.5, chakraSemi, 0.6) / 2, y: captionPt.y },
    8.5,
    chakraSemi,
    white,
    0.6
  );

  // ---------- sponsors ----------
  const labelPt = pt(1000, 1045);
  drawTracked(
    page,
    "WITH THANKS TO OUR SPONSORS",
    { x: labelPt.x - trackedWidth("WITH THANKS TO OUR SPONSORS", 9, chakraSemi, 1.2) / 2, y: labelPt.y },
    9,
    chakraSemi,
    muted,
    1.2
  );

  const sponsorFiles: { file: string; kind: "png" | "jpg" }[] = [
    { file: "sponsors/bbd.png", kind: "png" },
    { file: "sponsors/boxfusion.png", kind: "png" },
    { file: "sponsors/offerzen.jpg", kind: "jpg" },
    { file: "sponsors/enactus.png", kind: "png" },
  ];
  const targetH = 30;
  const gap = 22;
  const chipPad = 14;
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
  const totalW = embedded.reduce((s, e) => s + e.w + chipPad * 2, 0) + gap * Math.max(embedded.length - 1, 0);
  const rowCenter = pt(1000, 1110);
  let cursorX = rowCenter.x - totalW / 2;
  for (const e of embedded) {
    const chipW = e.w + chipPad * 2;
    page.drawRectangle({ x: cursorX, y: rowCenter.y - targetH / 2 - 10, width: chipW, height: targetH + 20, color: white });
    page.drawImage(e.img, { x: cursorX + chipPad, y: rowCenter.y - e.h / 2, width: e.w, height: e.h });
    cursorX += chipW + gap;
  }

  return doc.save();
}

function drawText(page: PDFPage, text: string, p: { x: number; y: number }, size: number, font: PDFFont, color: any) {
  page.drawText(text, { x: p.x, y: p.y, size, font, color });
}

function drawTextRight(page: PDFPage, text: string, p: { x: number; y: number }, size: number, font: PDFFont, color: any) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: p.x - w, y: p.y, size, font, color });
}

function centerText(page: PDFPage, text: string, cx: number, y: number, size: number, font: PDFFont, color: any) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color });
}

/** Draws text with manual letter-spacing (pdf-lib has no native tracking support). */
function drawTracked(page: PDFPage, text: string, p: { x: number; y: number }, size: number, font: PDFFont, color: any, tracking: number) {
  let x = p.x;
  for (const ch of text) {
    page.drawText(ch, { x, y: p.y, size, font, color });
    x += font.widthOfTextAtSize(ch, size) + tracking;
  }
}

function trackedWidth(text: string, size: number, font: PDFFont, tracking: number) {
  let w = 0;
  for (const ch of text) w += font.widthOfTextAtSize(ch, size) + tracking;
  return w - tracking;
}

function drawTrackedCentered(page: PDFPage, text: string, cx: number, y: number, size: number, font: PDFFont, color: any, tracking: number) {
  const w = trackedWidth(text, size, font, tracking);
  drawTracked(page, text, { x: cx - w / 2, y }, size, font, color, tracking);
}

/** Wraps a sentence to fit maxWidthPt (in image-space px), centered, returning the next free image-y. */
function wrapCentered(
  page: PDFPage,
  text: string,
  centerImgX: number,
  startImgY: number,
  maxWidthImg: number,
  size: number,
  font: PDFFont,
  color: any,
  lineHeightImg: number
): number {
  const words = text.split(" ");
  const maxWidthPt = maxWidthImg * SCALE;
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidthPt && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  let imgY = startImgY;
  for (const l of lines) {
    const p = pt(centerImgX, imgY);
    centerText(page, l, p.x, p.y, size, font, color);
    imgY += lineHeightImg;
  }
  return imgY;
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}
