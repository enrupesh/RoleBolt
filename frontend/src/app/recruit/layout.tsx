import type { Metadata } from "next";
import { buildMetadata, breadcrumbJsonLd, productAppJsonLd, faqJsonLd, howToJsonLd, productKeywords } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = buildMetadata({
  title: "AI Recruiting Software & Job Search Workspace | Rolebolt",
  description:
    "Rolebolt is an AI recruiting workspace and applicant tracking system for hiring teams, plus a focused job-search workspace for candidates.",
  // The root route renders this same landing page. Keep /recruit as a
  // compatible deep link, but make the root URL canonical to avoid duplicate
  // landing-page indexing.
  path: "/",
  keywords: [...productKeywords.recruit],
  noIndex: true,
});

const recruitFaqs = [
  {
    question: "What is Rolebolt?",
    answer:
      "Rolebolt is an AI-powered applicant tracking system and hiring workspace that helps teams create jobs, assess candidates, automate pipeline actions, collaborate, and make informed hiring decisions.",
  },
  {
    question: "Can I start using Rolebolt without choosing a paid plan?",
    answer:
      "Rolebolt offers a free entry plan so teams can explore the workspace. Paid plans and Razorpay-ready upgrades are available for organisations that need more capacity and advanced workflow support.",
  },
  {
    question: "How does AI candidate scoring work?",
    answer:
      "Rolebolt analyses a candidate's resume against the job description and review rubric, then presents fit signals and supporting context so teams can focus their attention without treating automation as the final decision.",
  },
  {
    question: "Can I post jobs publicly on a job board?",
    answer:
      "Yes. Teams can publish public opportunities and share individual job pages so candidates can discover roles and apply through a focused experience.",
  },
  {
    question: "What is the AI job description writer?",
    answer:
      "When creating a job, Rolebolt can analyse the brief and help shape the description, assessment criteria and rubric before you publish. The resulting content remains editable by your team.",
  },
  {
    question: "Does Recruit AI support async candidate assessments?",
    answer:
      "Yes. Form jobs support structured applications and async assessments, with progress and scoring surfaced alongside the applicant timeline.",
  },
  {
    question: "Can job seekers also use Recruit AI to find jobs?",
    answer:
      "Yes. Job seekers can browse public opportunities, review candidate-match signals, apply, and keep resumes, cover letters, applications and interview preparation in one workspace.",
  },
  {
    question: "How is Recruit AI different from Naukri or LinkedIn Recruiter?",
    answer:
      "Rolebolt combines applicant tracking, structured form jobs, assessment workflows, hiring automation and candidate workspace tools in one product, with a free entry plan and paid capacity options.",
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
  name: "How to Post a Job and Hire with Rolebolt",
  description:
    "Step-by-step guide to posting a job listing, setting up a hiring pipeline, and reviewing candidates using Rolebolt.",
  totalTime: "PT10M",
  steps: [
    {
      name: "Sign up for a Rolebolt account",
      text: "Go to rolebolt.tech and create your account. Navigate to the recruiting workspace and select the role that fits your workflow.",
      url: "/signup",
    },
    {
      name: "Create your recruiter profile",
      text: "Set up your name, logo, description, and website — whether you're a company, educational institute, or individual recruiter. This appears on your public job board and individual job listings.",
      url: "/recruit",
    },
    {
      name: "Post your first job with AI",
      text: "Click 'Post a Job', enter the job title and key skills, and let AI generate a complete job description. Choose the niche category and set location, work mode, and salary range.",
      url: "/recruit",
    },
    {
      name: "Review incoming applications and candidate signals",
      text: "As candidates apply, Rolebolt organises resumes, assessment progress and review signals so your team can identify where to focus next.",
      url: "/recruit",
    },
    {
      name: "Send assessments and make hiring decisions",
      text: "Send assessments to shortlisted candidates, review responses and context, collaborate with your team, and make the final hiring decision.",
      url: "/recruit",
    },
  ],
});

export default function RecruitLayout({ children }: { children: React.ReactNode }) {
  return children;
}
