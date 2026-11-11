// A 6-page test PDF; page 2 has a link to https://example.com/clicked near the bottom.
export function samplePdf(pages = 6) {
  const objs = new Map();
  objs.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objs.set(2, `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${pages} >>`);
  const font = 3 + pages * 2;
  const annot = font + 1;
  for (let i = 0; i < pages; i++) {
    const p = 3 + i * 2;
    const extra = i === 1 ? ` /Annots [${annot} 0 R]` : "";
    objs.set(p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 595] /Contents ${p + 1} 0 R /Resources << /Font << /F1 ${font} 0 R >> >>${extra} >>`);
    const stream = `BT /F1 120 Tf 150 260 Td (${i + 1}) Tj ET BT /F1 14 Tf 40 60 Td (Test page ${i + 1} - link on page 2) Tj ET`;
    objs.set(p + 1, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  objs.set(font, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objs.set(annot, "<< /Type /Annot /Subtype /Link /Rect [40 50 380 80] /Border [0 0 0] /A << /S /URI /URI (https://example.com/clicked) >> >>");

  let out = "%PDF-1.4\n";
  const offsets = [];
  for (const k of [...objs.keys()].sort((a, b) => a - b)) {
    offsets[k] = out.length;
    out += `${k} 0 obj\n${objs.get(k)}\nendobj\n`;
  }
  const xref = out.length;
  const n = Math.max(...objs.keys()) + 1;
  out += `xref\n0 ${n}\n0000000000 65535 f \n`;
  for (let k = 1; k < n; k++) out += `${String(offsets[k]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
