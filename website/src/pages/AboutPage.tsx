import { CalendarRange, HeartHandshake, Layers, Users } from "lucide-react";
import {
  GetStartedLink,
  SectionHeading,
  StartSection,
} from "../components/Marketing";

export function AboutPage() {
  return (
    <>
      <section className="container page-hero">
        <p className="eyebrow">Why LOFT exists</p>
        <h1>
          You belong to more
          <br />
          <span className="text-brand">than one team.</span>
        </h1>
        <p className="hero-description">
          Your tools should make room for that. LOFT is a productivity and
          collaboration platform for people balancing school, work,
          organizations, and community in one life.
        </p>
        <GetStartedLink />
      </section>
      <section className="container section split-section">
        <div>
          <SectionHeading
            eyebrow="Our purpose"
            title="Help people see the whole day."
          >
            A team sees its own projects and calendar. You carry commitments
            from every team you’re part of.
          </SectionHeading>
          <p className="muted leading-relaxed">
            LOFT gives each group its own workspace for tasks, events, chat,
            meetings, documents, and files. Your personal dashboard connects the
            work you can access, so you can plan with your whole workload in
            view.
          </p>
          <p className="muted leading-relaxed mt-4">
            The idea at the center of LOFT is simple: catch the conflicts that
            only appear when you bring independent teams together.
          </p>
        </div>
        <div className="about-workspaces">
          <span className="eyebrow">Different teams. One person.</span>
          {[
            {
              name: "School project",
              detail: "Research, deadlines, and group work",
              letter: "S",
              className: "school",
            },
            {
              name: "Work team",
              detail: "Tasks, meetings, and shared files",
              letter: "W",
              className: "work",
            },
            {
              name: "Community group",
              detail: "People, plans, and commitments",
              letter: "C",
              className: "community",
            },
          ].map((workspace) => (
            <div key={workspace.name} className="about-workspace">
              <span className={`workspace-avatar ${workspace.className}`}>
                {workspace.letter}
              </span>
              <div>
                <h3>{workspace.name}</h3>
                <p>{workspace.detail}</p>
              </div>
            </div>
          ))}
          <div className="personal-view">
            <Layers size={20} aria-hidden="true" />
            <span>Your personal LOFT dashboard</span>
          </div>
        </div>
      </section>
      <section className="container section">
        <SectionHeading
          eyebrow="What guides the product"
          title="Built around the way people actually work."
          centered
        />
        <div className="feature-grid">
          {[
            {
              Icon: Users,
              title: "Teams keep their own space",
              description:
                "Give each group a dedicated place to work, with its own members, roles, conversations, and resources.",
            },
            {
              Icon: CalendarRange,
              title: "People get a connected view",
              description:
                "Bring permitted tasks and schedules into one personal view, and make conflicts between teams visible.",
            },
            {
              Icon: HeartHandshake,
              title: "Collaboration stays close",
              description:
                "Keep the plan, the discussion, the meeting, and the document together so your team can move the work forward.",
            },
          ].map(({ Icon, title, description }) => (
            <article className="feature-card" key={title}>
              <span className="feature-icon">
                <Icon size={22} aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="container section">
        <div className="about-statement">
          <p className="eyebrow">School. Work. Organizations. Community.</p>
          <h2>
            Many teams.
            <br />
            <span className="text-brand">One place to find your footing.</span>
          </h2>
          <p>
            LOFT helps you work with each team while keeping sight of everything
            that needs your attention.
          </p>
        </div>
      </section>
      <StartSection />
    </>
  );
}
