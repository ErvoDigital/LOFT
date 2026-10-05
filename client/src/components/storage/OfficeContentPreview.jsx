import { useState } from "react";
import { columnName } from "../../lib/filePreview.js";

export default function OfficeContentPreview({ preview }) {
  const [activeSheet, setActiveSheet] = useState(0);
  if (preview.type === "pptx") return (
    <div className="w-full space-y-3">
      <p className="text-xs text-ink-500 dark:text-ink-400">Slide text preview. Download for images, charts, and the original layout.</p>
      {preview.truncated && <p className="text-xs text-ink-500">Showing the first 100 slides.</p>}
      <div className="max-h-[65vh] space-y-3 overflow-auto">
        {preview.slides.map((paragraphs, index) => (
          <section key={index} className="rounded-xl border border-ink-200 bg-ink-50 p-4 dark:border-ink-700 dark:bg-ink-900">
            <h3 className="mb-3 text-xs font-semibold text-brand-600 dark:text-brand-400">Slide {index + 1}</h3>
            {paragraphs.length ? paragraphs.map((text, paragraph) => <p key={paragraph} className="mb-2 whitespace-pre-wrap break-words text-sm text-ink-800 dark:text-ink-100">{text}</p>) : <p className="text-sm text-ink-500">No text on this slide.</p>}
          </section>
        ))}
      </div>
    </div>
  );

  const sheet = preview.sheets[activeSheet] || preview.sheets[0];
  return (
    <div className="w-full space-y-3">
      <p className="text-xs text-ink-500 dark:text-ink-400">Worksheet data preview. Download for formatting, charts, and recalculated formulas. Dates may appear as stored numeric values.</p>
      <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Worksheets">
        {preview.sheets.map((item, index) => <button key={index} type="button" aria-pressed={index === activeSheet} onClick={() => setActiveSheet(index)} className={index === activeSheet ? "btn-primary shrink-0 text-xs" : "btn-secondary shrink-0 text-xs"}>{item.name}</button>)}
      </div>
      {(sheet.truncated || preview.truncated) && <p className="text-xs text-ink-500">Preview limited to 20 worksheets, 200 rows per sheet, and 30 columns.</p>}
      <div className="max-h-[60vh] overflow-auto rounded-lg border border-ink-200 dark:border-ink-700">
        {sheet.rows.length ? <table className="w-full border-collapse text-left text-xs text-ink-800 dark:text-ink-100">
          <caption className="sr-only">{sheet.name}</caption>
          <thead className="sticky top-0 bg-ink-100 dark:bg-ink-800"><tr><th className="border-b border-ink-200 p-2 dark:border-ink-700" aria-label="Row number" />{Array.from({ length: sheet.columns }, (_, index) => <th key={index} scope="col" className="border-b border-ink-200 p-2 dark:border-ink-700">{columnName(index)}</th>)}</tr></thead>
          <tbody>{sheet.rows.map((row, index) => <tr key={index}><th scope="row" className="border-b border-ink-200 bg-ink-50 p-2 font-normal text-ink-500 dark:border-ink-700 dark:bg-ink-900">{row.number}</th>{Array.from({ length: sheet.columns }, (_, column) => <td key={column} className="min-w-24 max-w-xs whitespace-pre-wrap break-words border-b border-ink-200 p-2 dark:border-ink-700">{row.cells[column] || ""}</td>)}</tr>)}</tbody>
        </table> : <p className="p-4 text-sm text-ink-500">This worksheet is empty.</p>}
      </div>
    </div>
  );
}
