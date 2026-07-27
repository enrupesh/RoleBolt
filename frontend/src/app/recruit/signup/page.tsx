"use client";

import Link from "next/link";
import { RoleboltLogo } from "@/components/RoleboltLogo";

export default function RecruitSignUpPage() {
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

      {/* Placeholder */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px] rounded-2xl bg-white border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-8 text-center">
          <h1 className="text-2xl font-extrabold text-slate-950 tracking-tight mb-2">Create account</h1>
          <p className="text-sm text-slate-500 mb-6">
            Authentication is being rebuilt. This page will be replaced with a custom sign-up form.
          </p>
          <Link
            href="/recruit/dashboard"
            className="w-full inline-flex justify-center rounded-xl bg-[#0a66c2] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#004182] transition-all shadow-[0_2px_10px_rgba(10,102,194,0.28)]"
          >
            Continue to Dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}
