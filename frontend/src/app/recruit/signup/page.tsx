"use client";

import { Suspense } from "react";
import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { RoleboltLogo } from "@/components/RoleboltLogo";

function RecruitSignUpForm() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <Link href="/recruit" className="flex items-center gap-2 group">
            <RoleboltLogo
              size="sm"
              className="group-hover:shadow-[0_3px_12px_rgba(10,102,194,0.36)] group-hover:scale-105 transition-all"
            />
            <span className="text-sm font-bold text-slate-900">Rolebolt</span>
          </Link>
          <p className="text-xs text-slate-400">
            Already have an account?{" "}
            <Link
              href="/recruit/login"
              className="font-semibold text-[#0a66c2] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Clerk Sign Up */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <SignUp
          routing="hash"
          forceRedirectUrl="/recruit/dashboard"
          signInUrl="/recruit/login"
          appearance={{
            elements: {
              rootBox: "w-full max-w-[400px]",
              card: "shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-slate-200 rounded-2xl w-full",
              headerTitle: "text-2xl font-extrabold text-slate-950 tracking-tight",
              headerSubtitle: "text-sm text-slate-500",
              socialButtonsBlockButton:
                "border border-slate-200 rounded-xl h-11 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all",
              formFieldInput:
                "h-11 rounded-xl border border-slate-200 px-3.5 text-sm focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/15 transition-all",
              formButtonPrimary:
                "h-11 rounded-xl bg-[#0a66c2] text-sm font-bold hover:bg-[#004182] transition-all shadow-[0_2px_10px_rgba(10,102,194,0.28)]",
              footerActionLink: "text-[#0a66c2] font-semibold hover:underline",
              dividerLine: "bg-slate-100",
              dividerText: "text-[11px] font-semibold uppercase tracking-widest text-slate-400",
            },
          }}
        />
      </div>
    </div>
  );
}

export default function RecruitSignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8fafc]" />}>
      <RecruitSignUpForm />
    </Suspense>
  );
}
