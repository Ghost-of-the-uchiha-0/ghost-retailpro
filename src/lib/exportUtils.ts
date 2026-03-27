import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportToCSV(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

export function exportToPDF(
  title: string,
  filename: string,
  headers: string[],
  rows: string[][],
  summaryLines?: string[]
) {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text(title, 14, 20);

  // Date
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);

  // Table
  autoTable(doc, {
    startY: 35,
    head: [headers],
    body: rows,
    theme: "grid",
    headStyles: {
      fillColor: [51, 51, 51],
      textColor: [255, 215, 0],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    styles: { fontSize: 9 },
  });

  // Summary
  if (summaryLines?.length) {
    const finalY = (doc as any).lastAutoTable?.finalY ?? 50;
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    summaryLines.forEach((line, i) => {
      doc.text(line, 14, finalY + 10 + i * 7);
    });
  }

  doc.save(`${filename}.pdf`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
