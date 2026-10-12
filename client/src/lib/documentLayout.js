export const DEFAULT_PAGE_LAYOUT = { size: "letter", orientation: "portrait", margins: "normal" };
export const PAGE_SIZES = { letter: { label: "Letter", width: 816, height: 1056 }, a4: { label: "A4", width: 794, height: 1123 } };
export const PAGE_MARGINS = { normal: 96, narrow: 48, wide: 120 };
export const PAGE_GAP = 24;

export function normalizePageLayout(value = {}) {
  return {
    size: Object.hasOwn(PAGE_SIZES, value.size) ? value.size : DEFAULT_PAGE_LAYOUT.size,
    orientation: value.orientation === "landscape" ? "landscape" : "portrait",
    margins: Object.hasOwn(PAGE_MARGINS, value.margins) ? value.margins : DEFAULT_PAGE_LAYOUT.margins,
  };
}

export function pageDimensions(value) {
  const layout = normalizePageLayout(value);
  const size = PAGE_SIZES[layout.size];
  return {
    width: layout.orientation === "landscape" ? size.height : size.width,
    height: layout.orientation === "landscape" ? size.width : size.height,
    margin: PAGE_MARGINS[layout.margins],
    gap: PAGE_GAP,
  };
}

// Measurements are in unscaled editor pixels with existing pagination gaps
// removed. Pagination is a view decoration: it never rewrites shared content.
export function paginateBlocks(blocks, dimensions, docSize) {
  const { height, margin, gap } = dimensions;
  const stride = height + gap;
  const available = height - margin * 2;
  const breaks = [];
  const pages = [{ number: 1, from: 0 }];
  let offset = 0;
  let page = 0;

  function nextPage(pos, naturalTop, explicit = false, spacer = {}) {
    const top = naturalTop + offset;
    page++;
    const space = Math.max(0, page * stride + margin - top);
    breaks.push({ pos, height: space, explicit, ...spacer });
    offset += space;
    pages.push({ number: page + 1, from: explicit ? pos + 1 : pos });
  }

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    if (block.type === "pageBreak") {
      nextPage(block.pos, block.top, true);
      continue;
    }
    const blockHeight = block.bottom - block.top;
    const next = blocks[index + 1];
    const keepNext = block.type === "heading" && next && next.type !== "pageBreak" && next.bottom - block.top <= available;
    const layoutBottom = keepNext ? next.bottom : block.bottom;
    const bottom = page * stride + height - margin;
    if (blockHeight <= available && block.top + offset > page * stride + margin + 1 && layoutBottom + offset > bottom + 0.5) {
      nextPage(block.pos, block.top, false, block.spacer);
    } else if (blockHeight > available && block.lines?.length) {
      // Long paragraphs can span sheets without splitting the stored node.
      for (const line of block.lines) {
        if (line.bottom + offset > page * stride + height - margin + 0.5) nextPage(line.pos, line.top);
      }
    }
    // Oversized indivisible objects (e.g. a single tall table row) stay intact. Their
    // content remains accessible, and the navigator includes every sheet.
    while (block.bottom + offset > page * stride + height - margin + 0.5) {
      page++;
      pages.push({ number: page + 1, from: block.pos });
    }
  }
  return {
    breaks,
    pages: pages.map((p, i) => ({ ...p, to: pages[i + 1]?.from ?? docSize })),
  };
}

export function documentStats(editor) {
  const text = editor?.getText({ blockSeparator: "\n" }) || "";
  return { words: text.trim() ? text.trim().split(/\s+/u).length : 0, characters: text.length };
}
