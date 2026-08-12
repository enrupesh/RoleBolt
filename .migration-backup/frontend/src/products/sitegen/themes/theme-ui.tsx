import type { SitegenCreatorStructuredContent, SitegenSeekerStructuredContent } from "../types/structuredContent";
import { CreatorSocialLinks, SafeExternalLink, formatDateRange, hasCreatorContact, hasCreatorSocialLinks } from "./shared";

export function ThemeSection({
  id,
  title,
  eyebrow,
  children,
  className = "",
  headerClassName = "",
}: {
  id?: string;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 ${className}`}>
      <div className={headerClassName}>
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-60">{eyebrow}</p>
        ) : null}
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{title}</h2>
      </div>
      <div className="mt-6 sm:mt-8">{children}</div>
    </section>
  );
}

export function ThemeNav({
  brand,
  items,
  variant = "light",
}: {
  brand: string;
  items: Array<{ id: string; label: string }>;
  variant?: "light" | "dark" | "glass";
}) {
  if (!items.length) return null;

  const shell = variant === "dark"
    ? "border-white/10 bg-[#0f172a]/90 text-white"
    : variant === "glass"
      ? "border-white/15 bg-white/10 text-white backdrop-blur-md"
      : "border-slate-200/80 bg-white/90 text-slate-900";

  const link = variant === "light"
    ? "text-slate-600 hover:text-slate-900"
    : "text-white/70 hover:text-white";

  return (
    <nav className={`sticky top-0 z-20 border-b ${shell} backdrop-blur-md`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <p className="truncate text-sm font-semibold tracking-[-0.02em]">{brand}</p>
        <div className="flex max-w-[70%] items-center gap-1 overflow-x-auto sm:gap-2">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition sm:text-sm ${link}`}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

export function AvatarBadge({
  name,
  imageUrl,
  size = "lg",
  variant = "light",
}: {
  name: string;
  imageUrl?: string | null;
  size?: "md" | "lg" | "xl";
  variant?: "light" | "dark" | "brand";
}) {
  const initials = name.trim().split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
  const sizeClass = size === "xl" ? "h-24 w-24 text-2xl" : size === "lg" ? "h-20 w-20 text-xl" : "h-14 w-14 text-base";
  const shell = variant === "dark"
    ? "bg-violet-500/20 text-violet-100 ring-white/10"
    : variant === "brand"
      ? "bg-blue-600 text-white ring-blue-500/20"
      : "bg-slate-900 text-white ring-slate-900/10";

  if (imageUrl) {
    return <img src={imageUrl} alt="" className={`${sizeClass} shrink-0 rounded-2xl object-cover ring-4 ring-current/10`} />;
  }

  return (
    <div className={`${sizeClass} ${shell} flex shrink-0 items-center justify-center rounded-2xl font-semibold ring-4`}>
      {initials}
    </div>
  );
}

export function SkillGrid({
  skills,
  variant = "light",
}: {
  skills: string[];
  variant?: "light" | "dark" | "accent";
}) {
  if (!skills.length) return null;
  const pill = variant === "dark"
    ? "border-white/12 bg-white/5 text-violet-50"
    : variant === "accent"
      ? "border-blue-400/20 bg-blue-500/10 text-blue-50"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="flex flex-wrap gap-2.5">
      {skills.map((skill) => (
        <span key={skill} className={`rounded-xl border px-3.5 py-2 text-sm font-medium ${pill}`}>
          {skill}
        </span>
      ))}
    </div>
  );
}

