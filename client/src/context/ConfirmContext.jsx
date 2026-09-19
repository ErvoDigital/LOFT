import { createContext, useCallback, useContext, useRef, useState } from "react";
import ConfirmDialog from "../components/common/ConfirmDialog.jsx";

const ConfirmContext = createContext(null);

// One styled confirmation dialog for the whole app, driven by a promise so
// call sites read like window.confirm did:
//   if (!(await confirm({ title, subject, message, confirmLabel }))) return;
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolveRef = useRef(null);

  const settle = useCallback((result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setRequest(null);
  }, []);

  const confirm = useCallback((options) => {
    // A newer request replaces one still waiting on an answer.
    resolveRef.current?.(false);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setRequest(options);
    });
  }, []);

  const accept = useCallback(() => settle(true), [settle]);
  const cancel = useCallback(() => settle(false), [settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog open={!!request} {...request} onConfirm={accept} onCancel={cancel} />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used within ConfirmProvider");
  return confirm;
}
