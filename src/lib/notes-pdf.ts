import { PAGE_RATIO, paintStrokes, type Stroke } from "@/components/HandwritingCanvas";

export type NotePage = { strokes: Stroke[]; text?: string };

/** Rendert Notizseiten (Vektor-Striche + Fließtext) als mehrseitiges A4-PDF. */
export async function notesToPdfBlob(pages: NotePage[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();

  const w = 1240;
  const h = Math.round(w * PAGE_RATIO);

  for (let i = 0; i < Math.max(pages.length, 1); i++) {
    if (i > 0) pdf.addPage();
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      paintStrokesOnWhite(ctx, pages[i]?.strokes ?? [], w, h);
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pw, ph);
    }

    const text = pages[i]?.text?.trim();
    if (text) {
      pdf.addPage();
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);
      const lines = pdf.splitTextToSize(text, pw - 30) as string[];
      let y = 20;
      for (const line of lines) {
        if (y > ph - 20) {
          pdf.addPage();
          y = 20;
        }
        pdf.text(line, 15, y);
        y += 6;
      }
    }
  }

  return pdf.output("blob");
}


/** paintStrokes löscht den Hintergrund – deshalb erst zeichnen, dann weiß unterlegen. */
function paintStrokesOnWhite(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  w: number,
  h: number,
) {
  paintStrokes(ctx, strokes, w, h);
  ctx.save();
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