export function ExperienceTimeline({
  items,
  variant = "light",
}: {
  items: SitegenSeekerStructuredContent["experience"];
  variant?: "light" | "dark";
}) {
  if (!items.length) return null;

  const card = variant === "dark"
    ? "border-white/10 bg-white/[0.04]"
    : "border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]";
  const meta = variant === "dark" ? "text-violet-200/60" : "text-slate-500";
  const body = variant === "dark" ? "text-slate-300" : "text-slate-600";

  return (
    <div className="space-y-5">
      {items.map((item) => {
        const dates = formatDateRange(item.startDate, item.endDate, item.current);
        return (
          <article key={`${item.title}-${item.company}`} className={`relative rounded-2xl border p-5 sm:p-6 ${card}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.02em]">{item.title}</h3>
                <p className={`mt-1 text-sm font-medium ${meta}`}>{item.company}</p>
              </div>
              {dates ? <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${meta}`}>{dates}</p> : null}
            </div>
            {item.bullets.length ? (
              <ul className={`mt-4 space-y-2 text-sm leading-7 ${body}`}>
                {item.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export function EducationList({
  items,
  variant = "light",
}: {
  items: SitegenSeekerStructuredContent["education"];
  variant?: "light" | "dark";
}) {
  if (!items.length) return null;
  const card = variant === "dark" ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50";
  const meta = variant === "dark" ? "text-violet-200/60" : "text-slate-500";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => {
        const dates = formatDateRange(item.startDate, item.endDate);
        return (
          <article key={item.school} className={`rounded-2xl border p-5 ${card}`}>
            <h3 className="text-base font-semibold">{item.school}</h3>
            <p className={`mt-1 text-sm ${meta}`}>{[item.degree, item.field].filter(Boolean).join(" · ")}</p>
            {dates ? <p className={`mt-2 text-xs font-semibold uppercase tracking-[0.12em] ${meta}`}>{dates}</p> : null}
            {item.description ? <p className={`mt-3 text-sm leading-7 ${meta}`}>{item.description}</p> : null}
          </article>
        );
      })}
    </div>
  );
}

export function ProjectShowcase({
  items,
  variant = "light",
}: {
  items: SitegenSeekerStructuredContent["projects"];
  variant?: "light" | "dark";
}) {
  if (!items.length) return null;
  const card = variant === "dark"
    ? "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-[0_16px_40px_rgba(15,23,42,0.06)]";
  const body = variant === "dark" ? "text-slate-300" : "text-slate-600";
  const link = variant === "dark" ? "text-violet-200 hover:text-white" : "text-blue-700 hover:text-blue-900";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <article key={item.name} className={`rounded-2xl border p-5 transition ${card}`}>
          <h3 className="text-lg font-semibold tracking-[-0.02em]">{item.name}</h3>
          {item.description ? <p className={`mt-3 text-sm leading-7 ${body}`}>{item.description}</p> : null}
          {item.url ? (
            <SafeExternalLink href={item.url} className={`mt-4 inline-flex text-sm font-semibold ${link}`}>
              View project →
            </SafeExternalLink>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function BulletHighlights({
  items,
  variant = "light",
}: {
  items: string[];
  variant?: "light" | "dark";
}) {
  if (!items.length) return null;
  const body = variant === "dark" ? "text-slate-300" : "text-slate-600";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item} className={`rounded-2xl border px-4 py-3 text-sm leading-7 ${variant === "dark" ? "border-white/10 bg-white/[0.04]" : "border-slate-200 bg-slate-50"} ${body}`}>
          {item}
        </div>
      ))}
    </div>
  );
}

export function PrimaryButton({
  href,
  children,
  variant = "dark",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "dark" | "light" | "brand";
}) {
  const styles = variant === "light"
    ? "bg-white text-slate-900 hover:bg-slate-100"
    : variant === "brand"
      ? "bg-blue-600 text-white hover:bg-blue-500"
      : "bg-slate-900 text-white hover:bg-slate-800";

  return (
    <a href={href} className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${styles}`}>
      {children}
    </a>
  );
}

export function ServiceCards({
  services,
  variant = "light",
}: {
  services: string[];
  variant?: "light" | "dark" | "studio";
}) {
  if (!services.length) return null;

  const card = variant === "dark"
    ? "border-slate-200 bg-white"
    : variant === "studio"
      ? "border-white/12 bg-white/[0.06] hover:bg-white/[0.09]"
      : "border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)]";

  const icon = variant === "studio" ? "text-violet-200" : "text-blue-600";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((service, index) => (
        <article key={service} className={`rounded-2xl border p-5 transition ${card}`}>
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-current/5 text-sm font-bold ${icon}`}>
            {String(index + 1).padStart(2, "0")}
          </div>
          <h3 className="mt-4 text-base font-semibold tracking-[-0.02em]">{service}</h3>
        </article>
      ))}
    </div>
  );
}

