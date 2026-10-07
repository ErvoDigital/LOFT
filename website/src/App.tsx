import { useEffect, useState } from "react";
import type { PageType } from "./types";
import { PAGES } from "./data/product";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { HomePage } from "./pages/HomePage";
import { FeaturesPage } from "./pages/FeaturesPage";
import { PricingPage } from "./pages/PricingPage";
import { AboutPage } from "./pages/AboutPage";

function pageFromLocation(): PageType {
  const route = window.location.hash.replace(/^#\/?/, "").replace(/\/$/, "");
  return PAGES.find((page) => page.id === route)?.id || "home";
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageType>(pageFromLocation);

  useEffect(() => {
    const handleNavigation = () => {
      setCurrentPage(pageFromLocation());
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", handleNavigation);
    return () => window.removeEventListener("hashchange", handleNavigation);
  }, []);

  useEffect(() => {
    const page = PAGES.find((page) => page.id === currentPage)!;
    document.title = page.title;
    for (const selector of [
      'meta[name="description"]',
      'meta[property="og:description"]',
    ]) {
      document
        .querySelector(selector)
        ?.setAttribute("content", page.description);
    }
    document
      .querySelector('meta[property="og:title"]')
      ?.setAttribute("content", page.title);
  }, [currentPage]);

  return (
    <div className="site-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <Navbar currentPage={currentPage} />
      <main id="main-content" tabIndex={-1}>
        {currentPage === "home" && <HomePage />}
        {currentPage === "features" && <FeaturesPage />}
        {currentPage === "pricing" && <PricingPage />}
        {currentPage === "about" && <AboutPage />}
      </main>
      <Footer />
    </div>
  );
}
