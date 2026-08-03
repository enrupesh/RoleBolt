"use client";

import { useState } from "react";
import Image from "next/image";

// ─── Sample Data ──────────────────────────────────────────────────────────────

const STD_JOB = {
  title: "Frontend React Developer",
  niche: "AI, Data, Software & Product Tech",
  companyName: "TechNova Labs",
  companyType: "Startup",
  location: "Remote",
  workMode: "remote",
  department: "Engineering",
  seniority: "Mid-level",
  responsibilities:
    "Build and maintain scalable React components and pages. Collaborate with the backend team on REST API integration. Write unit and integration tests. Participate in code reviews and sprint planning. Optimize application performance and Core Web Vitals.",
  mustHaveSkills:
    "React.js, TypeScript, JavaScript (ES2022), REST APIs, Git, HTML5, CSS3",
  niceToHaveSkills: "Next.js, Tailwind CSS, AWS, GraphQL, Cypress",
  salaryMin: "1200000",
  salaryMax: "1800000",
  salaryCurrency: "INR",
  experienceMin: "2",
  experienceMax: "5",
  openings: "2",
};

const STD_HIGH_RESUME = `ALEX SHARMA
Frontend React Developer
alex.sharma@email.com | +91 98765 43210
github.com/alexsharma | linkedin.com/in/alexsharma

PROFESSIONAL SUMMARY
Experienced Frontend Developer with 4+ years specializing in React.js and TypeScript.
Delivered 12 production applications for SaaS companies. Strong in component architecture,
performance optimization, and REST API integration. Available immediately for remote roles.

EXPERIENCE

Senior Frontend Developer — DataFlow Inc. (Remote)
Jan 2022 – Present  |  2.5 years
• Built and maintained 8 React.js dashboards serving 50,000+ daily active users
• Migrated legacy jQuery codebase to React 18 with TypeScript; reduced page load by 40%
• Integrated 15+ REST APIs and implemented real-time updates with WebSockets
• Led code reviews for 4-member team; enforced ESLint + Prettier + Husky standards
• Optimised rendering with useMemo, useCallback, React.memo — eliminated 90% of wasted renders

Frontend Developer — SoftTech Solutions
Jun 2020 – Dec 2021  |  1.5 years
• Built a reusable React component library with 60+ components used across 3 products
• Developed responsive UIs with Tailwind CSS and CSS Modules
• Collaborated with backend team on REST API contract design and integrated 10+ endpoints
• Introduced Git branching strategy (Gitflow) and automated CI/CD via GitHub Actions

SKILLS
Core:      React.js, TypeScript, JavaScript (ES2022), HTML5, CSS3
Libraries: Redux Toolkit, React Query, Zustand, Framer Motion
Tooling:   Next.js, Vite, Webpack, Git, GitHub Actions, REST APIs
Styling:   Tailwind CSS, CSS Modules, styled-components
Testing:   Jest, React Testing Library, Cypress
Cloud:     AWS S3, Vercel, Netlify, Docker (basic)

EDUCATION
B.Tech Computer Science — Delhi Technological University
Graduated 2020  |  CGPA: 8.4 / 10

PROJECTS
• Contributed to react-query open-source repository (bug fix merged, 250+ GitHub stars)
• Built a real-time stock tracker: React 18 + WebSockets + Alpha Vantage API
• Personal portfolio with 99/100 Lighthouse score (performance, accessibility, SEO)

CERTIFICATIONS
• Meta Front-End Developer Professional Certificate (Coursera, 2022)
• AWS Cloud Practitioner (2023)
`;

