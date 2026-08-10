export default function PublicJobsEndMessage() {
  return (
    <div
      className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center shadow-sm"
      aria-label="End of public job listings"
    >
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-50 text-slate-400">
        <svg
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
      </div>
      <h2 className="text-base font-bold text-slate-900">That&apos;s all for now</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        You&apos;ve reached the end of the available public jobs.
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-400">
        Recruiters may also have private opportunities that aren&apos;t listed publicly.
      </p>
    </div>
  );
}
