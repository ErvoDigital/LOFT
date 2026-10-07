import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import type { PageType } from "../types";
import { PAGES } from "../data/product";
import { LOGIN_URL } from "../config";
import { Brand, GetStartedLink } from "./Marketing";

export function Navbar({ currentPage }: { currentPage: PageType }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPage]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        document.getElementById("nav-mobile-toggle")?.focus();
      }
    };
    if (mobileMenuOpen) window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <a href="#/" aria-label="LOFT home">
          <Brand />
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          {PAGES.map((page) => (
            <a
              key={page.id}
              id={`nav-link-${page.id}`}
              href={`#/${page.id === "home" ? "" : page.id}`}
              aria-current={currentPage === page.id ? "page" : undefined}
              className={
                currentPage === page.id ? "nav-link active" : "nav-link"
              }
            >
              {page.label}
            </a>
          ))}
        </nav>
        <div className="desktop-actions">
          <a className="login-link" href={LOGIN_URL}>
            Log in
          </a>
          <GetStartedLink />
        </div>
        <button
          className="mobile-toggle"
          id="nav-mobile-toggle"
          aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          {mobileMenuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
      </div>
      {mobileMenuOpen && (
        <nav
          id="mobile-navigation"
          className="mobile-nav container"
          aria-label="Mobile navigation"
        >
          {PAGES.map((page) => (
            <a
              key={page.id}
              href={`#/${page.id === "home" ? "" : page.id}`}
              aria-current={currentPage === page.id ? "page" : undefined}
              className={
                currentPage === page.id ? "nav-link active" : "nav-link"
              }
              onClick={() => setMobileMenuOpen(false)}
            >
              {page.label}
            </a>
          ))}
          <a className="login-link" href={LOGIN_URL}>
            Log in
          </a>
          <GetStartedLink />
        </nav>
      )}
    </header>
  );
}