const STD_LOW_RESUME = `PRIYA MEHTA
Digital Marketing Executive
priya.mehta@email.com | +91 87654 32109
linkedin.com/in/priyamehta

PROFESSIONAL SUMMARY
Creative marketing professional with 3 years of experience in content creation,
social media management, and performance advertising. Skilled in brand storytelling
and managing cross-channel campaigns for B2C lifestyle brands.

EXPERIENCE

Digital Marketing Executive — FashionHub India
Mar 2022 – Present  |  2 years
• Managed social media presence across Instagram, Facebook, LinkedIn (200K+ combined followers)
• Created content calendars; coordinated with graphic designers for visual assets
• Ran Google Ads and Meta Ads campaigns with ₹5L/month budget, achieving 3.2x ROAS
• Wrote blog posts, newsletters, and email campaigns using Mailchimp and HubSpot

Marketing Intern — BrandVoice Agency
Jun 2021 – Feb 2022  |  8 months
• Assisted in creating marketing collateral: brochures, social posts, pitch decks
• Conducted competitor analysis and market research for 5 client brands
• Made minor WordPress content edits (no coding background)

SKILLS
Marketing:   SEO / SEM, Google Ads, Meta Ads, Content Strategy, Email Marketing
Tools:       Canva, Adobe Photoshop, Mailchimp, HubSpot, Google Analytics 4
Basic Tech:  WordPress CMS, HTML basics (no JavaScript or frameworks)
Soft Skills: Copywriting, Brand Storytelling, Campaign Management, Presentation

EDUCATION
MBA in Marketing — Symbiosis Institute of Business Management
Graduated 2021  |  CGPA: 7.9 / 10

CERTIFICATIONS
• Google Ads Certified (2023)
• HubSpot Content Marketing Certification (2022)
• Meta Blueprint Certified (2022)
`;

const STD_CANDIDATE_HIGH = {
  name: "Alex Sharma",
  email: "alex.sharma@email.com",
  phone: "9876543210",
  location: "Delhi, India",
  currentStatus: "Employed (Full-time)",
  educationLevel: "Bachelor's Degree",
  availability: "1 month notice",
  linkedinUrl: "https://linkedin.com/in/alexsharma",
};

const STD_CANDIDATE_LOW = {
  name: "Priya Mehta",
  email: "priya.mehta@email.com",
  phone: "8765432109",
  location: "Mumbai, India",
  currentStatus: "Employed (Full-time)",
  educationLevel: "Master's Degree",
  availability: "2 weeks notice",
  linkedinUrl: "https://linkedin.com/in/priyamehta",
};

// ── Form Job ──────────────────────────────────────────────────────────────────

const FORM_JOB = {
  title: "Customer Success Intern",
  description:
    "We're looking for a motivated intern to join our Customer Success team. You'll onboard new users, resolve support queries, and help ensure our customers achieve their goals with Rolebolt. Great communication and a genuine care for users are must-haves.",
  questions: [
    { label: "Full Name", type: "short", required: true },
    { label: "Email Address", type: "email", required: true },
    { label: "Why do you want to join our Customer Success team?", type: "paragraph", required: true },
    { label: "Do you have prior experience in customer service or support?", type: "yes_no", required: true },
    { label: "What is your earliest availability to start?", type: "dropdown", required: true, options: ["Immediate", "2 weeks", "1 month", "2+ months"] },
    { label: "Upload your Resume (PDF, DOCX, or TXT)", type: "file", required: true },
  ],
};

const FORM_HIGH_ANSWERS = {
  "Full Name": "Riya Kapoor",
  "Email Address": "riya.kapoor@email.com",
  "Why do you want to join our Customer Success team?":
    "I completed a 6-month Customer Support internship at ZapDesk SaaS where I onboarded 200+ customers and maintained a 4.8/5 CSAT score. I genuinely enjoy helping users succeed, and I'm drawn to Rolebolt because it's solving a real problem in hiring. I'd love to be on the front lines ensuring recruiters and candidates get maximum value from the platform.",
  "Do you have prior experience in customer service or support?": "Yes",
  "What is your earliest availability to start?": "Immediate",
};

const FORM_LOW_ANSWERS = {
  "Full Name": "Aditya Verma",
  "Email Address": "aditya.verma@email.com",
  "Why do you want to join our Customer Success team?":
    "I'm looking for any internship opportunity to gain work experience. I heard about the position and thought I'd apply. I'm a fast learner and can adapt to any role.",
  "Do you have prior experience in customer service or support?": "No",
  "What is your earliest availability to start?": "1 month",
};

