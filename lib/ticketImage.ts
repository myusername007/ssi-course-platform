// Draws a ticket as a PNG in the browser. The QR code only identifies the
// ticket (number and event); it is NOT proof of ownership — the join link is
// issued by the server only after a signature from the owner's wallet
// (lib/access.ts). Nothing personal is drawn: no name, only the shortened
// wallet address.
import QRCode from "qrcode";

export interface TicketImageData {
  ticketId: number;
  eventId: number;
  title: string;
  when: string;
  where: string;
  owner: string;
}

const WIDTH = 1200;
const HEIGHT = 520;

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, "…");
    return kept;
  }
  return lines;
}

export async function renderTicketPng(d: TicketImageData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  ctx.fillStyle = "#f5f5f7";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(20, 20, WIDTH - 40, HEIGHT - 40, 36);
  ctx.fill();
  ctx.strokeStyle = "#d8d8dc";
  ctx.lineWidth = 2;
  ctx.stroke();

  // right: QR with a dashed tear-off line before it
  const qrSize = 340;
  const qrX = WIDTH - 60 - qrSize;
  const qrY = 90;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(qrX - 40, 50);
  ctx.lineTo(qrX - 40, HEIGHT - 50);
  ctx.stroke();
  ctx.setLineDash([]);

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, JSON.stringify({ v: 1, t: d.ticketId, e: d.eventId, c: 11155111 }), {
    width: qrSize,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
  ctx.fillStyle = "#6e6e73";
  ctx.font = `500 24px ${font}`;
  ctx.textAlign = "center";
  ctx.fillText(`Квиток №${d.ticketId}  ·  Подія №${d.eventId}`, qrX + qrSize / 2, qrY + qrSize + 44);
  ctx.textAlign = "left";

  // left: text
  const left = 70;
  const textWidth = qrX - 40 - left - 40;
  ctx.fillStyle = "#5b7fde";
  ctx.font = `600 24px ${font}`;
  ctx.fillText("КВИТОК НА ПОДІЮ", left, 95);

  ctx.fillStyle = "#1d1d1f";
  ctx.font = `700 46px ${font}`;
  const titleLines = wrapLines(ctx, d.title, textWidth, 3);
  titleLines.forEach((line, i) => ctx.fillText(line, left, 160 + i * 58));

  const infoY = 160 + titleLines.length * 58 + 30;
  ctx.fillStyle = "#6e6e73";
  ctx.font = `400 28px ${font}`;
  ctx.fillText(d.when, left, infoY);
  wrapLines(ctx, d.where, textWidth, 2).forEach((line, i) => ctx.fillText(line, left, infoY + 42 + i * 36));

  ctx.font = `400 22px ${font}`;
  ctx.fillText(`Sepolia  ·  власник ${d.owner.slice(0, 6)}…${d.owner.slice(-4)}`, left, HEIGHT - 60);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png")
  );
}
