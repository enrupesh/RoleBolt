import { sitegenProduct } from "../../config/product";

export function SitegenFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#08040f]">
      <div className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-display text-lg font-semibold tracking-[-0.04em] text-white">Sitegen</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-violet-200/50">
              A free, AI-assisted website builder for professionals. Publish at{" "}
              <span className="text-violet-200/80">{sitegenProduct.publicUrlPattern}</span>.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
            <div>
              <p className="font-semibold text-white/90">Product</p>
              <ul className="mt-3 space-y-2 text-violet-200/50">
                <li><a href="#how-it-works" className="hover:text-white">How it works</a></li>
                <li><a href="#themes" className="hover:text-white">Themes</a></li>
                <li><a href="#faq" className="hover:text-white">FAQ</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white/90">For</p>
              <ul className="mt-3 space-y-2 text-violet-200/50">
                <li>Job Seekers</li>
                <li>Creators</li>
                <li>Small businesses</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white/90">Contact</p>
              <ul className="mt-3 space-y-2 text-violet-200/50">
                <li>
                  <a href={`mailto:${sitegenProduct.supportEmail}`} className="hover:text-white">
                    {sitegenProduct.supportEmail}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-violet-200/35 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Sitegen. All rights reserved.</p>
          <p>Currently hosted on {sitegenProduct.hostDomain}</p>
        </div>
      </div>
    </footer>
  );
}