const FORM_HIGH_RESUME = `RIYA KAPOOR
Customer Success & Support Enthusiast
riya.kapoor@email.com | +91 99887 76655
linkedin.com/in/riyakapoor | Bengaluru, India

PROFESSIONAL SUMMARY
Energetic and empathetic final-year BBA student passionate about customer success,
user onboarding, and relationship management. Completed a 6-month SaaS internship
where I handled onboarding for 200+ customers and maintained a 4.8/5 CSAT score.
Excellent verbal and written communication in English and Hindi. Available immediately.

EXPERIENCE

Customer Support Intern — ZapDesk SaaS (Remote)
Jul 2023 – Dec 2023  |  6 months
• Onboarded 200+ new customers via guided product walkthroughs over Zoom and live chat
• Resolved 50+ support tickets per week on Freshdesk; 92% first-contact resolution rate
• Authored 15 help-centre articles; reduced repeat support queries by 30%
• Collected NPS and CSAT feedback; compiled monthly reports for the product team
• Recognised as "Intern of the Month" in October 2023

Part-time Customer Service Representative — Café Brews
Jan 2022 – Jun 2023  |  1.5 years
• Handled customer queries, complaints, and feedback in a high-volume café environment
• Maintained 4.9/5 rating on Google Reviews during tenure
• Trained 3 new part-time staff on POS system and service standards

SKILLS
Customer Success: Onboarding, CSAT / NPS tracking, Churn Analysis, Help Documentation
Communication:   Active Listening, Empathy, Written Communication, Zoom Presentations
Tools:           Freshdesk, Intercom (basic), Zoom, Notion, Google Workspace, Mailchimp
Languages:       English (Fluent), Hindi (Native), Marathi (Conversational)

EDUCATION
BBA in Business Administration — Christ University, Bengaluru
Expected: June 2024  |  CGPA: 8.2 / 10
Relevant coursework: Organisational Behaviour, Business Communication, CRM, Marketing

ACHIEVEMENTS
• Won Best Presentation Award at State-level B-School Competition (2023)
• Volunteered as Event Coordinator for college fest (500+ attendees)
`;

