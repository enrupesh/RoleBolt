import type { Metadata } from "next";
import RecruitLandingPage from "@/app/recruit/page";
import { buildMetadata, faqJsonLd, howToJsonLd, productKeywords } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = buildMetadata({
  title: "AI Recruiting Software & Job Search Workspace | Rolebolt",
  description:
    "Rolebolt is an AI recruiting workspace and applicant tracking system for hiring teams, plus a focused job-search workspace for candidates.",
  path: "/",
  keywords: [...productKeywords.recruit],
});

export default function RootPage() {
  return (
    <>
      <JsonLd
        id="ld-faq-home"
        data={faqJsonLd([
          {
            question: "What is Rolebolt?",
            answer:
              "Rolebolt is an AI recruiting and job-search workspace that helps hiring teams publish jobs, review candidates, run assessments, automate repeatable pipeline actions, and collaborate with job seekers.",
          },
          {
            question: "Does Rolebolt include an applicant tracking system?",
            answer:
              "Yes. Rolebolt includes job creation, candidate pipelines, resume review, rubric-based scoring, assessments, hiring analytics, talent pools, collaboration, and offer workflows.",
          },
          {
            question: "Can job seekers use Rolebolt to find and apply for jobs?",
            answer:
              "Yes. Job seekers can browse public opportunities, compare their fit, track applications, tailor resumes and cover letters, and prepare for interviews in one career workspace.",
          },
          {
            question: "Can I start with a free Rolebolt plan?",
            answer:
              "Rolebolt offers a free entry plan for both recruiting and job-search workflows, with paid plans available when you need more capacity.",
          },
        ])}
      />
      <JsonLd
        id="ld-howto-home"
        data={howToJsonLd({
          name: "How to hire with Rolebolt",
          description:
            "Create a job, bring in applications, review candidate signals, and move the hiring process forward in the Rolebolt workspace.",
          totalTime: "PT10M",
          steps: [
            {
              name: "Create a hiring workspace",
              text: "Create a Rolebolt account and choose the recruiting workflow that fits your team.",
              url: "/recruit/signup",
            },
            {
              name: "Create a job",
              text: "Add the role brief, skills, location, work mode, compensation, and review criteria. Rolebolt can help draft the job description and rubric.",
              url: "/recruit/preview",
            },
            {
              name: "Publish and collect applications",
              text: "Publish a public opportunity or share a structured application form with candidates.",
              url: "/recruit/opportunities",
            },
            {
              name: "Review candidates with context",
              text: "Use resume signals, assessments, timelines, collaboration, and pipeline tools to focus human attention on the right next steps.",
              url: "/recruit/preview",
            },
          ],
        })}
      />
      <RecruitLandingPage />
    </>
  );
}
