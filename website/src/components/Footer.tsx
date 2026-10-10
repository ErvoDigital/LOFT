import { REGISTER_URL } from "../config";
import { Brand } from "./Marketing";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <a href="#/" aria-label="LOFT home">
              <Brand />
            </a>
            <p className="footer-description">
              One home for all your teams. Plan your day, collaborate with your
              people, and keep every workspace in view.
            </p>
          </div>
          <nav aria-label="Product links">
            <h2>Product</h2>
            <a href="#/features">Explore features</a>
            <a href="#/pricing">Pricing & Beta</a>
            <a href={REGISTER_URL}>Try open beta</a>
          </nav>
          <nav aria-label="About links">
            <h2>LOFT</h2>
            <a href="#/about">About LOFT</a>
            <a href="#/features">Workspaces & collaboration</a>
            <a href={REGISTER_URL}>Create your account</a>
          </nav>
        </div>
        <div className="footer-notice">
          <p>
            <strong>Academic Project Notice:</strong> LOFT is a student-developed academic project currently in beta testing. The business concept is being developed for educational purposes.
          </p>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} LOFT. All rights reserved.</p>
          <p>Built for life across teams.</p>
        </div>
      </div>
    </footer>
  );
}
