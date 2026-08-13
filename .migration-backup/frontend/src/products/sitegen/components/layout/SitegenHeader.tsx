import Link from "next/link";
import { SitegenLogo } from "../branding/SitegenLogo";
import { sitegenRoutes } from "../../lib/routes";

export function SitegenHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0c0618]/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
        <Link href={sitegenRoutes.landing} aria-label="Sitegen home">
          <SitegenLogo />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-violet-100/70 md:flex">
          <a href="#how-it-works" className="transition hover:text-white">How it works</a>
          <a href="#themes" className="transition hover:text-white">Themes</a>
          <a href="#faq" className="transition hover:text-white">FAQ</a>
          <Link href={sitegenRoutes.login} className="transition hover:text-white">Sign in</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href={sitegenRoutes.login}
            className="hidden rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 md:inline-flex"
          >
            Sign in
          </Link>
          <a
            href="#choose-path"
            className="inline-flex rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#1a1033] shadow-[0_8px_30px_rgba(255,255,255,.12)] transition hover:bg-violet-50"
          >
            Get started
          </a>
        </div>
      </div>
    </header>
  );
}
