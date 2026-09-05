import Modal from "../common/Modal.jsx";

function countStats(editor) {
  const text = editor.getText();
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, "").length;
  return { words, characters, charactersNoSpaces };
}

export default function WordCountModal({ open, onClose, editor }) {
  const stats = open && editor ? countStats(editor) : null;
  return (
    <Modal open={open} onClose={onClose} title="Word count" width="max-w-xs">
      {stats && (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-500">Words</dt>
            <dd className="font-medium text-ink-800">{stats.words}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Characters</dt>
            <dd className="font-medium text-ink-800">{stats.characters}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Characters (no spaces)</dt>
            <dd className="font-medium text-ink-800">{stats.charactersNoSpaces}</dd>
          </div>
        </dl>
      )}
    </Modal>
  );
}
