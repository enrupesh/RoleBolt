export function SitegenFieldLabel({
  children,
  required,
  optional,
}: {
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label className="text-xs font-semibold uppercase tracking-[.12em] text-violet-200/70">
      {children}
      {required ? <span className="ml-1 text-fuchsia-300">*</span> : null}
      {optional ? <span className="ml-1 font-normal normal-case tracking-normal text-violet-200/40">(optional)</span> : null}
    </label>
  );
}

export function SitegenInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white outline-none placeholder:text-violet-200/30 focus:border-violet-400/50"
    />
  );
}

export function SitegenTextarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm leading-6 text-white outline-none placeholder:text-violet-200/30 focus:border-violet-400/50"
    />
  );
}

export function SitegenSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {description ? <p className="mt-1 text-sm leading-6 text-violet-100/55">{description}</p> : null}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

export function SitegenInfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-violet-400/15 bg-violet-500/10 px-4 py-3.5 text-sm leading-6 text-violet-100/75">
      {children}
    </div>
  );
}
