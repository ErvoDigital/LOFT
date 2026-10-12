import { useEffect, useState } from "react";
import Modal from "../common/Modal.jsx";
import { normalizePageLayout, PAGE_SIZES } from "../../lib/documentLayout.js";

export default function PageSetupModal({ open, onClose, layout, onApply }) {
  const [draft, setDraft] = useState(() => normalizePageLayout(layout));
  useEffect(() => { if (open) setDraft(normalizePageLayout(layout)); }, [open, layout]);
  return (
    <Modal open={open} onClose={onClose} title="Page setup" footer={<div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={() => { onApply(draft); onClose(); }}>Apply</button></div>}>
      <div className="space-y-4">
        <p className="text-sm text-ink-500">These settings apply to every page and are saved with this document.</p>
        <label className="block text-sm font-medium">Paper size<select className="input mt-1.5" value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value })}>{Object.entries(PAGE_SIZES).map(([key, size]) => <option key={key} value={key}>{size.label}{key === "letter" ? " (8.5 × 11 in)" : " (210 × 297 mm)"}</option>)}</select></label>
        <label className="block text-sm font-medium">Orientation<select className="input mt-1.5" value={draft.orientation} onChange={(e) => setDraft({ ...draft, orientation: e.target.value })}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
        <label className="block text-sm font-medium">Margins<select className="input mt-1.5" value={draft.margins} onChange={(e) => setDraft({ ...draft, margins: e.target.value })}><option value="normal">Normal (1 in)</option><option value="narrow">Narrow (0.5 in)</option><option value="wide">Wide (1.25 in)</option></select></label>
      </div>
    </Modal>
  );
}
