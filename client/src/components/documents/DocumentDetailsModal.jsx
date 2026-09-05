import { format } from "date-fns";
import Modal from "../common/Modal.jsx";
import Avatar from "../common/Avatar.jsx";

export default function DocumentDetailsModal({ open, onClose, meta }) {
  return (
    <Modal open={open} onClose={onClose} title="Details" width="max-w-xs">
      {meta && (
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-ink-400">Created by</dt>
            <dd className="mt-1 flex items-center gap-2 font-medium text-ink-800">
              <Avatar name={meta.createdBy.name} color={meta.createdBy.avatarColor} size={22} />
              {meta.createdBy.name}
            </dd>
          </div>
          <div>
            <dt className="text-ink-400">Created</dt>
            <dd className="mt-0.5 font-medium text-ink-800">{format(new Date(meta.createdAt), "PPp")}</dd>
          </div>
          <div>
            <dt className="text-ink-400">Last edited</dt>
            <dd className="mt-0.5 font-medium text-ink-800">{format(new Date(meta.updatedAt), "PPp")}</dd>
          </div>
        </dl>
      )}
    </Modal>
  );
}
