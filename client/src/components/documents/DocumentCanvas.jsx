import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent } from "@tiptap/react";
import { FilePlus2, PanelLeft, Plus, Settings2, X } from "lucide-react";
import { documentStats, pageDimensions, PAGE_SIZES } from "../../lib/documentLayout.js";
import FindReplacePanel from "./FindReplacePanel.jsx";

export default function DocumentCanvas({ editor, pages, layout, pageless, columns, mode, findReplaceOpen, onCloseFindReplace, onPageSetup, onAddPage }) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [tab, setTab] = useState("pages");
  const [zoom, setZoom] = useState("fit");
  const [availableWidth, setAvailableWidth] = useState(900);
  const [activePage, setActivePage] = useState(1);
  const scrollRef = useRef(null);
  const stackRef = useRef(null);
  const dims = pageDimensions(layout);
  const stride = dims.height + dims.gap;
  const totalHeight = pages.length * stride - dims.gap;
  const effectiveZoom = pageless ? 1 : zoom === "fit" ? Math.min(1, Math.max(0.2, (availableWidth - 32) / dims.width)) : Number(zoom) / 100;
  const editable = mode !== "viewing";
  const stats = documentStats(editor);
  const headings = [];
  editor?.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") headings.push({ pos, level: node.attrs.level, text: node.textContent });
  });

  useEffect(() => {
    if (!scrollRef.current) return;
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width));
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

  const updateActivePage = useCallback(() => {
    const scroll = scrollRef.current;
    const stack = stackRef.current;
    if (!scroll || !stack) return;
    const top = scroll.getBoundingClientRect().top - stack.getBoundingClientRect().top;
    setActivePage(Math.min(pages.length, Math.max(1, Math.floor((top + 60) / (stride * effectiveZoom)) + 1)));
  }, [pages.length, stride, effectiveZoom]);
  useEffect(() => {
    updateActivePage();
    editor?.on("selectionUpdate", updateActivePage);
    return () => editor?.off("selectionUpdate", updateActivePage);
  }, [editor, updateActivePage]);

  function goToPage(index) {
    const scroll = scrollRef.current;
    const stack = stackRef.current;
    if (!scroll || !stack) return;
    const top = stack.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
    scroll.scrollTo({ top: top + index * stride * effectiveZoom - 16, behavior: "smooth" });
    setActivePage(index + 1);
  }

  function addPage() {
    if (!editable || !editor) return;
    editor.chain().addPage().run();
    onAddPage?.();
  }

  return (
    <>
      <div className="relative flex min-h-0 flex-1">
        {navigationOpen && (
          <aside aria-label="Document navigation" className="w-48 shrink-0 overflow-y-auto border-r border-ink-200 bg-white p-3 dark:border-ink-700 dark:bg-ink-900 max-sm:absolute max-sm:inset-y-0 max-sm:left-0 max-sm:z-20 max-sm:shadow-panel print:hidden">
            <div className="mb-3 flex items-center justify-between text-xs font-medium text-ink-400"><span>Navigation</span><button onClick={() => setNavigationOpen(false)} aria-label="Close document navigation" className="rounded p-1 hover:bg-ink-100 dark:hover:bg-ink-800"><X className="h-3.5 w-3.5" /></button></div>
            <div className="mb-3 flex gap-1" role="tablist" aria-label="Document navigation">
              {["pages", "outline"].map((value) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${tab === value ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "text-ink-500"}`}>{value === "pages" ? "Pages" : "Outline"}</button>)}
            </div>
            {tab === "pages" ? pageless ? <p className="text-xs text-ink-400">Switch to page view to navigate sheets.</p> : <div className="space-y-2">
              {pages.map((page, index) => <button key={page.number} onClick={() => goToPage(index)} aria-current={activePage === page.number ? "page" : undefined} className={`w-full rounded-lg border p-3 text-left transition-colors ${activePage === page.number ? "border-brand-400 bg-brand-50 dark:bg-brand-500/10" : "border-ink-200 hover:border-brand-300 dark:border-ink-700"}`}><span className="block text-xs font-semibold text-ink-600 dark:text-ink-200">Page {page.number}</span><span className="mt-1 block truncate text-[11px] text-ink-400">{editor?.state.doc.textBetween(page.from, page.to, " ").trim() || "Blank page"}</span></button>)}
              {editable && <button onClick={addPage} className="btn-secondary w-full !px-2 !py-2 !text-xs"><Plus className="h-3.5 w-3.5" />Add page</button>}
            </div> : headings.length ? <nav aria-label="Document outline" className="space-y-1">{headings.map((heading) => <button key={heading.pos} onClick={() => editor.chain().focus().setTextSelection(heading.pos + 1).scrollIntoView().run()} className="block w-full truncate rounded-md py-1.5 pr-2 text-left text-xs text-ink-500 hover:bg-ink-50 dark:hover:bg-ink-800" style={{ paddingLeft: (heading.level - 1) * 12 + 4 }}>{heading.text || "Untitled heading"}</button>)}</nav> : <p className="text-xs leading-relaxed text-ink-400">Add headings to build your document outline.</p>}
          </aside>
        )}
        <div ref={scrollRef} onScroll={updateActivePage} className={`doc-scroll relative min-w-0 flex-1 overflow-auto overscroll-contain ${pageless ? "bg-white dark:bg-ink-800" : "bg-ink-100 dark:bg-ink-950"}`}>
          {findReplaceOpen && <FindReplacePanel editor={editor} onClose={onCloseFindReplace} />}
          <div className={`doc-canvas ${pageless ? "doc-canvas-pageless" : ""}`}>
            <div ref={stackRef} className={`doc-paper-stack ${pageless ? "doc-pageless" : ""}`} style={pageless ? undefined : { width: dims.width, minHeight: totalHeight, zoom: effectiveZoom, "--doc-margin": `${dims.margin}px` }}>
              {!pageless && <div className="doc-sheets" aria-hidden="true">{pages.map((page, index) => <div key={page.number} className="doc-sheet" style={{ top: index * stride, height: dims.height }}><span className="doc-sheet-number">{page.number}</span></div>)}</div>}
              <div className="doc-editor-content" style={pageless && columns > 1 ? { columnCount: columns, columnGap: "2.5rem" } : undefined}><EditorContent editor={editor} /></div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-ink-200 bg-white px-3 py-2 text-xs text-ink-500 dark:border-ink-700 dark:bg-ink-900 print:hidden">
        <button onClick={() => setNavigationOpen((value) => !value)} aria-label="Toggle document navigation" aria-expanded={navigationOpen} title="Pages and outline" className={`rounded p-1 hover:bg-ink-100 dark:hover:bg-ink-800 ${navigationOpen ? "text-brand-600" : ""}`}><PanelLeft className="h-4 w-4" /></button>
        <span>{pageless ? "Pageless" : `Page ${activePage} of ${pages.length}`}</span>
        <span className="hidden sm:inline">{stats.words.toLocaleString()} words</span>
        {editable && <button onClick={addPage} className="flex items-center gap-1.5 font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"><FilePlus2 className="h-3.5 w-3.5" />Add page</button>}
        <div className="ml-auto flex items-center gap-3">
          {editable && <button onClick={onPageSetup} className="flex items-center gap-1.5 hover:text-ink-800 dark:hover:text-ink-200" title="Page setup" aria-label="Page setup"><Settings2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">{PAGE_SIZES[layout.size].label} · {layout.orientation}</span></button>}
          {!pageless && <select aria-label="Document zoom" className="rounded border border-ink-200 bg-transparent px-1.5 py-1 dark:border-ink-700" value={zoom} onChange={(e) => setZoom(e.target.value)}><option value="fit">Fit width</option>{[50, 75, 100, 125, 150].map((value) => <option key={value} value={value}>{value}%</option>)}</select>}
        </div>
      </div>
    </>
  );
}
