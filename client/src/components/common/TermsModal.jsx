import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";

const SCROLL_THRESHOLD_PX = 16;

export default function TermsModal({ open, onClose, onAgree }) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setScrolledToEnd(false);
    // Short content that doesn't actually overflow shouldn't block on a
    // scroll gesture that has nothing to scroll.
    const el = contentRef.current;
    if (el && el.scrollHeight <= el.clientHeight + SCROLL_THRESHOLD_PX) {
      setScrolledToEnd(true);
    }
  }, [open]);

  function handleScroll(e) {
    const el = e.target;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD_PX) {
      setScrolledToEnd(true);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Terms & Privacy Policy" width="max-w-lg">
      <div
        ref={contentRef}
        onScroll={handleScroll}
        className="max-h-80 space-y-3 overflow-y-auto rounded-lg border border-ink-100 p-4 text-sm leading-relaxed text-ink-600"
      >
        <h3 className="font-semibold text-ink-800">Terms of Service</h3>
        <p>
          By creating a LOFT account, you agree to use the workspace for lawful purposes and to keep your
          login credentials confidential. You're responsible for the content you post, upload, or share
          within your workspaces, and for anyone you invite into them.
        </p>
        <p>
          LOFT is provided "as is" without warranties of any kind. We may update, suspend, or discontinue
          features at any time, and we'll do our best to give notice of any change that meaningfully affects
          how you use the product.
        </p>
        <p>
          You may close your account at any time. We reserve the right to suspend accounts that violate
          these terms, abuse other users, or attempt to compromise the security of the platform.
        </p>
        <h3 className="font-semibold text-ink-800">Privacy Policy</h3>
        <p>
          We collect the information you give us directly — your name, email, phone number, and the content
          you create in your workspaces — to operate the product. We don't sell your data.
        </p>
        <p>
          Files, messages, and documents you upload are stored to provide the service and are only
          accessible to members of the workspaces you belong to. Signing in with Google shares your name,
          email, and profile photo with us, nothing more.
        </p>
        <p>
          You can request a copy of your data or ask us to delete your account at any time by contacting
          support. Deleting your account removes your profile and personal data from active systems.
        </p>
      </div>
      <p className="mt-3 text-xs text-ink-400">
        {scrolledToEnd ? "You've reached the end." : "Scroll to the end to continue."}
      </p>
      <button
        type="button"
        onClick={() => {
          onAgree();
          onClose();
        }}
        disabled={!scrolledToEnd}
        className="btn-primary mt-3 w-full"
      >
        I Agree
      </button>
    </Modal>
  );
}
