import { useMeeting } from "../../context/MeetingContext.jsx";
export default function MeetingConnectionStatus() {
  const { connectionStates = {}, relayConfigured, participants = {} } = useMeeting();
  const unstable = Object.entries(connectionStates).filter(([, state]) => ["failed", "disconnected", "connecting"].includes(state));
  return <div role="status" className="mb-2 text-xs text-ink-400">
    {unstable.length ? unstable.map(([id, state]) => `${participants[id]?.name || "Participant"}: ${state === "failed" ? "connection failed; retrying" : state === "disconnected" ? "reconnecting" : "connecting"}`).join(" · ") : "Call connections ready"}
    {!relayConfigured && <span className="ml-2">Relay unavailable on restricted networks</span>}
  </div>;
}
