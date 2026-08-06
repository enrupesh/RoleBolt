"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { billingHref } from "@/lib/billing";

/** Seeker shortcut into the shared multi-category billing page. */
export default function SeekerBillingPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(billingHref("seeker"));
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
      Opening seeker billing…
    </div>
  );
}
