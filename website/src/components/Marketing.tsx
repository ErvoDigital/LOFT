import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { LOGIN_URL } from "../config";
import type { FEATURES } from "../data/product";

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        L
      </span>
      <span>LOFT</span>
    </span>
  );
}

export function GetStartedLink({
  children = "Try for free",
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <a href={LOGIN_URL} className={`button button-primary ${className}`}>
      {children}
      <ArrowRight size={16} aria-hidden="true" />
    </a>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  children,
  centered = false,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  centered?: boolean;
}) {
  return (
    <div className={`section-heading ${centered ? "text-center mx-auto" : ""}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children && <p className="section-description">{children}</p>}
    </div>
  );
}

export function FeatureCard({
  feature,
  detailed = false,
}: {
  feature: (typeof FEATURES)[number];
  detailed?: boolean;
}) {
  const { Icon, title, description, details } = feature;
  return (
    <article className="feature-card" id={feature.id}>
      <span className="feature-icon">
        <Icon size={22} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {detailed && (
        <ul className="feature-details">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function StartSection() {
  return (
    <section className="container section">
      <div className="start-panel">
        <div>
          <p className="eyebrow">Make room for what matters</p>
          <h2>Bring your teams into LOFT.</h2>
          <p>
            Your work, conversations, and commitments. One place to see what’s
            next.
          </p>
        </div>
        <GetStartedLink className="shrink-0" />
      </div>
    </section>
  );
}
