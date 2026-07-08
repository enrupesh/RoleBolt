import type { Metadata } from "next";
import { RecruitAuthProvider } from "@/contexts/RecruitAuthContext";
import { buildMetadata, breadcrumbJsonLd, productAppJsonLd, faqJsonLd, howToJsonLd, productKeywords } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = buildMetadata({
  title: "Recruit AI — Free AI Hiring & ATS for Modern Teams | Plyndrox",
  description:
    "Plyndrox Recruit AI is a free AI-powered ATS that sources candidates, screens resumes, scores fit, and runs your full hiring pipeline end-to-end — for startups, agencies, and enterprise teams.",
  path: "/recruit",
  keywords: [...productKeywords.recruit],
});

const recruitFaqs = [
  {
    question: "What is Plyndrox Recruit AI?",
    answer:
      "Recruit AI is a free AI-powered applicant tracking system (ATS) that sources candidates, parses and scores resumes, schedules interviews, runs async assessments, and manages the full hiring pipeline for startups, SMBs, and enterprise teams.",
  },
  {
    question: "Is Recruit AI really free?",
    answer:
      "Yes. Recruit AI is completely free for recruiters and hiring teams — no per-job, per-candidate, per-seat, or monthly subscription fees.",
  },
  {
    question: "How does AI candidate scoring work?",
    answer:
      "Recruit AI parses each candidate's resume, compares their skills, experience level, and role intent against your job description, and assigns a fit score (0–100). This lets your team focus on the strongest matches first instead of reading every CV.",
  },
  {
    question: "Can I post jobs publicly on a job board?",
    answer:
      "Yes. Recruit AI generates a public-facing job board for your company, individual job listing pages, niche landing pages (by industry), and an embeddable apply widget you can add to your own website.",
  },
  {
    question: "What is the AI job description writer?",
    answer:
      "When creating a new job, Recruit AI can auto-generate a complete, professional job description from just a job title and key skills. It produces role summary, responsibilities, requirements, and preferred qualifications — editable before publishing.",
  },
  {
    question: "Does Recruit AI support async candidate assessments?",
    answer:
      "Yes. You can send candidates AI-generated async assessments (written or video) directly from the pipeline. Responses are scored and summarized by AI so you can evaluate candidates efficiently without scheduling calls.",
  },
  {
    question: "Can job seekers also use Recruit AI to find jobs?",
    answer:
      "Yes. Job seekers can browse niche job listings, filter by role, location, work mode, salary, and skill match, save jobs, apply directly, and track their application status — all for free.",
  },
  {
    question: "How is Recruit AI different from Naukri or LinkedIn Recruiter?",
    answer:
      "Unlike Naukri and LinkedIn Recruiter (both paid), Plyndrox Recruit AI is completely free, built for niche hiring categories (tech, finance, healthcare, sales, creative, blue-collar), and uses AI to score and match candidates — not just keyword search.",
  },
  {
    question: "Does Recruit AI work for non-technical hiring?",
    answer:
      "Yes. Recruit AI has dedicated niche categories for Sales and Business Development, Finance and Fintech, Healthcare, Blue-Collar and Logistics, Creative and Marketing — not just technology roles.",
  },
  {
    question: "Can I use Recruit AI as a staffing agency?",
    answer:
      "Yes. Recruit AI supports multi-client hiring workflows, meaning staffing agencies can manage separate job pipelines and talent pools for each of their client companies under one account.",
  },
];

const howTo = howToJsonLd({
  name: "How to Post a Job and Hire with Plyndrox Recruit AI",
  description:
    "Step-by-step guide to posting your first job listing, setting up your hiring pipeline, and screening candidates using Plyndrox Recruit AI — completely free.",
  totalTime: "PT10M",
  steps: [
    {
      name: "Sign up for a free Plyndrox account",
      text: "Go to plyndrox.app and create your account. Navigate to the Recruit AI section and select the Recruiter role.",
      url: "/signup",
    },
    {
      name: "Create your company profile",
      text: "Set up your company name, logo, description, and website. This appears on your public job board and individual job listings.",
      url: "/recruit",
    },
    {
      name: "Post your first job with AI",
      text: "Click 'Post a Job', enter the job title and key skills, and let AI generate a complete job description. Choose the niche category and set location, work mode, and salary range.",
      url: "/recruit",
    },
    {
      name: "Review incoming applications and AI scores",
      text: "As candidates apply, Recruit AI scores each applicant's resume for fit (0–100). Sort by AI score to identify your strongest candidates immediately.",
      url: "/recruit",
    },
    {
      name: "Send assessments and make hiring decisions",
      text: "Send AI-generated assessments to shortlisted candidates, review their responses, and use the AI hiring decision engine to select your final hire.",
      url: "/recruit",
    },
  ],
});

export default function RecruitLayout({ children }: { children: React.ReactNode }) {
  return (
    <RecruitAuthProvider>
      <JsonLd
        id="ld-breadcrumb-recruit"
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "Recruit AI", url: "/recruit" },
        ])}
      />
      <JsonLd id="ld-faq-recruit" data={faqJsonLd(recruitFaqs)} />
      <JsonLd id="ld-howto-recruit" data={howTo} />
      <JsonLd
        id="ld-app-recruit"
        data={productAppJsonLd({
          id: "recruit",
          name: "Plyndrox Recruit AI",
          url: "/recruit",
          description:
            "Free AI applicant tracking system: AI sourcing, resume parsing and scoring, niche job board, async assessments, talent pool, and full hiring pipeline management.",
          subCategory: "Applicant Tracking System",
          features: [
            "AI candidate sourcing and outreach",
            "Resume parsing and fit scoring (0–100)",
            "AI job description writer",
            "Public niche job board with embeddable apply widget",
            "Async AI assessments for candidates",
            "Talent pool and saved searches",
            "Recruiter and job-seeker dashboards",
            "Application analytics and hiring funnel",
          ],
          rating: { value: "4.8", count: "263" },
        })}
      />
      {children}
    </RecruitAuthProvider>
  );
}