export function PortfolioGrid({
  items,
  variant = "light",
}: {
  items: Array<{ title: string; url: string; description: string | null }>;
  variant?: "light" | "dark" | "studio";
}) {
  if (!items.length) return null;

  const card = variant === "studio"
    ? "border-white/12 bg-white/[0.06] hover:bg-white/[0.1]"
    : variant === "dark"
      ? "border-slate-200 bg-white hover:shadow-lg"
      : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-[0_16px_40px_rgba(37,99,235,0.08)]";
  const body = variant === "studio" ? "text-violet-100/70" : "text-slate-600";
  const link = variant === "studio" ? "text-violet-100" : "text-blue-700";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <SafeExternalLink key={item.url} href={item.url} className={`block rounded-2xl border p-5 transition ${card}`}>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${variant === "studio" ? "text-violet-200/60" : "text-slate-400"}`}>
            Case study
          </p>
          <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em]">{item.title}</h3>
          {item.description ? <p className={`mt-3 text-sm leading-7 ${body}`}>{item.description}</p> : null}
          <span className={`mt-4 inline-flex text-sm font-semibold ${link}`}>View work →</span>
        </SafeExternalLink>
      ))}
    </div>
  );
}

export function TeamGrid({
  members,
  variant = "light",
}: {
  members: Array<{ name: string; role: string | null; bio: string | null }>;
  variant?: "light" | "dark" | "studio";
}) {
  if (!members.length) return null;

  const card = variant === "studio"
    ? "border-white/12 bg-white/[0.06]"
    : "border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)]";
  const meta = variant === "studio" ? "text-violet-200/70" : "text-slate-500";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {members.map((member) => (
        <article key={member.name} className={`rounded-2xl border p-5 ${card}`}>
          <div className="flex items-center gap-3">
            <AvatarBadge name={member.name} size="md" variant={variant === "studio" ? "dark" : "brand"} />
            <div>
              <h3 className="font-semibold">{member.name}</h3>
              {member.role ? <p className={`text-sm ${meta}`}>{member.role}</p> : null}
            </div>
          </div>
          {member.bio ? <p className={`mt-4 text-sm leading-7 ${meta}`}>{member.bio}</p> : null}
        </article>
      ))}
    </div>
  );
}

export function CreatorContactPanel({
  content,
  variant = "light",
}: {
  content: SitegenCreatorStructuredContent;
  variant?: "light" | "dark" | "studio";
}) {
  if (!hasCreatorContact(content) && !hasCreatorSocialLinks(content.socialLinks)) return null;

  const shell = variant === "studio"
    ? "border-white/12 bg-white/[0.06] text-white"
    : variant === "dark"
      ? "border-slate-200 bg-slate-50"
      : "border-blue-100 bg-blue-50/60";
  const label = variant === "studio" ? "text-violet-200/60" : "text-slate-500";
  const value = variant === "studio" ? "text-violet-50" : "text-slate-700";
  const link = variant === "studio" ? "text-violet-100 hover:text-white" : "text-blue-700 hover:text-blue-900";

  return (
    <div className={`rounded-[1.75rem] border p-6 sm:p-8 ${shell}`}>
      <h3 className="text-xl font-semibold tracking-[-0.03em]">Let&apos;s work together</h3>
      <div className="mt-5 space-y-3 text-sm">
        {content.location ? <p className={value}><span className={`font-semibold ${label}`}>Location · </span>{content.location}</p> : null}
        {content.contact.email ? <p className={value}><span className={`font-semibold ${label}`}>Email · </span>{content.contact.email}</p> : null}
        {content.contact.phone ? <p className={value}><span className={`font-semibold ${label}`}>Phone · </span>{content.contact.phone}</p> : null}
        {content.contact.website ? (
          <SafeExternalLink href={content.contact.website} className={`font-semibold ${link}`}>
            Visit website →
          </SafeExternalLink>
        ) : null}
      </div>
      <CreatorSocialLinks social={content.socialLinks} className="mt-5" pill={variant === "studio"} />
    </div>
  );
}
