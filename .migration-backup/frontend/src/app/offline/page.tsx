import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#f8fbfd] px-5 py-16 text-[#10263d]">
      <section className="w-full max-w-md rounded-3xl border border-[#d9e5ee] bg-white p-8 text-center shadow-[0_16px_45px_rgba(32,79,112,.1)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e7f0ff]">
          <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0a66c2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 15.5-6.2" />
            <path d="M21 12a9 9 0 0 1-15.5 6.2" />
            <path d="M18 3v4h-4M6 21v-4h4" />
          </svg>
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">Rolebolt offline</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-.05em]">You’re currently offline.</h1>
        <p className="mt-4 text-sm leading-6 text-[#647a8d]">
          Reconnect to the internet and try again. Rolebolt will bring you back to the page you were visiting.
        </p>
        <Link href="/recruit" className="mt-7 inline-flex items-center justify-center rounded-xl bg-[#0a66c2] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#07559f]">
          Return to Rolebolt
        </Link>
      </section>
    </main>
  );
}