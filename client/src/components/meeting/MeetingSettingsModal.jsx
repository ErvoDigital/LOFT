import { useEffect, useState } from "react";
import { Copy, Check, Link as LinkIcon, CalendarPlus } from "lucide-react";
import Modal from "../common/Modal.jsx";

export default function MeetingSettingsModal({ open, onClose, meetLink }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setCopied(false); setError(""); }, [open, meetLink]);

  async function copyLink() {
    setError("");
    try { await navigator.clipboard.writeText(meetLink); setCopied(true); }
    catch { setError("Couldn’t copy the link. Select and copy it below."); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Meeting settings" width="max-w-md">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink-700 dark:text-ink-200">Meeting link</h3>
        {meetLink ? (
          <>
            <p className="mb-2 text-xs text-ink-400">Share this link so others can join this workspace's meeting directly.</p>
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-dashed border-ink-200 bg-ink-50 px-3 py-2 dark:border-ink-600 dark:bg-ink-900">
                <LinkIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                <input aria-label="Meeting link" readOnly value={meetLink} onFocus={(event) => event.target.select()} className="min-w-0 flex-1 bg-transparent text-sm text-ink-700 outline-none dark:text-ink-200" />
              </div>
              <button onClick={copyLink} className="btn-secondary shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-xs text-ink-400">Workspace membership is required to join.</p>
            {error && <p role="alert" className="mt-2 text-xs text-red-500">{error}</p>}
          </>
        ) : (
          <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-ink-200 p-3 dark:border-ink-600">
            <CalendarPlus className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            <p className="text-xs text-ink-400">
              No meeting is live or scheduled yet. Start this meeting or schedule one to get a shareable link.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
