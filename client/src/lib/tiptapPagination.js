import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { pageDimensions, paginateBlocks } from "./documentLayout.js";

const paginationKey = new PluginKey("documentPagination");

function decorationsFor(doc, breaks) {
  return DecorationSet.create(doc, breaks.map((item) => {
    if (item.explicit) return Decoration.node(item.pos, item.pos + 1, { style: `height:${item.height}px` });
    return Decoration.widget(item.pos, () => {
      const spacer = document.createElement(item.tag || "span");
      spacer.className = "doc-pagination-gap";
      if (item.tag === "tr") {
        spacer.classList.add("doc-pagination-gap-row");
        const cell = document.createElement("td");
        cell.colSpan = item.columns;
        spacer.appendChild(cell);
      }
      if (item.tag === "li") {
        spacer.style.listStyle = "none";
        spacer.style.counterIncrement = "list-item 0";
      }
      spacer.style.height = `${item.height}px`;
      spacer.contentEditable = "false";
      spacer.setAttribute("aria-hidden", "true");
      return spacer;
    }, { side: -1, key: `page-${item.pos}-${item.height}`, ignoreSelection: true });
  }));
}

export const Pagination = Extension.create({
  name: "pagination",
  addOptions() { return { layout: {}, enabled: true, onPaginate: () => {} }; },
  addStorage() { return { layout: this.options.layout, enabled: this.options.enabled }; },
  addCommands() {
    return {
      setPageLayout: (layout, enabled = true) => ({ tr, dispatch }) => {
        if (dispatch) {
          this.storage.layout = layout;
          this.storage.enabled = enabled;
          tr.setMeta(paginationKey, { reset: true }).setMeta("addToHistory", false);
        }
        return true;
      },
    };
  },
  addProseMirrorPlugins() {
    const extension = this;
    return [new Plugin({
      key: paginationKey,
      state: {
        init: () => ({ decorations: DecorationSet.empty, breaks: [] }),
        apply(tr, value) {
          const meta = tr.getMeta(paginationKey);
          if (meta?.reset) return { decorations: DecorationSet.empty, breaks: [] };
          if (meta?.breaks) return { decorations: decorationsFor(tr.doc, meta.breaks), breaks: meta.breaks };
          if (!tr.docChanged) return value;
          return {
            decorations: value.decorations.map(tr.mapping, tr.doc),
            breaks: value.breaks.map((b) => ({ ...b, pos: tr.mapping.map(b.pos, -1) })),
          };
        },
      },
      props: { decorations: (state) => paginationKey.getState(state).decorations },
      view(view) {
        let frame;
        let destroyed = false;
        let lastReport = "";
        let composing = false;
        const schedule = () => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(measure);
        };
        const onCompositionStart = () => { composing = true; };
        const onCompositionEnd = () => { composing = false; schedule(); };
        function measure() {
          if (destroyed || composing || view.composing) return;
          const dims = pageDimensions(extension.storage.layout);
          const previous = paginationKey.getState(view.state).breaks;
          const rootRect = view.dom.getBoundingClientRect();
          const scale = rootRect.width / view.dom.offsetWidth || 1;
          const naturalY = (y, pos) => (y - rootRect.top) / scale - previous.filter((b) => b.pos <= pos).reduce((sum, b) => sum + b.height, 0);
          const blocks = [];
          function measureNode(node, pos, spacer) {
            const dom = view.nodeDOM(pos);
            if (!dom?.getBoundingClientRect) return;
            const rect = dom.getBoundingClientRect();
            const explicit = node.type.name === "pageBreak";
            // A page break's own height belongs after its starting position.
            const top = naturalY(rect.top, pos) + (explicit ? previous.find((b) => b.pos === pos)?.height || 0 : 0);
            const block = { pos, top, bottom: naturalY(rect.bottom, pos + node.nodeSize - 1), type: node.type.name };
            // Tables flow by rows and long lists by items. Use a valid spacer
            // element for each parent, keeping table/list content unchanged.
            if (node.type.name === "table") {
              const columns = node.firstChild ? Array.from({ length: node.firstChild.childCount }, (_, i) => node.firstChild.child(i).attrs.colspan || 1).reduce((sum, count) => sum + count, 0) : 1;
              node.forEach((row, rowOffset) => measureNode(row, pos + 1 + rowOffset, { tag: "tr", columns }));
              return;
            }
            const container = ["bulletList", "orderedList", "taskList", "blockquote", "listItem", "taskItem"].includes(node.type.name);
            if (container && block.bottom - block.top > dims.height - dims.margin * 2) {
              node.forEach((child, childOffset) => measureNode(child, pos + 1 + childOffset, child.type.name === "listItem" || child.type.name === "taskItem" ? { tag: "li" } : undefined));
              return;
            }
            if (spacer) block.spacer = spacer;
            if (node.isTextblock && block.bottom - block.top > dims.height - dims.margin * 2) {
              const lines = [];
              let lastTop = -Infinity;
              // Check word starts, keeping work proportional to text length.
              const starts = [pos + 1];
              node.descendants((child, childPos) => {
                if (child.isText) {
                  starts.push(pos + 1 + childPos);
                  for (const match of child.text.matchAll(/\s+\S/gu)) starts.push(pos + 1 + childPos + match.index + match[0].length - 1);
                }
              });
              for (const linePos of starts) {
                const coords = view.coordsAtPos(linePos, 1);
                const lineTop = naturalY(coords.top, linePos);
                if (Math.abs(lineTop - lastTop) > 1) {
                  lines.push({ pos: linePos, top: lineTop, bottom: naturalY(coords.bottom, linePos) });
                  lastTop = lineTop;
                }
              }
              block.lines = lines;
            }
            blocks.push(block);
          }
          view.state.doc.forEach((node, pos) => measureNode(node, pos));
          const result = extension.storage.enabled ? paginateBlocks(blocks, dims, view.state.doc.content.size) : { breaks: [], pages: [{ number: 1, from: 0, to: view.state.doc.content.size }] };
          const signature = JSON.stringify(result.breaks);
          if (signature !== JSON.stringify(previous)) {
            view.dispatch(view.state.tr.setMeta(paginationKey, { breaks: result.breaks }).setMeta("addToHistory", false));
          }
          const report = JSON.stringify(result.pages);
          if (report !== lastReport) {
            lastReport = report;
            extension.options.onPaginate(result.pages);
          }
        }
        const resize = new ResizeObserver(schedule);
        resize.observe(view.dom);
        view.dom.addEventListener("load", schedule, true);
        view.dom.addEventListener("compositionstart", onCompositionStart);
        view.dom.addEventListener("compositionend", onCompositionEnd);
        document.fonts?.ready.then(() => { if (!destroyed) schedule(); });
        schedule();
        return {
          update(current, previousState) {
            if (current.state.doc !== previousState.doc || paginationKey.getState(current.state) !== paginationKey.getState(previousState)) schedule();
          },
          destroy() {
            destroyed = true;
            cancelAnimationFrame(frame);
            resize.disconnect();
            view.dom.removeEventListener("load", schedule, true);
            view.dom.removeEventListener("compositionstart", onCompositionStart);
            view.dom.removeEventListener("compositionend", onCompositionEnd);
          },
        };
      },
    })];
  },
});
