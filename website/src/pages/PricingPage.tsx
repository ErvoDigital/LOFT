import { Check, Layers } from "lucide-react";
import {
  GetStartedLink,
  SectionHeading,
  StartSection,
} from "../components/Marketing";

const included = [
  "Shared workspaces and member roles",
  "Personal dashboard and cross-workspace conflict alerts",
  "Lofty, our AI assistant (text & voice support)",
  "Task boards, Smart Priority, and My Plan",
  "Shared calendars and event reminders",
  "Workspace channels and direct messages",
  "Video meetings, screen sharing, and annotations",
  "Collaborative rich-text documents",
  "File storage, nested folders, and version history",
  "In-app notifications and appearance customization",
  "Folder, document, and member access controls",
];

export function PricingPage() {
  return (
    <>
      <section className="container page-hero">
        <p className="eyebrow">Open Beta Access</p>
        <h1>
          Make space for your teams.
          <br />
          <span className="text-brand">Free during open beta.</span>
        </h1>
        <p className="hero-description">
          LOFT is currently in open beta, giving you full access to all workspace
          features, cross-team conflict alerts, and Lofty, our AI assistant.
          Upon official release, LOFT will transition to a freemium model with both
          free and premium tiers.
        </p>
      </section>
      <section className="container pricing-section">
        <div className="pricing-card">
          <div className="pricing-intro">
            <span className="feature-icon">
              <Layers size={24} aria-hidden="true" />
            </span>
            <p className="eyebrow mt-6">Current access</p>
            <h2>LOFT</h2>
            <p className="price-label">Open Beta</p>
            <div className="pricing-beta-tag">
              <span>Freemium model at official release</span>
            </div>
            <p>
              Explore all features without cost while LOFT is in beta. When officially
              released, LOFT will adopt a freemium model with a free tier for everyday
              use alongside premium plans for larger teams and organizations.
            </p>
            <GetStartedLink>Try the open beta</GetStartedLink>
            <p className="text-sm muted">
              Already have an account? Sign in and pick up where you left off.
            </p>
          </div>
          <div className="pricing-included">
            <h3>Included during open beta</h3>
            <ul>
              {included.map((item) => (
                <li key={item}>
                  <Check size={18} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="pricing-note">
              Lofty, our AI assistant, and voice features are available when enabled for
              your LOFT deployment. All beta users receive full access during this preview period.
            </p>
          </div>
        </div>
      </section>
      <section className="container section pricing-faq">
        <SectionHeading
          eyebrow="Beta & pricing details"
          title="Clear, transparent access today and tomorrow."
        />
        <div className="faq-list">
          <details>
            <summary>
              Is LOFT currently free to use?<span aria-hidden="true">+</span>
            </summary>
            <p>
              Yes! LOFT is currently in open beta. You can explore all
              features — including multi-workspace collaboration and Lofty,
              our AI assistant — completely free of charge.
            </p>
          </details>
          <details>
            <summary>
              What pricing model will LOFT use at official release?<span aria-hidden="true">+</span>
            </summary>
            <p>
              LOFT will feature a freemium model in its official release. A generous
              free tier will always remain available for individuals and small groups
              coordinating across workspaces. Paid tiers will be introduced for teams
              requiring advanced administration, expanded storage, and enhanced tooling.
            </p>
          </details>
          <details>
            <summary>
              Will I keep my workspaces when LOFT officially launches?<span aria-hidden="true">+</span>
            </summary>
            <p>
              Yes. Your workspaces, members, tasks, documents, and calendar data
              created during the open beta will seamlessly carry over to the official
              release under the freemium structure.
            </p>
          </details>
          <details>
            <summary>
              How do I create an account?<span aria-hidden="true">+</span>
            </summary>
            <p>
              Choose “Try the open beta” to open the LOFT registration page and
              create your account. You can sign in with a password or Google and
              complete email verification.
            </p>
          </details>
          <details>
            <summary>
              Can I create or join a team?<span aria-hidden="true">+</span>
            </summary>
            <p>
              Yes. Once signed in, create a workspace and invite your people, or
              join a workspace you’ve been invited to. Your dashboard brings
              work from your memberships into one personal view.
            </p>
          </details>
        </div>
      </section>
      <StartSection />
    </>
  );
}
