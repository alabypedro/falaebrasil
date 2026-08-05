import { jsPDF } from "jspdf";

export interface EvaluationPdfData {
  studentName?: string;
  toolLabel: string;
  dateLabel?: string;
  overallScore?: number | null;
  metrics?: Array<{ label: string; value: number }>;
  transcription?: string;
  sections?: Array<{ title: string; lines: string[] }>;
}

const NAVY = [16, 42, 85] as const;
const TEAL = [18, 168, 181] as const;
const GRAY = [85, 87, 93] as const;

function scoreColor(score: number): readonly [number, number, number] {
  if (score >= 80) return [22, 163, 74];
  if (score >= 60) return [202, 138, 4];
  if (score >= 40) return [234, 88, 12];
  return [220, 38, 38];
}

/** Gera o PDF da avaliação completa e devolve o Blob. */
export function buildEvaluationPdf(data: EvaluationPdfData): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensure = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Cabeçalho
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 88, "F");
  doc.setTextColor(...TEAL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("FALAE BRASIL", margin, 36);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Resultado da sua avaliacao", margin, 62);
  y = 120;

  // Intro
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const intro = `${data.studentName ? `Ola, ${data.studentName}! ` : "Ola! "}Relatorio completo da sua pratica em ${data.toolLabel}${
    data.dateLabel ? ` realizada em ${data.dateLabel}` : ""
  }.`;
  const introLines = doc.splitTextToSize(intro, contentW);
  doc.text(introLines, margin, y);
  y += introLines.length * 15 + 14;

  // Pontuação geral
  if (typeof data.overallScore === "number") {
    ensure(80);
    doc.setFillColor(241, 246, 251);
    doc.roundedRect(margin, y, contentW, 66, 10, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(122, 134, 153);
    doc.text("PONTUACAO GERAL", pageW / 2, y + 24, { align: "center" });
    doc.setFontSize(24);
    doc.setTextColor(...scoreColor(data.overallScore));
    doc.text(`${data.overallScore}/100`, pageW / 2, y + 52, { align: "center" });
    y += 84;
  }

  // Notas por critério
  if (data.metrics?.length) {
    const boxH = 34 + data.metrics.length * 20;
    ensure(boxH + 10);
    doc.setDrawColor(228, 234, 242);
    doc.roundedRect(margin, y, contentW, boxH, 10, 10, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text("NOTAS POR CRITERIO", margin + 16, y + 22);
    let ry = y + 44;
    data.metrics.forEach((m) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...GRAY);
      doc.text(m.label, margin + 16, ry);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...scoreColor(m.value));
      doc.text(String(m.value), pageW - margin - 16, ry, { align: "right" });
      ry += 20;
    });
    y += boxH + 14;
  }

  // Texto reconhecido
  if (data.transcription) {
    const lines = doc.splitTextToSize(`"${data.transcription}"`, contentW - 32);
    const boxH = 40 + lines.length * 15;
    ensure(boxH + 10);
    doc.setDrawColor(228, 234, 242);
    doc.roundedRect(margin, y, contentW, boxH, 10, 10, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text("TEXTO RECONHECIDO", margin + 16, y + 22);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(lines, margin + 16, y + 42);
    y += boxH + 14;
  }

  // Seções (sugestões etc.)
  (data.sections ?? []).forEach((s) => {
    const wrapped = s.lines.map((l) => doc.splitTextToSize(`- ${l}`, contentW - 32));
    const totalLines = wrapped.reduce((a, w) => a + w.length, 0);
    const boxH = 40 + totalLines * 15 + (s.lines.length - 1) * 6;
    ensure(boxH + 10);
    doc.setDrawColor(228, 234, 242);
    doc.roundedRect(margin, y, contentW, boxH, 10, 10, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text(s.title.toUpperCase(), margin + 16, y + 22);
    let ly = y + 42;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...GRAY);
    wrapped.forEach((w) => {
      doc.text(w, margin + 16, ly);
      ly += w.length * 15 + 6;
    });
    y += boxH + 14;
  });

  // Rodapé
  ensure(60);
  doc.setDrawColor(228, 234, 242);
  doc.line(margin, y, pageW - margin, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text("Continue praticando todos os dias em app.falaebrasil.com.br", margin, y);
  y += 15;
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(9);
  doc.text("Duvidas? atendimento@falaebrasil.com.br", margin, y);

  return doc.output("blob");
}
