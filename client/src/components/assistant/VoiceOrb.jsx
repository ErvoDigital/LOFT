// Shared glass bubble for voice interaction and the text chat launcher.
// The layers use --level and --turn from an ancestor for voice animation.
export default function VoiceOrb({ state, small, className = "" }) {
  return (
    <span className={`voice-orb ${small ? "voice-orb-sm" : ""} ${className}`} data-state={state} aria-hidden="true">
      <span className="voice-orb-halo" />
      <span className="voice-orb-ring" />
      <span className="voice-orb-ring" />
      <span className="voice-orb-arc" />
      <span className="voice-orb-pulse">
        <span className="voice-orb-body">
          <span className="voice-orb-blob voice-orb-blob-a" />
          <span className="voice-orb-blob voice-orb-blob-b" />
          <span className="voice-orb-blob voice-orb-blob-c" />
          <span className="voice-orb-shine" />
        </span>
      </span>
    </span>
  );
}
