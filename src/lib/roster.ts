import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

const PAGE_W = 595.28; // A4 portrait, points
const PAGE_H = 841.89;
const MARGIN = 56;
const INK = rgb(0x12 / 255, 0x14 / 255, 0x3d / 255);
const TEAL = rgb(0x12 / 255, 0x73 / 255, 0x6f / 255);
const MUTED = rgb(0.45, 0.47, 0.55);

interface RosterTeam {
  name: string;
  participants: string[]; // already sorted
}

/** A plain, always-current list of every team and its participants —
 * so someone who forgot exactly how their name/team was typed at
 * registration can look it up, independent of the certificate flow. */
export async function renderRosterPdf(teamsWithPeople: RosterTeam[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  const totalParticipants = teamsWithPeople.reduce((s, t) => s + t.participants.length, 0);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function newPage() {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  }

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) newPage();
  }

  function drawText(text: string, font: PDFFont, size: number, color = INK, x = MARGIN) {
    page.drawText(text, { x, y, size, font, color });
  }

  // ---------- header ----------
  drawText("CREATIVE CHAOS HACKATHON", bold, 20, INK);
  y -= 26;
  drawText("Participant Roster", regular, 13, TEAL);
  y -= 20;
  const generated = new Date().toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  drawText(
    `Generated ${generated} · ${teamsWithPeople.length} team${teamsWithPeople.length === 1 ? "" : "s"} · ${totalParticipants} participant${totalParticipants === 1 ? "" : "s"}`,
    regular,
    9,
    MUTED
  );
  y -= 24;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1,
    color: rgb(0.85, 0.86, 0.92),
  });
  y -= 22;

  // ---------- teams ----------
  for (const team of teamsWithPeople) {
    ensureSpace(20 + 16 * Math.max(team.participants.length, 1) + 10);

    drawText(team.name.toUpperCase(), bold, 12, INK);
    y -= 16;

    if (team.participants.length === 0) {
      drawText("(no participants registered)", regular, 10, MUTED, MARGIN + 14);
      y -= 15;
    } else {
      for (const name of team.participants) {
        ensureSpace(15);
        drawText(`• ${name}`, regular, 10.5, INK, MARGIN + 14);
        y -= 15;
      }
    }
    y -= 10;
  }

  if (teamsWithPeople.length === 0) {
    drawText("No teams have been imported yet.", regular, 11, MUTED);
  }

  return doc.save();
}
