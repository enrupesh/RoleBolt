export function SitegenLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_8px_24px_rgba(124,58,237,.35)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7.5h16M4 12h10M4 16.5h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <circle cx="19" cy="12" r="2.5" fill="white" fillOpacity="0.9" />
        </svg>
      </span>
      <span className="font-display text-[17px] font-semibold tracking-[-0.04em] text-white">Sitegen</span>
    </span>
  );
}

export function SitegenLogoLight({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-[0_8px_24px_rgba(124,58,237,.2)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7.5h16M4 12h10M4 16.5h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <circle cx="19" cy="12" r="2.5" fill="white" fillOpacity="0.9" />
        </svg>
      </span>
      <span className="font-display text-[17px] font-semibold tracking-[-0.04em] text-[#1a1033]">Sitegen</span>
    </span>
  );
}
