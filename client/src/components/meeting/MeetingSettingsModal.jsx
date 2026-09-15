import { useState } from "react";
import { Sun, Moon, Copy, Check, Link as LinkIcon } from "lucide-react";
import Modal from "../common/Modal.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import { useMeeting } from "../../context/MeetingContext.jsx";

export default function MeetingSettingsModal({ open, onClose, meetLink }) {
  const { theme, setTheme } = useTheme();
  const { confirmBeforeLeaving, setConfirmBeforeLeaving } = useMeeting();
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(meetLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal open={open} onClose={onClose} title="Meeting settings" width="max-w-md">
      <div className="space-y-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink-700 dark:text-ink-200">Appearance</h3>
          <div className="flex items-center gap-1 rounded-lg bg-ink-100 p-1 text-sm dark:bg-ink-900">
            <button
              onClick={() => setTheme("light")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                theme === "light" ? "bg-white text-ink-800 shadow-soft" : "text-ink-500 dark:text-ink-400"
              }`}
            >
              <Sun className="h-4 w-4" /> Light
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                theme === "dark" ? "bg-ink-700 text-white shadow-soft" : "text-ink-500 dark:text-ink-400"
              }`}
            >
              <Moon className="h-4 w-4" /> Dark
            </button>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink-700 dark:text-ink-200">Call behavior</h3>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-200 p-3 dark:border-ink-600">
            <input
              type="checkbox"
              checked={confirmBeforeLeaving}
              onChange={(e) => setConfirmBeforeLeaving(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 text-brand-600 focus:ring-brand-500/40"
            />
            <span>
              <span className="block text-sm font-medium text-ink-700 dark:text-ink-100">Confirm before ending the call</span>
              <span className="block text-xs text-ink-400">Ask "End the call?" whenever you click the hang-up button.</span>
            </span>
          </label>
        </div>

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
      </div>
    </Modal>
  );
}
