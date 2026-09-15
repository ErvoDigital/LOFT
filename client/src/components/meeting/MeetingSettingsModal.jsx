import { useState } from "react";
import { Copy, Check, Link as LinkIcon } from "lucide-react";
import Modal from "../common/Modal.jsx";

export default function MeetingSettingsModal({ open, onClose, meetLink }) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(meetLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal open={open} onClose={onClose} title="Meeting settings" width="max-w-md">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink-700 dark:text-ink-200">Meeting link</h3>
        <p className="mb-2 text-xs text-ink-400">Share this link so others can join this workspace's meeting directly.</p>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-dashed border-ink-200 bg-ink-50 px-3 py-2 dark:border-ink-600 dark:bg-ink-900">
            <LinkIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" />
            <span className="truncate text-sm text-ink-700 dark:text-ink-200">{meetLink}</span>
          </div>
          <button onClick={copyLink} className="btn-secondary shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
