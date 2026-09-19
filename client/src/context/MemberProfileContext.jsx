import { createContext, useCallback, useContext, useState } from "react";
import MemberProfileModal from "../components/profile/MemberProfileModal.jsx";

const MemberProfileContext = createContext(null);

// One profile card for the whole app, so any avatar or name can open it:
//   const openProfile = useMemberProfile();
//   openProfile(user.id, workspaceId);
// workspaceId is optional; passing the workspace the click came from shows
// the person's role there and narrows their task figures to its board.
export function MemberProfileProvider({ children }) {
  const [target, setTarget] = useState(null); // { userId, workspaceId } | null

  const openProfile = useCallback((userId, workspaceId) => {
    if (userId) setTarget({ userId, workspaceId: workspaceId || undefined });
  }, []);
  const close = useCallback(() => setTarget(null), []);

  return (
    <MemberProfileContext.Provider value={openProfile}>
      {children}
      <MemberProfileModal open={!!target} onClose={close} userId={target?.userId} workspaceId={target?.workspaceId} />
    </MemberProfileContext.Provider>
  );
}

export function useMemberProfile() {
  const openProfile = useContext(MemberProfileContext);
  if (!openProfile) throw new Error("useMemberProfile must be used within MemberProfileProvider");
  return openProfile;
}
