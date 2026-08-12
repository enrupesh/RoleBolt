import Link from "next/link";
import ShareProfileButton from "@/components/ShareProfileButton";
import { RoleboltLogo } from "@/components/RoleboltLogo";

export function initials(value: string, fallback = "R") {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map(part => part[0]).join("") || fallback).toUpperCase();
}

export function Avatar({
  name,
  image,
  square = false,
  large = false,
}: {
  name: string;
  image?: string;
  square?: boolean;
  large?: boolean;
}) {
  const size = large ? "h-28 w-28 text-3xl sm:h-36 sm:w-36 sm:text-4xl" : "h-16 w-16 text-xl";
  return image ? (
    <img
      src={image}
      alt={`${name || "Profile"} photo`}
      width={large ? 144 : 64}
      height={large ? 144 : 64}
      className={`${size} ${square ? "rounded-3xl" : "rounded-full"} border-4 border-white object-cover shadow-xl`}
    />
  ) : (
    <div className={`${size} ${square ? "rounded-3xl" : "rounded-full"} flex shrink-0 items-center justify-center border-4 border-white bg-gradient-to-br from-[#4338ca] via-[#4f46e5] to-[#0a66c2] font-extrabold tracking-tight text-white shadow-xl`}>
      {initials(name)}
    </div>
  );
}

export function SectionHeading({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div className="mb-6">
      {eyebrow && <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600">{eyebrow}</p>}
      <h2 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{title}</h2>
    </div>
  );
}

export function MetaPill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">{children}</span>;
}

export function ExternalLink({ href, children, subtle = false }: { href: string; children: React.ReactNode; subtle?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={subtle ? "text-sm font-semibold text-slate-600 transition hover:text-indigo-700" : "text-sm font-semibold text-indigo-700 transition hover:text-indigo-900"}>
      {children}
    </a>
  );
}

export function VerifiedBadge({ status }: { status: "verified" | "requested" | "none" }) {
  if (status === "none") return null;
  const pending = status === "requested";
  return (
    <span title={pending ? "Verification is pending review" : "Rolebolt reviewed this profile"} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${pending ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${pending ? "bg-amber-500" : "bg-emerald-500"}`} />
      {pending ? "Verification pending" : "Verified profile"}
    </span>
  );
}

export function PublicProfileHeader({ kind, username, url }: { kind: "seeker" | "creator"; username: string; url: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f8f9fc]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <RoleboltLogo size="sm" />
          <span className="text-sm font-extrabold tracking-tight text-slate-950">Rolebolt</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link href="/recruit/opportunities" className="hidden text-sm font-semibold text-slate-600 transition hover:text-indigo-700 sm:inline">Open roles</Link>
          <ShareProfileButton url={url} label="Share" />
          <Link href={kind === "seeker" ? "/seeker/signup" : "/recruit/signup"} className="hidden rounded-full bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 sm:inline-flex">
            Create your profile
          </Link>
          <span className="text-xs font-semibold text-slate-400">@{username}</span>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200/80 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>Powered by Rolebolt</span>
        <div className="flex gap-4">
          <Link href="/recruit/opportunities" className="font-semibold transition hover:text-indigo-700">Browse jobs</Link>
          <Link href="/recruit/signup" className="font-semibold transition hover:text-indigo-700">Hire with Rolebolt</Link>
        </div>
      </div>
    </footer>
  );
}

export function NotFoundProfile({ kind }: { kind: "seeker" | "creator" }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-20 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-50 text-2xl font-black text-indigo-600">404</div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">This profile isn’t available</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">The {kind === "seeker" ? "professional" : "company"} page may have been removed, or the username may be incorrect.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/recruit/opportunities" className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700">Browse opportunities</Link>
          <Link href="/" className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Return to Rolebolt</Link>
        </div>
      </div>
    </div>
  );
}

export function EmptySection({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-8 text-center">
      <h3 className="font-bold text-slate-800">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{body}</p>
    </div>
  );
}