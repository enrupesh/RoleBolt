"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The "Company Profile" page was renamed to "Recruiter Profile" to support
// non-company recruiters (individuals, educational institutes, content
// creators, NGOs). Keep this route alive as a redirect for old links/bookmarks.
export default function CompanyProfileRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/recruit/recruiter-profile");
  }, [router]);
  return null;
}