const FORM_LOW_RESUME = `ADITYA VERMA
Mechanical Engineering Graduate
aditya.verma@email.com | +91 88776 65543
linkedin.com/in/adityaverma | Surat, Gujarat

PROFESSIONAL SUMMARY
Mechanical engineering graduate with hands-on experience in CAD design,
manufacturing processes, and quality control. Seeking opportunities in the
automotive or industrial sector where I can apply technical design and
problem-solving skills.

EXPERIENCE

Engineering Intern — AutoParts Manufacturing Pvt. Ltd.
May 2023 – Aug 2023  |  4 months
• Assisted in designing sheet metal components using SolidWorks and AutoCAD
• Conducted dimensional inspections using Vernier callipers and CMM machines
• Participated in weekly production meetings to improve assembly line efficiency
• Documented process deviations and submitted non-conformance reports

Workshop Teaching Assistant — NIT Surat Engineering Lab
Aug 2021 – Apr 2023  |  1.5 years
• Operated lathe, milling, and drilling machines for prototype fabrication
• Maintained equipment maintenance logs and ensured safety compliance
• Assisted junior students with lab assignments and machinery operation

SKILLS
CAD / Design:    SolidWorks, AutoCAD, CATIA V5
Manufacturing:   CNC Machining, GD&T, Quality Control, Lean Manufacturing, 5S
Materials:       Metals, Composites, Polymers, Heat Treatment
Analysis:        MATLAB, ANSYS FEA, MS Excel (data analysis)

EDUCATION
B.Tech Mechanical Engineering — National Institute of Technology, Surat
Graduated 2023  |  CGPA: 7.6 / 10

PROJECTS
• Final Year: Designed a shell-and-tube heat exchanger for automotive cooling (SolidWorks + ANSYS)
• Academic: Built a miniature wind turbine for the college science exhibition

CERTIFICATIONS
• SOLIDWORKS Associate (CSWA) — 2022
• Lean Six Sigma White Belt — 2023
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function downloadTxt(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type CopyState = "idle" | "copied" | "failed";

function CopyButton({ text, dark }: { text: string; dark?: boolean }) {
  const [state, setState] = useState<CopyState>("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      // Fallback: select a hidden textarea for browsers that block clipboard API
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setState("copied");
      } catch {
        setState("failed");
      }
    }
    setTimeout(() => setState("idle"), 2000);
  };

  const label =
    state === "copied" ? "Copied!" : state === "failed" ? "Failed" : "Copy";

  return (
    <button
      onClick={handleCopy}
      aria-label={`Copy ${state === "copied" ? "(copied)" : state === "failed" ? "(failed)" : ""}`}
      className={`shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold transition-all ${
        dark
          ? state === "copied"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
            : state === "failed"
            ? "border-red-500/30 bg-red-500/8 text-red-400"
            : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
          : state === "copied"
          ? "border-emerald-500/40 bg-emerald-50 text-emerald-600"
          : state === "failed"
          ? "border-red-200 bg-red-50 text-red-500"
          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
      }`}
    >
      {state === "copied" ? (
        <>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {label}
        </>
      ) : state === "failed" ? (
        <>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          {label}
        </>
      ) : (
        <>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          {label}
        </>
      )}
    </button>
  );
}

function Field({
  label,
  value,
  dark,
  mono,
  multiline,
}: {
  label: string;
  value: string;
  dark?: boolean;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${dark ? "border-white/8 bg-white/3" : "border-slate-200 bg-slate-50/60"}`}>
      <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${dark ? "text-slate-500" : "text-slate-400"}`}>{label}</p>
      <div className="flex items-start gap-2">
        <p className={`flex-1 text-[12px] leading-relaxed ${mono ? "font-mono" : "font-medium"} ${dark ? "text-slate-200" : "text-slate-800"} ${multiline ? "whitespace-pre-wrap" : "truncate"}`}>
          {value}
        </p>
        <CopyButton text={value} dark={dark} />
      </div>
    </div>
  );
}

function ResumeCard({
  type,
  filename,
  content,
  dark,
  candidate,
}: {
  type: "high" | "low";
  filename: string;
  content: string;
  dark?: boolean;
  candidate: { name: string; email: string };
}) {
  const isHigh = type === "high";
  return (
    <div className={`rounded-xl border overflow-hidden ${dark ? isHigh ? "border-emerald-500/20 bg-emerald-500/4" : "border-red-500/15 bg-red-500/3" : isHigh ? "border-emerald-200 bg-emerald-50/40" : "border-red-100 bg-red-50/30"}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between gap-3 ${dark ? isHigh ? "border-emerald-500/15" : "border-red-500/10" : isHigh ? "border-emerald-100" : "border-red-100"}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-black ${isHigh ? "bg-emerald-500 text-white" : "bg-red-400 text-white"}`}>
            {isHigh ? "↑" : "↓"}
          </div>
          <div className="min-w-0">
            <p className={`text-[12px] font-bold leading-snug ${dark ? "text-slate-200" : "text-slate-800"}`}>{candidate.name}</p>
            <p className={`text-[10px] truncate ${dark ? "text-slate-500" : "text-slate-400"}`}>{candidate.email}</p>
          </div>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${isHigh ? dark ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" : "border-emerald-200 bg-emerald-50 text-emerald-700" : dark ? "border-red-500/20 bg-red-500/8 text-red-400" : "border-red-100 bg-white text-red-500"}`}>
          {isHigh ? "✓ High Match" : "✗ Low Match"}
        </span>
      </div>
      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        {/* Resume preview (first 6 lines) */}
        <div className={`rounded-lg border p-3 ${dark ? "border-white/6 bg-black/20" : "border-slate-200 bg-white"}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>Resume preview</p>
          <pre className={`text-[10px] leading-relaxed font-mono whitespace-pre-wrap line-clamp-6 ${dark ? "text-slate-400" : "text-slate-500"}`}>
            {content.split("\n").slice(0, 9).join("\n")}
          </pre>
        </div>
        {/* Download */}
        <button
          onClick={() => downloadTxt(filename, content)}
          className={`w-full flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-[12px] font-bold transition-all hover:-translate-y-0.5 ${
            isHigh
              ? dark
                ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/15"
                : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 shadow-sm"
              : dark
              ? "border-red-500/20 bg-red-500/6 text-red-400 hover:bg-red-500/12"
              : "border-red-100 bg-white text-red-500 hover:bg-red-50 shadow-sm"
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          📄 Download {isHigh ? "High" : "Low"} Match Resume (.txt)
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function JudgesTestingKit({ dark }: { dark?: boolean }) {
  const [tab, setTab] = useState<"standard" | "form">("standard");
  const [stdOpen, setStdOpen] = useState<Record<string, boolean>>({ job: true, candidates: true });
  const [frmOpen, setFrmOpen] = useState<Record<string, boolean>>({ form: true, answers: true });

  const toggle = (setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, key: string) =>
    setter((prev) => ({ ...prev, [key]: !prev[key] }));

  const cardCls = dark
    ? "rounded-2xl border border-white/8 bg-white/3"
    : "rounded-2xl border border-slate-200 bg-white shadow-sm";

  const sectionBg = dark ? "bg-slate-900" : "bg-[#f8fafc]";
  const headingCls = dark ? "text-white" : "text-slate-900";
  const subCls = dark ? "text-slate-500" : "text-slate-500";
  const dividerCls = dark ? "border-white/6" : "border-slate-100";

  return (
    <div>
      {/* Header */}
      <div className="max-w-2xl mx-auto text-center mb-10">
        <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-bold mb-5 uppercase tracking-widest ${dark ? "border-amber-400/25 bg-amber-400/8 text-amber-300" : "border-amber-400/30 bg-amber-400/8 text-amber-600"}`}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          For Hackathon Judges
        </div>
        <h2 className={`text-3xl font-black tracking-tight sm:text-4xl leading-tight ${headingCls}`}>
          Judge Testing Kit
        </h2>
        <p className={`mt-4 leading-relaxed max-w-lg mx-auto text-[14px] ${subCls}`}>
          Everything you need to evaluate Rolebolt without creating test data from scratch.
          Download sample resumes, copy job specs, and see how the AI ranks different candidate profiles.
        </p>
      </div>

      {/* Tab switcher */}
      <div
        role="tablist"
        aria-label="Testing workflow type"
        className={`flex items-center gap-1 p-1 rounded-xl border w-fit mx-auto mb-8 ${dark ? "border-white/8 bg-white/4" : "border-slate-200 bg-slate-100"}`}
      >
        {(["standard", "form"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            aria-controls={`tabpanel-${t}`}
            id={`tab-${t}`}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13px] font-bold transition-all ${
              tab === t
                ? dark
                  ? "bg-white/10 text-white shadow"
                  : "bg-white text-slate-900 shadow-sm"
                : dark
                ? "text-slate-500 hover:text-slate-300"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t === "standard" ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                Standard Jobs
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                Form Jobs
              </>
            )}
          </button>
        ))}
      </div>

      {/* ── Standard Jobs Tab ─────────────────────────────────────────────── */}
      {tab === "standard" && (
        <div id="tabpanel-standard" role="tabpanel" aria-labelledby="tab-standard" className="space-y-5">
          {/* Step 1: Job creation data */}
          <div className={cardCls}>
            <button
              onClick={() => toggle(setStdOpen, "job")}
              aria-expanded={stdOpen.job}
              aria-controls="std-job-panel"
              className={`w-full flex items-center justify-between px-5 py-4 text-left`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black ${dark ? "bg-[#0a66c2] text-white" : "bg-[#0a66c2] text-white"}`}>1</div>
                <div>
                  <p className={`text-[14px] font-bold ${headingCls}`}>Create a Standard Job</p>
                  <p className={`text-[11px] ${subCls}`}>Copy these values into the 4-step job creation wizard</p>
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform ${stdOpen.job ? "rotate-180" : ""} ${dark ? "text-slate-500" : "text-slate-400"}`}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {stdOpen.job && (
              <div id="std-job-panel" className={`px-5 pb-5 border-t ${dividerCls}`}>
                <div className="grid gap-2.5 sm:grid-cols-2 mt-4">
                  <Field label="Job Title" value={STD_JOB.title} dark={dark} />
                  <Field label="Niche / Category" value={STD_JOB.niche} dark={dark} />
                  <Field label="Company Name" value={STD_JOB.companyName} dark={dark} />
                  <Field label="Company Type" value={STD_JOB.companyType} dark={dark} />
                  <Field label="Work Mode" value={STD_JOB.workMode} dark={dark} />
                  <Field label="Location (leave blank for remote)" value={STD_JOB.location} dark={dark} />
                  <Field label="Department" value={STD_JOB.department} dark={dark} />
                  <Field label="Seniority Level" value={STD_JOB.seniority} dark={dark} />
                  <div className="sm:col-span-2">
                    <Field label="Key Responsibilities" value={STD_JOB.responsibilities} dark={dark} multiline />
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Must-Have Skills" value={STD_JOB.mustHaveSkills} dark={dark} />
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Nice-to-Have Skills" value={STD_JOB.niceToHaveSkills} dark={dark} />
                  </div>
                  <Field label="Min Salary (INR)" value={STD_JOB.salaryMin} dark={dark} mono />
                  <Field label="Max Salary (INR)" value={STD_JOB.salaryMax} dark={dark} mono />
                  <Field label="Min Experience (years)" value={STD_JOB.experienceMin} dark={dark} mono />
                  <Field label="Max Experience (years)" value={STD_JOB.experienceMax} dark={dark} mono />
                  <Field label="Number of Openings" value={STD_JOB.openings} dark={dark} mono />
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Test candidates */}
          <div className={cardCls}>
            <button
              onClick={() => toggle(setStdOpen, "candidates")}
              aria-expanded={stdOpen.candidates}
              aria-controls="std-candidates-panel"
              className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black ${dark ? "bg-violet-600 text-white" : "bg-violet-600 text-white"}`}>2</div>
                <div>
                  <p className={`text-[14px] font-bold ${headingCls}`}>Test Candidate Scoring</p>
                  <p className={`text-[11px] ${subCls}`}>Download a resume → apply to the job → see the AI match the candidate</p>
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform ${stdOpen.candidates ? "rotate-180" : ""} ${dark ? "text-slate-500" : "text-slate-400"}`}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {stdOpen.candidates && (
              <div id="std-candidates-panel" className={`px-5 pb-5 border-t space-y-5 mt-4 ${dividerCls}`}>
                {/* Workflow tip */}
                <div className={`mt-1 rounded-lg border px-4 py-3 flex items-start gap-2.5 ${dark ? "border-[#0a66c2]/20 bg-[#0a66c2]/6" : "border-[#0a66c2]/15 bg-blue-50/60"}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#0a66c2] shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p className={`text-[11px] leading-relaxed ${dark ? "text-slate-400" : "text-slate-500"}`}>
                    <strong className={dark ? "text-slate-200" : "text-slate-700"}>How to test: </strong>
                    Download a resume below → Go to your published job listing → Apply as a candidate → Upload the .txt file as the resume → Submit. The AI will match it instantly.
                  </p>
                </div>

                {/* Candidate info + resume cards */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3">
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${dark ? "text-slate-400" : "text-slate-500"}`}>Candidate details to fill in</p>
                    <Field label="Full Name" value={STD_CANDIDATE_HIGH.name} dark={dark} />
                    <Field label="Email" value={STD_CANDIDATE_HIGH.email} dark={dark} mono />
                    <Field label="Phone" value={STD_CANDIDATE_HIGH.phone} dark={dark} mono />
                    <Field label="Location" value={STD_CANDIDATE_HIGH.location} dark={dark} />
                    <Field label="Current Status" value={STD_CANDIDATE_HIGH.currentStatus} dark={dark} />
                    <Field label="Availability" value={STD_CANDIDATE_HIGH.availability} dark={dark} />
                    <ResumeCard
                      type="high"
                      filename="high-match-resume-react-developer.txt"
                      content={STD_HIGH_RESUME}
                      dark={dark}
                      candidate={{ name: STD_CANDIDATE_HIGH.name, email: STD_CANDIDATE_HIGH.email }}
                    />
                  </div>
                  <div className="space-y-3">
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${dark ? "text-slate-400" : "text-slate-500"}`}>Candidate details to fill in</p>
                    <Field label="Full Name" value={STD_CANDIDATE_LOW.name} dark={dark} />
                    <Field label="Email" value={STD_CANDIDATE_LOW.email} dark={dark} mono />
                    <Field label="Phone" value={STD_CANDIDATE_LOW.phone} dark={dark} mono />
                    <Field label="Location" value={STD_CANDIDATE_LOW.location} dark={dark} />
                    <Field label="Current Status" value={STD_CANDIDATE_LOW.currentStatus} dark={dark} />
                    <Field label="Availability" value={STD_CANDIDATE_LOW.availability} dark={dark} />
                    <ResumeCard
                      type="low"
                      filename="low-match-resume-marketing-executive.txt"
                      content={STD_LOW_RESUME}
                      dark={dark}
                      candidate={{ name: STD_CANDIDATE_LOW.name, email: STD_CANDIDATE_LOW.email }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Form Jobs Tab ─────────────────────────────────────────────────── */}
      {tab === "form" && (
        <div id="tabpanel-form" role="tabpanel" aria-labelledby="tab-form" className="space-y-5">
          {/* Step 1: Form creation data */}
          <div className={cardCls}>
            <button
              onClick={() => toggle(setFrmOpen, "form")}
              aria-expanded={frmOpen.form}
              aria-controls="frm-form-panel"
              className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0a66c2] text-white text-[11px] font-black">1</div>
                <div>
                  <p className={`text-[14px] font-bold ${headingCls}`}>Create a Form Job</p>
                  <p className={`text-[11px] ${subCls}`}>Use these settings in the Form Builder to create a test form</p>
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform ${frmOpen.form ? "rotate-180" : ""} ${dark ? "text-slate-500" : "text-slate-400"}`}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {frmOpen.form && (
              <div id="frm-form-panel" className={`px-5 pb-5 border-t ${dividerCls}`}>
                <div className="grid gap-2.5 mt-4">
                  <Field label="Form Title" value={FORM_JOB.title} dark={dark} />
                  <Field label="Form Description" value={FORM_JOB.description} dark={dark} multiline />
                </div>
                <p className={`text-[10px] font-bold uppercase tracking-wider mt-4 mb-2.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>Questions to add</p>
                <div className="space-y-2">
                  {FORM_JOB.questions.map((q, i) => (
                    <div key={i} className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${dark ? "border-white/8 bg-white/3" : "border-slate-200 bg-slate-50/60"}`}>
                      <span className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black ${dark ? "bg-white/10 text-slate-300" : "bg-slate-200 text-slate-600"}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[12px] font-medium leading-snug ${dark ? "text-slate-200" : "text-slate-700"}`}>{q.label}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide border ${dark ? "border-white/8 bg-white/5 text-slate-400" : "border-slate-200 bg-white text-slate-400"}`}>{q.type}</span>
                          {q.required && <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide border ${dark ? "border-amber-500/20 bg-amber-500/8 text-amber-400" : "border-amber-200 bg-amber-50 text-amber-600"}`}>required</span>}
                          {"options" in q && (
                            <span className={`text-[10px] ${dark ? "text-slate-500" : "text-slate-400"}`}>Options: {(q as any).options.join(" / ")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Test form answers */}
          <div className={cardCls}>
            <button
              onClick={() => toggle(setFrmOpen, "answers")}
              aria-expanded={frmOpen.answers}
              aria-controls="frm-answers-panel"
              className="w-full flex items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-white text-[11px] font-black">2</div>
                <div>
                  <p className={`text-[14px] font-bold ${headingCls}`}>Submit Test Applications</p>
                  <p className={`text-[11px] ${subCls}`}>Use these pre-written answers to test how AI matches different applicants</p>
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform ${frmOpen.answers ? "rotate-180" : ""} ${dark ? "text-slate-500" : "text-slate-400"}`}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {frmOpen.answers && (
              <div id="frm-answers-panel" className={`px-5 pb-5 border-t space-y-5 ${dividerCls}`}>
                <div className={`mt-4 rounded-lg border px-4 py-3 flex items-start gap-2.5 ${dark ? "border-[#0a66c2]/20 bg-[#0a66c2]/6" : "border-[#0a66c2]/15 bg-blue-50/60"}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#0a66c2] shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p className={`text-[11px] leading-relaxed ${dark ? "text-slate-400" : "text-slate-500"}`}>
                    <strong className={dark ? "text-slate-200" : "text-slate-700"}>How to test: </strong>
                    Open your published form link → Fill in the answers below → Download a resume and upload it when prompted → Submit. The AI will evaluate each answer automatically.
                  </p>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  {/* High match */}
                  <div className="space-y-3">
                    <div className={`flex items-center gap-2 ${dark ? "text-emerald-400" : "text-emerald-600"}`}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <p className="text-[11px] font-bold uppercase tracking-wider">High Match Applicant</p>
                    </div>
                    {Object.entries(FORM_HIGH_ANSWERS).map(([label, value]) => (
                      <Field key={label} label={label} value={value} dark={dark} multiline={label.startsWith("Why")} />
                    ))}
                    <ResumeCard
                      type="high"
                      filename="high-match-resume-customer-success.txt"
                      content={FORM_HIGH_RESUME}
                      dark={dark}
                      candidate={{ name: "Riya Kapoor", email: "riya.kapoor@email.com" }}
                    />
                  </div>
                  {/* Low match */}
                  <div className="space-y-3">
                    <div className={`flex items-center gap-2 ${dark ? "text-red-400" : "text-red-500"}`}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      <p className="text-[11px] font-bold uppercase tracking-wider">Low Match Applicant</p>
                    </div>
                    {Object.entries(FORM_LOW_ANSWERS).map(([label, value]) => (
                      <Field key={label} label={label} value={value} dark={dark} multiline={label.startsWith("Why")} />
                    ))}
                    <ResumeCard
                      type="low"
                      filename="low-match-resume-mechanical-engineer.txt"
                      content={FORM_LOW_RESUME}
                      dark={dark}
                      candidate={{ name: "Aditya Verma", email: "aditya.verma@email.com" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3: Try the AI Copilot ───────────────────────────────────── */}
      <div className={`mt-5 ${cardCls} overflow-hidden`}>
        <div className="p-5 sm:p-7 pb-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-white text-[11px] font-black shrink-0">3</div>
            <div className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest ${dark ? "border-violet-400/25 bg-violet-400/8 text-violet-300" : "border-violet-300/40 bg-violet-50 text-violet-600"}`}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              AI Copilot
            </div>
          </div>
          <h3 className={`text-[19px] font-black leading-snug ${headingCls}`}>Ask Rolebolt about any candidate, job, or your whole pipeline</h3>
          <p className={`mt-2 text-[13px] leading-relaxed max-w-xl ${subCls}`}>
            Once you&apos;ve created a job and a candidate has applied, open the AI Copilot (top nav →
            <strong className={dark ? "text-slate-300" : "text-slate-700"}> Ask Rolebolt</strong>) to chat in plain English. It switches
            between three context levels and grounds every answer in your real data — with clickable sources,
            never invented facts.
          </p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            {[
              { label: "Organisation", example: "\u201cWhich jobs need attention?\u201d" },
              { label: "Job", example: "\u201cWho should I interview first?\u201d" },
              { label: "Candidate", example: "\u201cShould I hire this candidate?\u201d" },
            ].map((mode) => (
              <div key={mode.label} className={`rounded-xl border px-3.5 py-2.5 ${dark ? "border-white/8 bg-white/3" : "border-slate-100 bg-slate-50"}`}>
                <p className="text-[10.5px] font-bold uppercase tracking-widest text-violet-500">{mode.label}</p>
                <p className={`text-[12px] mt-0.5 ${subCls}`}>{mode.example}</p>
              </div>
            ))}
          </div>
        </div>
        <div className={`relative mt-6 aspect-[1024/500] w-full border-t ${dividerCls} ${dark ? "bg-black/20" : "bg-slate-50"}`}>
          <Image
            src="/screenshots/ai-copilot-rolebolt.png"
            alt="Ask Rolebolt AI Copilot focused on a candidate, showing quick prompts and candidate context panel"
            fill
            className="object-cover object-top"
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>
      </div>

      {/* Bottom note */}
      <div className={`mt-6 rounded-xl border px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 ${dark ? "border-white/6 bg-white/2" : "border-slate-200 bg-slate-50"}`}>
        <div className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border ${dark ? "border-white/8 bg-white/5 text-violet-400" : "border-violet-100 bg-violet-50 text-violet-500"}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </div>
        <p className={`text-[12px] leading-relaxed ${dark ? "text-slate-500" : "text-slate-500"}`}>
          <strong className={dark ? "text-slate-300" : "text-slate-600"}>Tip for judges: </strong>
          Match results depend on how Mesh API interprets the job requirements against the resume. Try both resumes on the same job to see the AI&apos;s comparative reasoning across the 5 matching criteria.
        </p>
      </div>
    </div>
  );
}
