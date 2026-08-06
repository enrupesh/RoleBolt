"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { billingHref, type BillingCategory } from "@/lib/billing";

function RedirectBody() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const category = params.get("category");
    const safe: BillingCategory =
      category === "seeker" || category === "creator_form" || category === "creator_standard"
        ? category
        : "seeker";
    const extra: Record<string, string> = {};
    if (params.get("checkout") === "pending") extra.checkout = "pending";
    router.replace(billingHref(safe, Object.keys(extra).length ? extra : undefined));
  }, [router, params]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
      Opening billing…
    </div>
  );
}

/** Compatibility route for older `/billing?category=` links from error notices. */
export default function BillingAliasPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <RedirectBody />
    </Suspense>
  );
}
