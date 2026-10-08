import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  GraduationCap,
  HeartHandshake,
  BriefcaseBusiness,
  Users,
  Sparkles,
} from "lucide-react";
import { FEATURES, FAQS } from "../data/product";
import {
  FeatureCard,
  GetStartedLink,
  SectionHeading,
  StartSection,
} from "../components/Marketing";
import { ProductPreview } from "../components/ProductPreview";

export function HomePage() {
  const highlightedFeatures = [
    "workspaces",
    "tasks",
    "calendar",
    "chat",
    "documents",
    "storage",
  ];
  return (
    <>
      <section className="hero container">
        <p className="hero-pill">
          <span />
          Open Beta · One home for all your teams
        </p>
        <h1>
          All your teams.
          <br />
          <span className="text-brand">One clear plan.</span>
        </h1>
        <p className="hero-description">
          School, work, organizations, and community. Currently in open beta,
          LOFT brings your tasks, calendars, conversations, meetings, documents,
          files, and Lofty, our AI assistant, together so you can see what
          matters across every team.
        </p>
        <div className="hero-actions">
          <GetStartedLink>Try open beta</GetStartedLink>
          <button
            className="button button-secondary"
            onClick={() =>
              document.getElementById("product-preview")?.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "auto"
                  : "smooth",
                block: "start",
              })
            }
          >
            Explore LOFT
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="hero-notes">
          <span>
            <CheckCircle2 size={15} aria-hidden="true" />
            Open beta (freemium at launch)
          </span>
          <span>
            <CalendarRange size={15} aria-hidden="true" />
            Conflicts brought into view
          </span>
        </div>
        <div id="product-preview" className="preview-section">
          <ProductPreview />
        </div>
      </section>

      <section className="audience-strip">
        <div className="container">
          <p>For every team you’re part of</p>
          <div>
            {[
              { Icon: GraduationCap, label: "School & project groups" },
              { Icon: BriefcaseBusiness, label: "Work & client teams" },
              { Icon: Users, label: "Organizations" },
              { Icon: HeartHandshake, label: "Community groups" },
            ].map(({ Icon, label }) => (
              <span key={label}>
                <Icon size={22} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="container section split-section">
        <div>
          <SectionHeading
            eyebrow="Your teams have separate calendars. You have one day."
            title="See the clashes your teams can’t."
          >
            A deadline for school. A meeting at work. Another commitment with
            your organization. LOFT brings them into your personal view and
            flags the overlaps.
          </SectionHeading>
          <p className="muted leading-relaxed">
            Review overlapping meetings and same-day deadlines across
            workspaces, then open the affected tasks or events to decide what
            needs to change.
          </p>
          <a className="text-link" href="#/features">
            Explore planning in LOFT
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
        <div className="conflict-example">
          <div className="flex items-center gap-3">
            <span className="warning-icon">
              <CalendarRange size={23} aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow warning-text">Example conflict alert</p>
              <h3>Two teams. One deadline.</h3>
            </div>
          </div>
          <div className="conflict-item">
            <span className="workspace-tag school">School project</span>
            <p>Submit the research proposal</p>
            <span>Due Friday · 5:00 PM</span>
          </div>
          <div className="conflict-item">
            <span className="workspace-tag work">Client team</span>
            <p>Send the campaign presentation</p>
            <span>Due Friday · 5:00 PM</span>
          </div>
          <p className="conflict-caption">
            LOFT spots the clash across your workspaces.
          </p>
        </div>
      </section>

      <section className="container section">
        <SectionHeading
          eyebrow="Everything close to the work"
          title="Plan. Talk. Create. Keep it together."
          centered
        >
          Each workspace has the tools your team needs, with one personal
          dashboard to connect your commitments.
        </SectionHeading>
        <div className="feature-grid">
          {FEATURES.filter((feature) =>
            highlightedFeatures.includes(feature.id),
          ).map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </div>
        <div className="text-center mt-8">
          <a className="text-link" href="#/features">
            See all LOFT features
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="container section">
        <div className="assistant-panel">
          <div>
            <p className="eyebrow">
              <Sparkles size={16} aria-hidden="true" />
              Meet Lofty — Your AI Assistant
            </p>
            <h2>
              A little help with
              <br />
              what comes next.
            </h2>
            <p>
              Ask about your tasks, priorities, events, or schedule conflicts.
              When enabled, Lofty, our AI assistant, can propose tasks and meetings
              using text or voice.
            </p>
            <p className="assistant-note">
              You review the details and confirm before anything is saved.
            </p>
            <a className="text-link" href="#/features">
              Meet Lofty
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
          <div
            className="assistant-example"
            aria-label="Example of an assistant proposal from Lofty"
          >
            <p className="sample-label">Conversation with Lofty</p>
            <p className="sample-message">
              Add a task to prepare Friday’s presentation for my project team.
            </p>
            <div className="sample-reply">
              <span className="feature-icon">
                <Sparkles size={19} aria-hidden="true" />
              </span>
              <div>
                <strong>Lofty's task proposal</strong>
                <p>Prepare Friday’s presentation</p>
                <p className="muted text-sm">Workspace: Project team</p>
                <span className="review-badge">
                  Review details before confirming
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <SectionHeading
          eyebrow="Getting started"
          title="Your next team starts here."
          centered
        />
        <div className="steps-grid">
          {[
            {
              title: "Create your account",
              description:
                "Open LOFT, register from the login page, and verify your sign-in with the code sent to your email.",
            },
            {
              title: "Bring in your people",
              description:
                "Create a workspace for your team or join an existing one through an invitation.",
            },
            {
              title: "Put your day in view",
              description:
                "Add tasks and events, start conversations, and see your commitments together on your dashboard.",
            },
          ].map((step, index) => (
            <article key={step.title} className="step">
              <span className="step-number">0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container section faq-section">
        <SectionHeading
          eyebrow="Good to know"
          title="A few things before you start."
        />
        <div className="faq-list">
          {FAQS.map((faq) => (
            <details key={faq.question}>
              <summary>
                {faq.question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
      <StartSection />
    </>
  );
}
