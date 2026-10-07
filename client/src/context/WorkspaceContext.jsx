import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as workspacesApi from "../api/workspaces.js";
import { apiErrorMessage } from "../api/client.js";
import { useAuth } from "./AuthContext.jsx";

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const requestId = useRef(0);
  const [state, setState] = useState({ userId, workspaces: [], loading: true, error: null });

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current;
    if (!userId) {
      setState({ userId, workspaces: [], loading: false, error: null });
      return [];
    }
    setState((previous) => ({
      userId,
      workspaces: previous.userId === userId ? previous.workspaces : [],
      loading: true,
      error: null,
    }));
    try {
      const workspaces = await workspacesApi.listWorkspaces();
      if (currentRequest === requestId.current) {
        setState({ userId, workspaces, loading: false, error: null });
      }
      return workspaces;
    } catch (err) {
      if (currentRequest === requestId.current) {
        setState((previous) => ({ ...previous, loading: false, error: apiErrorMessage(err) }));
      }
      throw err;
    }
  }, [userId]);

  useEffect(() => {
    // refresh exposes failures to callers; the initial load records them in state.
    refresh().catch(() => {});
    return () => { requestId.current++; };
  }, [refresh]);

  // Never expose a previous account's workspaces while the next account loads.
  const { workspaces, loading, error } = state.userId === userId
    ? state
    : { workspaces: [], loading: !!userId, error: null };

  return (
    <WorkspaceContext.Provider value={{ workspaces, loading, error, refresh }}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspaces() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspaces must be used within WorkspaceProvider");
  return ctx;
}
