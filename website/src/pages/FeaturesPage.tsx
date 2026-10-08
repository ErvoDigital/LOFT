import { CheckCircle2, Sparkles } from "lucide-react";
import { FEATURES } from "../data/product";
import {
  FeatureCard,
  GetStartedLink,
  SectionHeading,
  StartSection,
} from "../components/Marketing";

const groups = [
  {
    id: "plan",
    eyebrow: "01 / Plan your work",
    title: "One view of everything on your plate.",
    description:
      "Keep each team organized while making room for all the commitments that belong to you.",
  },
  {
    id: "collaborate",
    eyebrow: "02 / Work together",
    title: "The conversation and the work, side by side.",
    description:
      "Move from a discussion to a call, a shared document, or the latest file without leaving your workspace.",
  },
  {
    id: "access",
    eyebrow: "03 / Stay in control",
    title: "Keep your work close. Share with intention.",
    description:
      "Stay informed, personalize LOFT, and manage access within each team.",
  },
] as const;

export function FeaturesPage() {
  return (
    <>
      <section className="container page-hero">
        <p className="eyebrow">The LOFT service · Open Beta</p>
        <h1>
          Everything your teams need.
          <br />
          <span className="text-brand">A view that belongs to you.</span>
        </h1>
        <p className="hero-description">
          Shared workspaces for your people. A personal dashboard for your whole
          day. Explore the tools that bring planning, collaboration,
          organization, and Lofty, our AI assistant, into LOFT.
        </p>
        <GetStartedLink />
      </section>
      {groups.map((group) => (
        <section className="container section" key={group.id}>
          <SectionHeading eyebrow={group.eyebrow} title={group.title}>
            {group.description}
          </SectionHeading>
          <div className="feature-grid">
            {FEATURES.filter((feature) => feature.group === group.id).map(
              (feature) => (
                <FeatureCard key={feature.id} feature={feature} detailed />
              ),
            )}
          </div>
        </section>
      ))}
      <section className="container section">
        <div className="assistant-panel">
          <div>
            <p className="eyebrow">
              <Sparkles size={16} aria-hidden="true" />
              Lofty — AI with your review built in
            </p>
            <h2>
              Ask naturally.
              <br />
              Stay in charge.
            </h2>
            <p>
              Lofty, our AI assistant, works with the LOFT tasks and events you’re allowed
              to access. Ask what’s due, what to focus on, or why your schedule
              has a conflict.
            </p>
            <p>
              For changes, Lofty presents a task, meeting, or meeting-draft
              proposal. Review it and choose whether to confirm.
            </p>
          </div>
          <div className="assistant-capabilities">
            <h3>When Lofty is enabled</h3>
            {[
              "Ask Lofty to read your tasks and upcoming events",
              "Understand Smart Priority and schedule clashes",
              "Review Lofty's proposals for new tasks and meetings",
              "Prepare a meeting draft for details you’ll add later",
              "Use text, or tap-to-talk voice when speech is configured",
            ].map((item) => (
              <p key={item}>
                <CheckCircle2 size={17} aria-hidden="true" />
                {item}
              </p>
            ))}
            <p className="muted text-sm mt-5">
              Automatic availability-based scheduling and live meeting
              transcription are not currently available.
            </p>
          </div>
        </div>
      </section>
      <StartSection />
    </>
  );
}
