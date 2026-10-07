import { Check, Layers } from "lucide-react";
import {
  GetStartedLink,
  SectionHeading,
  StartSection,
} from "../components/Marketing";

const included = [
  "Shared workspaces and member roles",
  "Personal dashboard and cross-workspace conflict alerts",
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
        <p className="eyebrow">Get started with LOFT</p>
        <h1>
          Make space for your teams.
          <br />
          <span className="text-brand">Try LOFT for free.</span>
        </h1>
        <p className="hero-description">
          Bring your work into one place and explore how LOFT fits your day.
          Start from the login page, with registration available for new
          accounts.
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
            <p className="price-label">Free to get started</p>
            <p>For people coordinating work and life across multiple teams.</p>
            <GetStartedLink />
            <p className="text-sm muted">
              Already have an account? Sign in and pick up where you left off.
            </p>
          </div>
          <div className="pricing-included">
            <h3>Explore the LOFT service</h3>
            <ul>
              {included.map((item) => (
                <li key={item}>
                  <Check size={18} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="pricing-note">
              The AI assistant and voice features are available when enabled for
              your LOFT deployment.
            </p>
          </div>
        </div>
      </section>
      <section className="container section pricing-faq">
        <SectionHeading
          eyebrow="Straightforward access"
          title="Start with the service that’s here today."
        />
        <div className="faq-list">
          <details>
            <summary>
              Are there paid plans?<span aria-hidden="true">+</span>
            </summary>
            <p>
              LOFT does not currently offer paid subscriptions. Pricing, billing
              options, and plan limits will be published here if paid plans
              become available.
            </p>
          </details>
          <details>
            <summary>
              How do I create an account?<span aria-hidden="true">+</span>
            </summary>
            <p>
              Choose “Try for free” to open the LOFT login page, then use the
              registration link. You can sign in with a password or Google and
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
