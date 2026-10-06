const EXTENSION_MIMES = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
};

export function previewMimeType(version) {
  const mime = (version?.mimeType || "").split(";")[0].trim().toLowerCase();
  const extension = version?.originalName?.split(".").pop().toLowerCase();
  return !mime || mime === "application/octet-stream" ? EXTENSION_MIMES[extension] || mime : mime;
}

const elements = (node, name) => Array.from(node.getElementsByTagNameNS("*", name));
const textRuns = (node) => elements(node, "t").map((item) => item.textContent).join("");

async function readXml(zip, path, optional = false) {
  const entry = zip.file(path);
  if (!entry) {
    if (optional) return null;
    throw new Error("This Office file is incomplete. Download it to view in its original app.");
  }
  const xml = await entry.async("string");
  if (xml.length > 10 * 1024 * 1024) throw new Error("This Office file is too large to preview. Please download it.");
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (elements(document, "parsererror").length) throw new Error("This Office file could not be previewed. Please download it.");
  return document;
}

function relatedPath(base, relationship) {
  if (!relationship || relationship.getAttribute("TargetMode") === "External") return null;
  const target = relationship.getAttribute("Target");
  const url = new URL(target, `https://office-preview.invalid/${base}`);
  return url.origin === "https://office-preview.invalid" ? decodeURIComponent(url.pathname.slice(1)) : null;
}

function relationshipMap(document) {
  return new Map(elements(document, "Relationship").map((node) => [node.getAttribute("Id"), node]));
}

function relationshipId(node) {
  return Array.from(node.attributes).find((attribute) => attribute.localName === "id" && attribute.namespaceURI?.endsWith("/relationships"))?.value;
}

export function columnName(index) {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}

function columnIndex(reference) {
  const letters = reference?.match(/^[A-Z]+/i)?.[0] || "A";
  return Array.from(letters.toUpperCase()).reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

export async function readOfficePreview(blob, type) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  if (type === "xlsx") {
    const workbook = await readXml(zip, "xl/workbook.xml");
    const relations = relationshipMap(await readXml(zip, "xl/_rels/workbook.xml.rels"));
    const stringsDocument = await readXml(zip, "xl/sharedStrings.xml", true);
    const strings = stringsDocument ? elements(stringsDocument, "si").map(textRuns) : [];
    const sheets = [];
    const allSheets = elements(workbook, "sheet");
    for (const sheet of allSheets.slice(0, 20)) {
      const relation = relations.get(relationshipId(sheet));
      if (!relation?.getAttribute("Type").endsWith("/worksheet")) continue;
      const path = relatedPath("xl/workbook.xml", relation);
      if (!path) continue;
      const document = await readXml(zip, path);
      const allRows = elements(document, "row");
      let columns = 0;
      let truncated = allRows.length > 200;
      const rows = allRows.slice(0, 200).map((row, rowIndex) => {
        const cells = [];
        for (const cell of elements(row, "c")) {
          const index = columnIndex(cell.getAttribute("r"));
          if (index >= 30) { truncated = true; continue; }
          const value = elements(cell, "v")[0]?.textContent || "";
          const formula = elements(cell, "f")[0]?.textContent;
          const type = cell.getAttribute("t");
          cells[index] = (type === "s" ? strings[Number(value)] || "" : type === "inlineStr" ? textRuns(cell) : type === "b" ? value === "1" ? "TRUE" : "FALSE" : value || (formula ? `=${formula}` : "")).slice(0, 10000);
          columns = Math.max(columns, index + 1);
        }
        return { number: row.getAttribute("r") || rowIndex + 1, cells };
      });
      sheets.push({ name: sheet.getAttribute("name") || `Sheet ${sheets.length + 1}`, rows, columns, truncated });
    }
    if (!sheets.length) throw new Error("No worksheets are available to preview. Please download this file.");
    return { type, sheets, truncated: allSheets.length > 20 };
  }
  const presentation = await readXml(zip, "ppt/presentation.xml");
  const relations = relationshipMap(await readXml(zip, "ppt/_rels/presentation.xml.rels"));
  const allSlides = elements(presentation, "sldId");
  const slides = [];
  for (const slide of allSlides.slice(0, 100)) {
    const path = relatedPath("ppt/presentation.xml", relations.get(relationshipId(slide)));
    if (!path) continue;
    const document = await readXml(zip, path);
    const paragraphs = elements(document, "p").map(textRuns).filter(Boolean).map((text) => text.slice(0, 10000));
    slides.push(paragraphs);
  }
  if (!slides.length) throw new Error("No slides are available to preview. Please download this file.");
  return { type, slides, truncated: allSlides.length > 100 };
}
