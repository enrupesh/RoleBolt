export type ResourceAudience = "Recruiters" | "Job seekers";

export type ResourceSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type ResourceFaq = {
  question: string;
  answer: string;
};

export type ResourceArticle = {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  audience: ResourceAudience;
  category: string;
  readTime: string;
  publishedAt: string;
  modifiedAt: string;
  primaryKeyword: string;
  keywords: string[];
  summary: string;
  author: string;
  reviewer: string;
  image: string;
  imageAlt: string;
  sections: ResourceSection[];
  example: {
    title: string;
    text: string;
    bullets: string[];
  };
  faqs: ResourceFaq[];
  relatedSlugs: string[];
  cta: {
    label: string;
    href: string;
    text: string;
  };
};

const recruiterImage = "/screenshots/new-version/Screenshot_2026-08-03_174618_1785760271872.png";
const pipelineImage = "/screenshots/new-version/Screenshot_2026-08-03_174357_1785760819692.png";
const analyticsImage = "/screenshots/new-version/Screenshot_2026-08-03_174250_1785760819689.png";
const seekerImage = "/screenshots/new-version/Screenshot_2026-08-03_174833_1785760257253.png";
const resumeImage = "/screenshots/new-version/Screenshot_2026-08-03_174932_1785760207911.png";
const interviewImage = "/screenshots/new-version/Screenshot_2026-08-03_174900_1785760257255.png";

export const resourceArticles: ResourceArticle[] = [
  {
    slug: "ai-recruiting-software",
    title: "AI Recruiting Software: A Practical Guide for Hiring Teams",
    metaTitle: "AI Recruiting Software Guide for Hiring Teams",
    description: "Learn what AI recruiting software should do, how to evaluate it, and where human judgment still matters in a modern hiring process.",
    audience: "Recruiters",
    category: "Recruiting technology",
    readTime: "8 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "AI recruiting software",
    keywords: ["AI recruiting software", "AI hiring platform", "recruiting automation", "recruiter workflow"],
    summary: "The best AI recruiting software reduces repetitive work without turning hiring into an opaque score. Look for useful job setup, explainable candidate signals, structured collaboration, and a clear human decision point.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Product & Recruiting Team",
    image: recruiterImage,
    imageAlt: "Rolebolt AI job posting generator and hiring workflow preview",
    sections: [
      {
        heading: "What AI recruiting software actually helps with",
        paragraphs: [
          "Recruiting teams usually need help with a chain of small decisions: turning a role brief into a clear job description, organizing applications, comparing evidence against a rubric, and keeping candidates moving. AI is most valuable when it summarizes and structures that work so a recruiter can spend more time on judgment and communication.",
          "A useful platform should make the source of a recommendation visible. A score without the resume evidence, assessment answer, or rubric criterion behind it is not enough to make a responsible hiring decision.",
        ],
        bullets: [
          "Role intake, job description drafting, and consistent evaluation criteria.",
          "Resume parsing, candidate summaries, and evidence-linked fit signals.",
          "Structured assessments, pipeline actions, reminders, and collaboration.",
          "Analytics that show where candidates stall and which sources perform.",
        ],
      },
      {
        heading: "How to evaluate an AI hiring platform",
        paragraphs: [
          "Start with one repeatable role rather than buying for every edge case. Measure how long it takes to create the role, review the first group of candidates, send a useful follow-up, and explain a decision to another interviewer.",
          "Ask vendors how they handle incomplete resumes, unusual career paths, accommodations, candidate privacy, and incorrect AI output. A trustworthy product makes correction easy and does not pretend that automation removes bias by itself.",
        ],
        bullets: [
          "Can the team edit the job rubric before applications arrive?",
          "Can reviewers see why a candidate signal was produced?",
          "Are automated actions configurable and reversible?",
          "Can the system export or delete candidate data when required?",
        ],
      },
      {
        heading: "Where Rolebolt fits",
        paragraphs: [
          "Rolebolt brings job creation, candidate pipelines, rubric-based scoring, assessments, analytics, talent pools, and recruiter collaboration into one workspace. Teams can start with a standard job workflow or use a lighter form-based intake flow.",
          "The product preview shows the actual recruiting surfaces, including the AI job posting generator and candidate pipeline. Use it to decide whether the workflow matches your team before creating an account.",
        ],
      },
    ],
    example: {
      title: "Example: a small team hiring a customer success manager",
      text: "Instead of ranking applicants against a vague “great communicator” requirement, define observable signals before review starts:",
      bullets: ["Three examples of customer-facing problem solving.", "Experience with the team’s support or CRM workflow.", "A short written scenario scored against the same rubric for every applicant."],
    },
    faqs: [
      { question: "Does AI recruiting software replace recruiters?", answer: "No. It can reduce repetitive review and coordination work, but people should define criteria, review evidence, communicate with candidates, and make the final decision." },
      { question: "What is the most important AI recruiting feature?", answer: "For many teams, the most useful starting point is explainable candidate review tied to a role-specific rubric, because it makes comparisons more consistent without hiding the evidence." },
      { question: "Is Rolebolt an applicant tracking system?", answer: "Rolebolt includes applicant tracking, candidate pipelines, resume review, assessments, analytics, and collaboration alongside AI-assisted recruiting workflows." },
    ],
    relatedSlugs: ["applicant-tracking-system", "ai-resume-screening", "recruiting-pipeline-management"],
    cta: { label: "Explore Rolebolt for recruiters", href: "/recruit/preview", text: "See the recruiting workflow and product screens before you start." },
  },
  {
    slug: "applicant-tracking-system",
    title: "Applicant Tracking System: What to Look For in 2026",
    metaTitle: "Applicant Tracking System Guide | Rolebolt",
    description: "Compare the core applicant tracking system features that help teams organize hiring, collaborate on candidates, and improve follow-through.",
    audience: "Recruiters",
    category: "Recruiting technology",
    readTime: "9 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "applicant tracking system",
    keywords: ["applicant tracking system", "ATS software", "candidate pipeline", "hiring workflow"],
    summary: "An applicant tracking system should be the reliable source of truth for a role: who applied, what evidence they shared, what happens next, and who owns the next action.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Product & Recruiting Team",
    image: pipelineImage,
    imageAlt: "Rolebolt candidate pipeline for applicant tracking",
    sections: [
      {
        heading: "The job of an ATS",
        paragraphs: [
          "An applicant tracking system is more than a list of resumes. It connects a job description, applications, candidate evidence, stage history, interviewer feedback, and communication. When those pieces live in separate spreadsheets and inboxes, candidates get inconsistent updates and hiring managers lose context.",
          "A good ATS gives every role a visible workflow while keeping the candidate record understandable. The right level of structure depends on the hiring volume and the complexity of the role.",
        ],
      },
      {
        heading: "Core features worth comparing",
        paragraphs: ["Use a simple scorecard when comparing ATS products. A feature matters when it removes a real failure point in your current process."],
        bullets: [
          "Role and rubric setup before candidate review.",
          "Application intake with resume and profile data in one record.",
          "Custom stages, bulk actions, notes, reminders, and candidate communication.",
          "Structured assessments and interviewer collaboration.",
          "Reports for time in stage, source quality, and pipeline health.",
          "Data export, deletion controls, access boundaries, and audit history.",
        ],
      },
      {
        heading: "Choosing between a lightweight and full ATS workflow",
        paragraphs: [
          "A small business may only need a structured application form and a clear review queue for occasional hiring. A growing team may need a full pipeline, role-specific scoring, assessments, permissions, and analytics.",
          "Choose the lightest workflow that keeps decisions consistent. A complex ATS that nobody updates creates less visibility than a simple system the team uses every day.",
        ],
      },
    ],
    example: {
      title: "ATS scorecard for a 10-person hiring team",
      text: "Before selecting a system, ask the team to complete the same five-minute exercise:",
      bullets: ["Create a role with two must-have criteria.", "Move a sample candidate through three stages.", "Find the next owner and explain why the candidate is in that stage."],
    },
    faqs: [
      { question: "What does ATS stand for?", answer: "ATS stands for applicant tracking system. It organizes job applications, candidate records, stages, feedback, and hiring actions." },
      { question: "Do startups need an applicant tracking system?", answer: "A startup can benefit from an ATS as soon as multiple people review candidates or more than a few roles are active. The workflow can start lightweight and become more structured as volume grows." },
      { question: "What makes an ATS easy to use?", answer: "Clear role setup, fast candidate review, visible next actions, useful defaults, and low-friction updates usually matter more than a long feature list." },
    ],
    relatedSlugs: ["ai-recruiting-software", "recruiting-pipeline-management", "candidate-assessment-software"],
    cta: { label: "See the Rolebolt ATS workflow", href: "/recruit/preview", text: "Explore candidate pipelines, assessments, analytics, and role setup." },
  },
  {
    slug: "free-ats-for-startups",
    title: "Free ATS for Startups: A Sensible Way to Start Hiring",
    metaTitle: "Free ATS for Startups: What to Check",
    description: "A practical guide to choosing a free ATS for a startup without losing candidate context, hiring consistency, or control of your data.",
    audience: "Recruiters",
    category: "Startup hiring",
    readTime: "7 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "free ATS for startups",
    keywords: ["free ATS for startups", "free recruiting software", "startup hiring tools", "small team ATS"],
    summary: "A free ATS is useful when it helps a startup build repeatable hiring habits without forcing a large implementation project. Check capacity, collaboration, candidate data controls, and upgrade clarity before committing.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Product & Recruiting Team",
    image: recruiterImage,
    imageAlt: "Rolebolt recruiting workspace for a startup hiring team",
    sections: [
      {
        heading: "Why startups outgrow spreadsheets",
        paragraphs: [
          "Spreadsheets are fine for a single founder-led search. They become fragile when a hiring manager, recruiter, and interviewer all need to see the same candidate status. Duplicated files, missing follow-ups, and inconsistent notes create avoidable delays.",
          "A free ATS should solve the basics first: one role record, one candidate record, a clear stage history, and a next action that someone owns.",
        ],
      },
      {
        heading: "Free plan questions to ask",
        paragraphs: ["“Free” is not a complete comparison. Review the limits that affect whether the team can actually use the workflow."],
        bullets: [
          "How many active roles and candidates are included?",
          "Can more than one teammate review a candidate?",
          "Are resume uploads and structured forms supported?",
          "Can you export or delete your data?",
          "What happens when you reach a plan limit?",
        ],
      },
      {
        heading: "Keep the first workflow simple",
        paragraphs: [
          "Choose one hiring rubric and one weekly pipeline review. Do not automate rejection or candidate communication until the team has reviewed the quality of the signals and agreed on the process.",
          "Rolebolt offers a free entry path for recruiting teams, with standard jobs for a fuller pipeline and form jobs for lighter candidate intake. Check the current plan details before making a purchasing decision.",
        ],
      },
    ],
    example: {
      title: "A startup’s first ATS setup",
      text: "A practical first version can have four stages and one weekly owner:",
      bullets: ["New application", "Review", "Interview", "Decision"],
    },
    faqs: [
      { question: "What is the best free ATS for a startup?", answer: "The best free ATS is the one that covers the startup’s current volume, supports the people involved in review, protects candidate data, and makes future limits clear. Requirements matter more than a universal ranking." },
      { question: "Can a startup use a free ATS without a recruiter?", answer: "Yes. A founder or hiring manager can use a lightweight ATS if the role criteria, stages, ownership, and communication process are defined first." },
      { question: "Should startups automate candidate rejection?", answer: "Only after reviewing the quality of the criteria and the candidate signals. Human review and a clear appeal or correction path are safer for early hiring workflows." },
    ],
    relatedSlugs: ["ai-recruiting-software", "recruiting-pipeline-management", "candidate-experience"],
    cta: { label: "Compare Rolebolt recruiting workflows", href: "/recruit/pricing", text: "Review the current plans and choose the workflow that fits your hiring volume." },
  },
  {
    slug: "ai-resume-screening",
    title: "AI Resume Screening: Make Review Faster Without Losing Context",
    metaTitle: "AI Resume Screening Guide | Rolebolt",
    description: "Learn how to use AI resume screening responsibly with role-specific criteria, evidence-based review, and human decisions.",
    audience: "Recruiters",
    category: "Candidate review",
    readTime: "8 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "AI resume screening",
    keywords: ["AI resume screening", "resume screening software", "AI resume scoring", "candidate review"],
    summary: "AI resume screening is most useful as a prioritization and summarization layer. It should point reviewers to evidence, not make an unreviewable decision about a person.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Product & Recruiting Team",
    image: pipelineImage,
    imageAlt: "Rolebolt AI-scored candidate pipeline with review context",
    sections: [
      {
        heading: "What responsible resume screening looks like",
        paragraphs: [
          "A resume screening system can extract skills, experience, and relevant evidence from a large applicant pool. The output becomes useful when it is tied to requirements that were defined before seeing candidates and when reviewers can inspect the evidence behind a recommendation.",
          "Screening should not treat a particular school, employer, career path, writing style, or gap as a universal proxy for ability. Requirements should be job-related, observable, and open to equivalent experience.",
        ],
      },
      {
        heading: "Build a better screening rubric",
        paragraphs: ["Write criteria in a way two reviewers could apply consistently. Separate required evidence from signals that are merely nice to have."],
        bullets: [
          "Define the outcome the person must deliver in the first six months.",
          "List skills that are truly required on day one.",
          "Allow equivalent experience and transferable skills.",
          "Ask for an example or work sample when the resume is ambiguous.",
          "Review false positives and false negatives before changing thresholds.",
        ],
      },
      {
        heading: "Use screening as a review queue",
        paragraphs: [
          "The practical goal is not to find a magical score. It is to help a recruiter decide what to read first, which evidence needs clarification, and where a second reviewer should look.",
          "Rolebolt’s candidate pipeline combines role criteria, AI fit signals, assessments, notes, and stage actions so a score can sit alongside the rest of the hiring context.",
        ],
      },
    ],
    example: {
      title: "Resume screening example",
      text: "For a customer support lead, replace “strong communication” with evidence reviewers can discuss:",
      bullets: ["Owned a support queue or service metric.", "Coached or enabled other support teammates.", "Explained a difficult customer outcome and the trade-off made."],
    },
    faqs: [
      { question: "Can AI screen resumes accurately?", answer: "AI can extract and summarize resume information, but accuracy depends on the job criteria, input quality, and human review. It should support prioritization rather than make an unreviewable final decision." },
      { question: "How do I reduce bias in AI resume screening?", answer: "Use job-related criteria, review equivalent experience, inspect evidence, monitor false positives and negatives, and keep people responsible for hiring decisions." },
      { question: "Does Rolebolt show why a candidate received a score?", answer: "Rolebolt is designed around candidate signals and role-specific criteria so recruiters can review the context behind an AI-assisted recommendation." },
    ],
    relatedSlugs: ["ai-recruiting-software", "candidate-matching-software", "candidate-assessment-software"],
    cta: { label: "See candidate review in Rolebolt", href: "/recruit/preview", text: "Explore the AI-scored pipeline and detailed candidate evaluation screens." },
  },
  {
    slug: "candidate-matching-software",
    title: "Candidate Matching Software: From Keywords to Role Fit",
    metaTitle: "Candidate Matching Software Guide | Rolebolt",
    description: "Understand what candidate matching software can and cannot tell you, and how to connect matches to evidence and hiring criteria.",
    audience: "Recruiters",
    category: "Candidate review",
    readTime: "7 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "candidate matching software",
    keywords: ["candidate matching software", "AI candidate matching", "talent matching", "recruiting match score"],
    summary: "Candidate matching works best when it compares a person’s evidence with the outcomes and requirements of a specific role, not when it rewards keyword density.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Product & Recruiting Team",
    image: pipelineImage,
    imageAlt: "Rolebolt candidate matching and scoring workflow",
    sections: [
      {
        heading: "What a matching score should mean",
        paragraphs: [
          "A match score should answer a narrow question: how much of the available evidence aligns with this role’s defined needs? It is not a measure of a candidate’s worth, future potential, or fit with every team.",
          "The score is more useful when it separates required skills, relevant experience, transferable evidence, and unknowns. Unknown is often a better label than “no” when the resume does not provide enough detail.",
        ],
      },
      {
        heading: "Design role criteria before matching",
        paragraphs: ["Matching quality depends more on the role brief than on the number of candidates in the database."],
        bullets: [
          "Describe the work and outcomes, not just a list of tools.",
          "Mark which criteria are required, trainable, or preferred.",
          "Add a realistic seniority and location context.",
          "Keep the rubric short enough that reviewers can explain it.",
        ],
      },
      {
        heading: "Use matches to decide the next question",
        paragraphs: [
          "A low-confidence match may need a clarifying question, a work sample, or a second look—not an automatic rejection. A strong match still needs a conversation about motivation, communication, and the actual work.",
          "Rolebolt combines match signals with pipeline stages, assessments, and notes so teams can turn a match into a structured next action.",
        ],
      },
    ],
    example: {
      title: "A useful match summary",
      text: "For a data analyst role, a reviewer-friendly summary could separate:",
      bullets: ["Direct evidence: built recurring reports for a business team.", "Transferable evidence: analyzed operational data in another domain.", "Open question: depth of SQL work is not clear from the resume."],
    },
    faqs: [
      { question: "Is a candidate match score the same as a hiring decision?", answer: "No. A match score is a decision-support signal based on available evidence for one role. It should be reviewed with the full candidate record and human judgment." },
      { question: "Do matching systems only search keywords?", answer: "Some systems do. Better matching considers context, outcomes, transferable skills, and role criteria, but teams should still inspect the underlying evidence." },
      { question: "How can recruiters explain a match score?", answer: "Use a role-specific rubric and show the evidence, unknowns, and criteria behind the score. That gives reviewers something concrete to validate or correct." },
    ],
    relatedSlugs: ["ai-resume-screening", "recruiting-pipeline-management", "candidate-assessment-software"],
    cta: { label: "Explore AI candidate matching", href: "/recruit/preview", text: "See how Rolebolt connects match signals with pipeline review." },
  },
  {
    slug: "recruiting-pipeline-management",
    title: "Recruiting Pipeline Management: A Clearer Hiring Process",
    metaTitle: "Recruiting Pipeline Management Guide",
    description: "Build a recruiting pipeline that makes ownership, candidate stages, follow-ups, and hiring decisions visible to the whole team.",
    audience: "Recruiters",
    category: "Hiring operations",
    readTime: "8 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "recruiting pipeline management",
    keywords: ["recruiting pipeline management", "candidate pipeline", "hiring stages", "recruiting workflow"],
    summary: "A healthy recruiting pipeline shows what stage each candidate is in, what evidence is available, who owns the next action, and where the process is slowing down.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Product & Recruiting Team",
    image: pipelineImage,
    imageAlt: "Rolebolt recruiting pipeline with candidate stages",
    sections: [
      {
        heading: "Start with stages that describe decisions",
        paragraphs: [
          "Stages should tell the team what has happened and what must happen next. “Maybe” and “Follow up” are hard to manage because they hide the decision or action underneath.",
          "A simple pipeline might include New application, Recruiter review, Interview, Assessment, Offer, and Closed. Adjust it to the role, but keep stage definitions written down.",
        ],
      },
      {
        heading: "Make ownership visible",
        paragraphs: ["Every active candidate should have a next action and an owner. This is more valuable than adding another automation rule."],
        bullets: [
          "Set a realistic target time for each stage.",
          "Record the reason for a stage change.",
          "Use reminders for candidate-facing commitments.",
          "Review stale candidates separately from active decisions.",
          "Give interviewers structured prompts and a clear return path.",
        ],
      },
      {
        heading: "Measure flow, not vanity",
        paragraphs: [
          "Count the time candidates spend in each stage, the conversion between stages, the source quality, and the reasons searches close. A large top-of-funnel number does not help if the team cannot review candidates fairly.",
          "Rolebolt’s pipeline and analytics surfaces are designed to keep stage decisions, candidate context, and next actions in one recruiting workspace.",
        ],
      },
    ],
    example: {
      title: "Weekly pipeline review",
      text: "A 20-minute review can ask four questions:",
      bullets: ["Which candidates need a response today?", "Which stage has the oldest candidates?", "Which decisions are blocked by missing evidence?", "Which role criteria need clarification?"],
    },
    faqs: [
      { question: "How many stages should a recruiting pipeline have?", answer: "Use enough stages to represent meaningful decisions and ownership, but not so many that people stop updating them. Many teams can begin with four to seven clear stages." },
      { question: "What is a stale candidate?", answer: "A stale candidate is someone who has remained in a stage longer than the team’s agreed service level without a recorded next action or update." },
      { question: "Can a recruiting pipeline be automated?", answer: "Some reminders, routing, and stage actions can be automated. Candidate-impacting decisions should have clear criteria, visibility, and human oversight." },
    ],
    relatedSlugs: ["applicant-tracking-system", "candidate-experience", "recruiting-analytics-guide"],
    cta: { label: "See the Rolebolt pipeline", href: "/recruit/preview", text: "Explore stage review, candidate actions, and pipeline health." },
  },
  {
    slug: "ai-job-description-generator",
    title: "AI Job Description Generator: Write Clearer Roles",
    metaTitle: "AI Job Description Generator Guide",
    description: "Use an AI job description generator to turn a role brief into a clear, inclusive job post without hiding the real work.",
    audience: "Recruiters",
    category: "Job posts",
    readTime: "7 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "AI job description generator",
    keywords: ["AI job description generator", "AI job posting generator", "write job descriptions", "hiring rubric"],
    summary: "AI can help draft a job description, but the hiring team still owns the scope, requirements, compensation, and candidate promise. Start with the work, then edit for clarity.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Product & Recruiting Team",
    image: recruiterImage,
    imageAlt: "Rolebolt AI job description generator setup",
    sections: [
      {
        heading: "Give the generator a real role brief",
        paragraphs: [
          "A vague prompt creates a generic job post. Include the outcomes the person owns, the team they work with, the decisions they make, the required skills, the location and work mode, and the compensation range when available.",
          "The job post should describe the actual role rather than copy a list of aspirational traits. Candidates need enough detail to decide whether the opportunity fits them.",
        ],
      },
      {
        heading: "Edit the draft before publishing",
        paragraphs: ["Treat AI output as a first draft. The hiring manager should verify every requirement and remove inflated language."],
        bullets: [
          "Separate must-have requirements from preferences.",
          "Explain the first 90-day outcomes.",
          "Use plain language and define internal acronyms.",
          "State salary, location, work mode, and employment type clearly.",
          "Check that the evaluation rubric matches the published role.",
        ],
      },
      {
        heading: "Connect the job post to evaluation",
        paragraphs: [
          "The strongest workflow does not stop at publishing. The criteria in the job post should inform the review rubric, assessment questions, and interview prompts so candidates are evaluated on what they were told mattered.",
          "Rolebolt’s job posting workflow can help create a job description and scoring rubric from the same role setup, which reduces drift between the post and the hiring process.",
        ],
      },
    ],
    example: {
      title: "Prompt ingredients for a product designer role",
      text: "Before generating a draft, collect:",
      bullets: ["The product problem and user group.", "Two measurable outcomes for the first six months.", "Three skills that are genuinely required.", "The interview evidence that will test each requirement."],
    },
    faqs: [
      { question: "Can AI write a job description by itself?", answer: "AI can create a useful first draft from a detailed brief, but a hiring manager must verify the scope, requirements, compensation, and promises before publishing." },
      { question: "How long should a job description be?", answer: "It should be long enough to explain the work, expectations, requirements, and logistics clearly. Clarity is more important than hitting a specific word count." },
      { question: "Should a job description include salary?", answer: "Where possible, a clear salary range helps candidates make an informed decision and sets a more transparent expectation for the process." },
    ],
    relatedSlugs: ["candidate-assessment-software", "ai-recruiting-software", "candidate-experience"],
    cta: { label: "Try Rolebolt’s job workflow", href: "/recruit/preview", text: "See how a role brief can connect to a job post and evaluation rubric." },
  },
  {
    slug: "candidate-assessment-software",
    title: "Candidate Assessment Software: Build Better Work Samples",
    metaTitle: "Candidate Assessment Software Guide",
    description: "Choose candidate assessment software and design work samples that measure job-related skills without creating unnecessary candidate effort.",
    audience: "Recruiters",
    category: "Assessment",
    readTime: "8 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "candidate assessment software",
    keywords: ["candidate assessment software", "hiring assessment", "candidate work sample", "structured assessment"],
    summary: "A good candidate assessment asks for evidence that resembles the work, uses a consistent rubric, and respects the candidate’s time and access needs.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Product & Recruiting Team",
    image: pipelineImage,
    imageAlt: "Rolebolt candidate assessment review screen",
    sections: [
      {
        heading: "What makes an assessment job-related",
        paragraphs: [
          "An assessment should sample a meaningful task from the role. A support candidate might respond to a customer scenario; an analyst might explain a small data decision; a manager might prioritize a realistic set of trade-offs.",
          "Avoid puzzles or long unpaid projects that test endurance more than capability. Tell candidates how long the exercise should take and what the team will evaluate.",
        ],
      },
      {
        heading: "Use one rubric for consistent review",
        paragraphs: ["A rubric helps interviewers discuss the work rather than rely on a general impression."],
        bullets: [
          "Define three to five observable criteria.",
          "Use examples of strong, acceptable, and weak evidence.",
          "Allow reviewers to add a short rationale.",
          "Separate missing information from poor performance.",
          "Give candidates a timeline and a contact for accessibility questions.",
        ],
      },
      {
        heading: "Assessment data should lead to a next action",
        paragraphs: [
          "The output should help a team decide whether to clarify, interview, advance, or close the application. It should not disappear into a separate tool where the recruiter cannot connect it to the candidate’s other evidence.",
          "Rolebolt supports structured candidate assessments alongside the application, score context, pipeline stage, notes, and follow-up actions.",
        ],
      },
    ],
    example: {
      title: "A 30-minute product marketing assessment",
      text: "Ask the candidate to turn a short product brief into:",
      bullets: ["One target audience statement.", "A concise positioning paragraph.", "Two success metrics and the assumption behind each."],
    },
    faqs: [
      { question: "How long should a hiring assessment take?", answer: "It depends on the role, but a focused work sample should have a clear time expectation and avoid asking candidates to complete a large amount of unpaid work." },
      { question: "What is a structured assessment?", answer: "It is an assessment with the same prompt or comparable task, defined evaluation criteria, and a consistent review process for candidates." },
      { question: "Can AI score candidate assessments?", answer: "AI can summarize responses and map evidence to a rubric, but reviewers should validate the output and remain responsible for the decision." },
    ],
    relatedSlugs: ["ai-resume-screening", "candidate-matching-software", "candidate-experience"],
    cta: { label: "Explore Rolebolt assessments", href: "/recruit/preview", text: "See assessment responses, scores, summaries, and next actions in one view." },
  },
  {
    slug: "hiring-automation-for-small-business",
    title: "Hiring Automation for Small Businesses: Start with the Basics",
    metaTitle: "Hiring Automation for Small Business",
    description: "A practical small-business guide to automating hiring reminders, intake, and review while keeping candidate communication human.",
    audience: "Recruiters",
    category: "Small business hiring",
    readTime: "7 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "hiring automation for small businesses",
    keywords: ["hiring automation for small business", "small business recruiting", "recruiting automation", "automated hiring workflow"],
    summary: "Small teams do not need to automate everything. Start with repetitive coordination work, define the human handoff, and measure whether candidates receive faster and clearer communication.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Product & Recruiting Team",
    image: recruiterImage,
    imageAlt: "Rolebolt hiring automation and recruiter workflow",
    sections: [
      {
        heading: "Good first automations",
        paragraphs: [
          "The best first automation is usually a reminder or routing step that the team already repeats. Examples include notifying a reviewer when an application arrives, reminding an owner about a stale candidate, or collecting a structured answer before an interview.",
          "Automate the movement of information before automating a decision about a person.",
        ],
        bullets: [
          "Application acknowledgements and scheduling reminders.",
          "Candidate routing based on role, location, or required information.",
          "Assessment invitations with clear time expectations.",
          "Pipeline health alerts and daily review summaries.",
        ],
      },
      {
        heading: "Keep a human checkpoint",
        paragraphs: [
          "Every candidate-facing or candidate-impacting automation needs an owner. The team should know what happened, why it happened, and how to correct it when the data is incomplete.",
          "Use a small pilot, review the outcomes, and expand only after the workflow is reliable. A fast wrong message still creates a poor candidate experience.",
        ],
      },
      {
        heading: "Measure time saved and trust gained",
        paragraphs: ["Track practical measures rather than the number of automations enabled:"],
        bullets: ["Time from application to first useful response.", "Time candidates spend waiting in each stage.", "Reviewer adoption and correction rate.", "Candidate questions caused by unclear automation."],
      },
    ],
    example: {
      title: "A simple automation for a five-person business",
      text: "When a candidate submits a form, the workflow can:",
      bullets: ["Send a clear confirmation.", "Assign the application to one reviewer.", "Create a review reminder.", "Leave the advance or close decision to a person."],
    },
    faqs: [
      { question: "What should a small business automate first in hiring?", answer: "Start with repetitive coordination such as acknowledgements, reminders, routing, and structured information collection. Keep candidate-impacting decisions under human review." },
      { question: "Is hiring automation expensive?", answer: "The cost depends on the workflow and volume. A focused system that removes missed follow-ups can be valuable before a team needs a complex enterprise implementation." },
      { question: "How does automation affect candidate experience?", answer: "It can improve candidate experience when it makes communication faster and clearer. It harms the experience when messages are impersonal, late, or impossible to correct." },
    ],
    relatedSlugs: ["recruiting-pipeline-management", "candidate-experience", "free-ats-for-startups"],
    cta: { label: "See Rolebolt automation surfaces", href: "/recruit/preview", text: "Explore pipeline rules, review workflows, and candidate communication tools." },
  },
  {
    slug: "how-to-screen-resumes-faster",
    title: "How to Screen Resumes Faster and More Consistently",
    metaTitle: "How to Screen Resumes Faster | Rolebolt",
    description: "Use this practical resume screening process to review applications faster while keeping criteria consistent and evidence-based.",
    audience: "Recruiters",
    category: "Recruiting playbooks",
    readTime: "6 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "how to screen resumes faster",
    keywords: ["how to screen resumes faster", "resume screening process", "resume review checklist", "AI resume screening"],
    summary: "Faster resume screening comes from better preparation: define the role, use a short rubric, batch similar work, record a reason, and reserve time for uncertain cases.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Product & Recruiting Team",
    image: pipelineImage,
    imageAlt: "Rolebolt resume and candidate pipeline review",
    sections: [
      {
        heading: "1. Define the screen before opening resumes",
        paragraphs: [
          "Write three to five criteria that are genuinely relevant to the work. Decide what evidence would count and what you will do when the resume does not answer the question.",
          "This prevents the first few resumes from changing the standard for everyone who comes later.",
        ],
      },
      {
        heading: "2. Review in consistent passes",
        paragraphs: ["Batching reduces context switching and makes comparisons easier."],
        bullets: [
          "Pass one: confirm basic role, location, work authorization, or other stated requirements.",
          "Pass two: look for evidence against the role rubric.",
          "Pass three: identify an interview question or missing detail.",
          "Record a short reason for advancing, holding, or closing.",
        ],
      },
      {
        heading: "3. Use AI to summarize, not decide",
        paragraphs: [
          "AI resume screening can extract evidence and surface likely matches, especially when application volume is high. Reviewers should still inspect the source information, consider equivalent experience, and correct errors.",
          "A structured pipeline makes the process easier to audit because the stage decision, rationale, and next action stay with the candidate record.",
        ],
      },
    ],
    example: {
      title: "Five-minute screen checklist",
      text: "For every resume, answer the same questions:",
      bullets: ["What evidence matches the top two role outcomes?", "What is unclear or missing?", "What is the next fair way to learn more?"],
    },
    faqs: [
      { question: "How long should a resume screen take?", answer: "It depends on the role and volume. A consistent first pass often takes only a few minutes when criteria are defined, while uncertain applications deserve a deeper review." },
      { question: "What should I look for first on a resume?", answer: "Start with evidence related to the role’s most important outcomes and required skills rather than scanning for prestigious names or a particular career path." },
      { question: "Can AI help screen a large number of resumes?", answer: "Yes, AI can summarize and prioritize resumes, but teams should review the evidence, monitor errors, and keep the final decision with people." },
    ],
    relatedSlugs: ["ai-resume-screening", "candidate-matching-software", "candidate-assessment-software"],
    cta: { label: "Review candidates with Rolebolt", href: "/recruit/preview", text: "See a structured AI-assisted candidate review workflow." },
  },
  {
    slug: "candidate-experience",
    title: "How to Improve Candidate Experience at Every Hiring Stage",
    metaTitle: "How to Improve Candidate Experience",
    description: "Improve candidate experience with clear job posts, predictable stages, timely updates, accessible assessments, and respectful close-outs.",
    audience: "Recruiters",
    category: "Candidate experience",
    readTime: "8 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "how to improve candidate experience",
    keywords: ["candidate experience", "how to improve candidate experience", "hiring communication", "candidate journey"],
    summary: "Candidate experience is built from small moments: the job post, the application form, the waiting period, the interview, and the message that closes the process.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Product & Recruiting Team",
    image: "/screenshots/new-version/Screenshot_2026-08-03_174554_1785760271871.png",
    imageAlt: "Rolebolt recruiter email outreach and candidate communication",
    sections: [
      {
        heading: "Set an accurate expectation",
        paragraphs: [
          "A clear job post is the first candidate experience surface. Explain the role, work mode, location, compensation when available, interview steps, and the type of evidence the team will evaluate.",
          "Do not promise a timeline the team cannot keep. If the process changes, update candidates instead of making them guess.",
        ],
      },
      {
        heading: "Make every step purposeful",
        paragraphs: ["Candidates are more willing to invest time when each step has a clear reason."],
        bullets: [
          "Keep application questions relevant and concise.",
          "Tell candidates how long an assessment should take.",
          "Offer an accessibility contact or alternative when needed.",
          "Share what the next decision will be and when to expect it.",
          "Close the loop with a respectful, timely message.",
        ],
      },
      {
        heading: "Use pipeline visibility to keep promises",
        paragraphs: [
          "Candidate experience often breaks because the hiring team cannot see who is waiting or who owns the response. Stale-stage alerts, reminders, and a shared candidate timeline can turn good intentions into consistent behavior.",
          "Rolebolt helps teams keep candidate stages, outreach, assessments, and next actions together so communication does not depend on one person’s inbox.",
        ],
      },
    ],
    example: {
      title: "A useful status update",
      text: "A short update can be honest without overpromising:",
      bullets: ["Where the candidate is in the process.", "What the team is reviewing now.", "The next expected update date.", "A contact for questions or accommodations."],
    },
    faqs: [
      { question: "What improves candidate experience the most?", answer: "Clear expectations, relevant steps, timely communication, accessible processes, and respectful closure usually have the biggest impact." },
      { question: "How often should recruiters update candidates?", answer: "Update candidates whenever the promised timeline changes. Even a short message that there is no decision yet is better than unexplained silence." },
      { question: "Does automation make candidate experience impersonal?", answer: "It can if used poorly. Automation should support faster, accurate communication while leaving room for human questions and context." },
    ],
    relatedSlugs: ["recruiting-pipeline-management", "candidate-assessment-software", "ai-job-description-generator"],
    cta: { label: "Build a clearer candidate workflow", href: "/recruit/preview", text: "Explore Rolebolt’s pipeline, outreach, and assessment surfaces." },
  },
  {
    slug: "recruiting-analytics-guide",
    title: "Recruiting Analytics Guide: Metrics That Improve Decisions",
    metaTitle: "Recruiting Analytics Guide | Rolebolt",
    description: "Use recruiting analytics to find pipeline bottlenecks, compare sources, improve follow-through, and make better hiring decisions.",
    audience: "Recruiters",
    category: "Hiring operations",
    readTime: "8 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "recruiting analytics guide",
    keywords: ["recruiting analytics guide", "recruiting metrics", "hiring funnel analytics", "talent acquisition metrics"],
    summary: "Recruiting analytics are useful when they answer a decision question: where is the process slowing, which sources produce relevant candidates, and what should the team change next?",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Product & Recruiting Team",
    image: analyticsImage,
    imageAlt: "Rolebolt recruiting analytics dashboard with pipeline metrics",
    sections: [
      {
        heading: "Start with flow metrics",
        paragraphs: [
          "Measure how candidates move through the process: time in stage, conversion between stages, response time, and the number of active candidates with a next action. These metrics reveal operational friction before a search closes.",
          "Use a consistent date range and define each metric. “Time to hire” can mean time from approval to acceptance, while “time to fill” may start earlier.",
        ],
      },
      {
        heading: "Compare sources carefully",
        paragraphs: ["Source volume alone can be misleading. A smaller source may produce more relevant candidates or faster decisions."],
        bullets: [
          "Applications by source and role.",
          "Qualified or advanced candidates by source.",
          "Interview and offer conversion by source.",
          "Time spent by the team on each source.",
          "Candidate experience signals and drop-off.",
        ],
      },
      {
        heading: "Turn a metric into an experiment",
        paragraphs: [
          "If candidates wait too long after an assessment, assign an owner and set a review window. If a source produces many applications but few relevant candidates, improve the job post or change the channel. Keep the next action small enough to evaluate.",
          "Rolebolt’s analytics surfaces bring pipeline health, stage distribution, source quality, and outcomes into the recruiting workspace.",
        ],
      },
    ],
    example: {
      title: "A useful monthly review",
      text: "Ask the team to bring one metric and one action:",
      bullets: ["Metric: median days in recruiter review.", "Observation: candidates wait longer on roles without a named reviewer.", "Action: assign a reviewer at intake and review the change next month."],
    },
    faqs: [
      { question: "What are the most important recruiting metrics?", answer: "Start with time in stage, stage conversion, response time, source quality, candidate drop-off, and outcomes. Choose metrics that lead to a decision." },
      { question: "How can recruiting analytics improve hiring?", answer: "Analytics can reveal bottlenecks, inconsistent follow-through, weak sources, and stage drop-off so teams can test focused process improvements." },
      { question: "Should recruiting teams optimize for speed only?", answer: "No. Speed should be balanced with quality, fairness, candidate experience, and the needs of the role. A fast process that produces poor decisions is not healthy." },
    ],
    relatedSlugs: ["recruiting-pipeline-management", "applicant-tracking-system", "hiring-automation-for-small-business"],
    cta: { label: "Explore Rolebolt recruiting analytics", href: "/recruit/preview", text: "See pipeline funnel, stage distribution, source quality, and hiring outcomes." },
  },
  {
    slug: "ai-resume-builder",
    title: "AI Resume Builder: Create a Resume That Shows Your Work",
    metaTitle: "AI Resume Builder Guide | Rolebolt",
    description: "Learn how to use an AI resume builder to organize your experience, tailor evidence to a role, and keep your resume truthful.",
    audience: "Job seekers",
    category: "Resume and applications",
    readTime: "7 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "AI resume builder",
    keywords: ["AI resume builder", "ATS-friendly resume", "resume writing", "resume improvement"],
    summary: "An AI resume builder is most helpful when it turns your real experience into clear, specific evidence. It should improve structure and language, not invent achievements.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Career Guidance Team",
    image: resumeImage,
    imageAlt: "Rolebolt AI resume builder workspace",
    sections: [
      {
        heading: "Start with an evidence bank",
        paragraphs: [
          "Before asking AI to write a resume, collect projects, responsibilities, outcomes, tools, and examples of difficult problems you solved. Include numbers only when you can explain where they came from.",
          "A strong resume is not a list of tasks. It helps a reader understand what changed because you did the work.",
        ],
        bullets: ["Action: what did you do?", "Context: what problem or scope did you own?", "Outcome: what changed, improved, shipped, or became easier?", "Evidence: how could a hiring team verify the claim?"],
      },
      {
        heading: "Use AI as an editor and organizer",
        paragraphs: [
          "AI can suggest concise bullets, identify repeated language, and help organize a resume around a target role. Review every sentence for accuracy, tone, and whether it sounds like you.",
          "Do not add a tool, title, metric, certification, or project simply because it appears in a suggested draft.",
        ],
      },
      {
        heading: "Make the document easy to scan",
        paragraphs: ["Recruiters often review quickly, so make the strongest relevant evidence easy to find."],
        bullets: ["Use clear section headings and consistent dates.", "Place the most relevant achievements near the top.", "Avoid decorative layouts that make text difficult to parse.", "Export a clean, searchable file and check it after download."],
      },
    ],
    example: {
      title: "Transforming a task into evidence",
      text: "Instead of “Responsible for weekly reports,” try a truthful version such as:",
      bullets: ["Built a weekly operations report used by three team leads to spot delivery risks.", "Reduced manual spreadsheet preparation by standardizing the input template."],
    },
    faqs: [
      { question: "Can an AI resume builder write my whole resume?", answer: "It can help draft and organize content, but you should supply the real experience, verify every claim, and edit the result so it accurately represents you." },
      { question: "What makes a resume ATS-friendly?", answer: "Clear text structure, standard section headings, readable formatting, and relevant language usually help software and people parse the document." },
      { question: "Should I use the same resume for every job?", answer: "Keep a truthful master resume, then tailor the summary, selected achievements, and skills to the requirements of each role." },
    ],
    relatedSlugs: ["resume-tailoring-for-each-job", "how-to-write-a-better-resume", "ai-interview-preparation"],
    cta: { label: "Open the Rolebolt resume workspace", href: "/seeker/resume", text: "Build or improve a resume and keep your job-search materials organized." },
  },
  {
    slug: "resume-tailoring-for-each-job",
    title: "How to Tailor Your Resume for Each Job",
    metaTitle: "How to Tailor Your Resume for Each Job",
    description: "Use a repeatable process to tailor your resume to a job description without copying keywords or changing the truth.",
    audience: "Job seekers",
    category: "Resume and applications",
    readTime: "6 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "resume tailoring for each job",
    keywords: ["resume tailoring for each job", "tailor resume", "resume keywords", "job description analysis"],
    summary: "Resume tailoring means choosing the most relevant true evidence for a role and making the connection easy for a recruiter to understand.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Career Guidance Team",
    image: resumeImage,
    imageAlt: "Rolebolt resume tailoring and job workspace",
    sections: [
      {
        heading: "Read the job description for outcomes",
        paragraphs: [
          "Look for the work behind the requirements. A posting that says “manage stakeholders” may describe planning, communication, trade-offs, and delivery in the responsibilities section.",
          "Separate must-have skills, recurring responsibilities, and preferred extras. Your resume does not need to repeat every phrase; it needs to show relevant evidence.",
        ],
      },
      {
        heading: "Select evidence from your master resume",
        paragraphs: ["Keep a library of truthful bullets and projects. For each application, choose the evidence that best matches the role’s top outcomes."],
        bullets: ["Move the most relevant experience higher.", "Use the employer’s plain-language term when it accurately describes your work.", "Add a tool only when you actually used it.", "Remove unrelated detail when it crowds out stronger evidence."],
      },
      {
        heading: "Check the final version",
        paragraphs: [
          "Read the resume beside the job description. Can someone see the connection between your experience and the role without guessing? Then check for accuracy, consistent dates, and a clean export.",
          "Rolebolt’s universal job workspace can help you bring a job description into one place so resume decisions, cover letters, and interview preparation share the same role context.",
        ],
      },
    ],
    example: {
      title: "Tailoring example",
      text: "For a role emphasizing onboarding, prioritize a real example that shows:",
      bullets: ["The number or type of people supported.", "The process you improved or documented.", "The result, such as faster time to value or fewer repeat questions."],
    },
    faqs: [
      { question: "Do I need a different resume for every application?", answer: "You can keep one strong master resume and tailor the most relevant summary, achievements, and skills for roles that are genuinely different." },
      { question: "Should I copy keywords from the job description?", answer: "Use relevant terms when they accurately describe your experience. Keyword repetition without evidence can make the resume less credible." },
      { question: "How much time should resume tailoring take?", answer: "A focused application often needs only a short review of the role, selection of relevant evidence, and an accuracy check. A better master resume makes this faster." },
    ],
    relatedSlugs: ["ai-resume-builder", "how-to-write-a-better-resume", "job-search-strategy-for-freshers"],
    cta: { label: "Analyze a job with Rolebolt", href: "/seeker/workspace", text: "Bring a job description into a workspace for matching, resume, and interview next steps." },
  },
  {
    slug: "ai-interview-preparation",
    title: "AI Interview Preparation: Practice With Better Context",
    metaTitle: "AI Interview Preparation Guide | Rolebolt",
    description: "Prepare for interviews with role-specific practice, evidence from your experience, and feedback that helps you improve.",
    audience: "Job seekers",
    category: "Interviews",
    readTime: "7 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "AI interview preparation",
    keywords: ["AI interview preparation", "interview practice", "mock interview", "interview questions"],
    summary: "AI interview preparation works best when practice is grounded in the actual job, your real experience, and the kind of conversation you are likely to have.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Career Guidance Team",
    image: interviewImage,
    imageAlt: "Rolebolt AI interview preparation workspace",
    sections: [
      {
        heading: "Prepare from the role, not a generic question list",
        paragraphs: [
          "Start with the job description and identify the outcomes, skills, and trade-offs the role involves. Then choose two or three experiences that show how you handled similar work.",
          "Good preparation helps you communicate clearly; it does not require memorizing perfect scripts.",
        ],
      },
      {
        heading: "Practice answers with a simple structure",
        paragraphs: ["For behavioral questions, use a clear structure that keeps the result and your contribution visible:"],
        bullets: ["Situation: what was happening?", "Action: what did you decide and do?", "Result: what changed?", "Reflection: what would you repeat or improve?"],
      },
      {
        heading: "Use AI feedback carefully",
        paragraphs: [
          "An AI coach can identify vague answers, missing context, or overlong explanations. Treat feedback as a prompt for revision rather than a definitive judgment about your communication.",
          "Rolebolt’s interview preparation tools can generate role-specific practice from your job workspace so you can prepare for the actual conversation.",
        ],
      },
    ],
    example: {
      title: "A 20-minute interview practice loop",
      text: "Choose one role and repeat this cycle:",
      bullets: ["Answer one role-specific question out loud.", "Write down the evidence you used.", "Cut one vague phrase and add one concrete detail.", "Practice a concise follow-up question for the interviewer."],
    },
    faqs: [
      { question: "Can AI help me prepare for an interview?", answer: "Yes. AI can generate role-specific practice questions, help organize your examples, and give feedback on clarity. You should still use your real experience and your own judgment." },
      { question: "What should I practice first?", answer: "Practice explaining your most relevant experience, the role’s likely challenges, and why the opportunity makes sense for you." },
      { question: "Should I memorize interview answers?", answer: "Memorize key evidence and structure, not a script. Natural answers are easier to adapt and usually sound more authentic." },
    ],
    relatedSlugs: ["resume-tailoring-for-each-job", "how-to-write-a-better-resume", "how-to-follow-up-after-applying"],
    cta: { label: "Practice with Rolebolt", href: "/seeker/interview-prep", text: "Use role-aware interview preparation to turn your job context into practice." },
  },
  {
    slug: "job-application-tracker",
    title: "Job Application Tracker: Organize Every Opportunity",
    metaTitle: "Job Application Tracker Guide | Rolebolt",
    description: "Build a job application tracking system that keeps deadlines, contacts, stages, follow-ups, and decisions visible.",
    audience: "Job seekers",
    category: "Job search workflow",
    readTime: "7 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "job application tracker",
    keywords: ["job application tracker", "application tracking", "job search organization", "application follow-up"],
    summary: "A job application tracker should answer what you applied to, where it came from, what happens next, and what you learned—not just count applications.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Career Guidance Team",
    image: seekerImage,
    imageAlt: "Rolebolt universal job application tracker",
    sections: [
      {
        heading: "Track decisions, not just applications",
        paragraphs: [
          "The useful record includes the role, company, source, application date, current stage, contact, next action, and the version of your resume or cover letter used. Add a short note about why the role was a fit.",
          "This turns your tracker into a learning system. You can see which roles you pursue, where you get responses, and which follow-ups are due.",
        ],
      },
      {
        heading: "Use a small set of clear statuses",
        paragraphs: ["Choose statuses that tell you what to do next."],
        bullets: ["Considering", "Applied", "Recruiter contact", "Interview", "Assessment", "Offer", "Closed or withdrawn"],
      },
      {
        heading: "Schedule the next action",
        paragraphs: [
          "A tracker is useful when it reduces uncertainty. Add a follow-up date only when it is appropriate, and respect any instructions in the job post or recruiter message.",
          "Rolebolt’s universal application tracker can bring applications from Rolebolt, LinkedIn, Indeed, company sites, and manual entries into one career workspace.",
        ],
      },
    ],
    example: {
      title: "A helpful application record",
      text: "For each active application, capture:",
      bullets: ["Role and company.", "Source and application date.", "Resume version or key evidence used.", "Current stage and next action.", "One question to ask if contacted."],
    },
    faqs: [
      { question: "What is the best way to track job applications?", answer: "Use a simple tracker with role, company, source, date, stage, contact, next action, and notes. The best system is one you update after each meaningful event." },
      { question: "How many applications should I track?", answer: "Track every serious application and conversation. Reviewing the full set helps you manage follow-ups and learn which roles and channels are producing progress." },
      { question: "When should I follow up on an application?", answer: "Follow the timeline in the posting or message when one is provided. Otherwise, a brief, respectful follow-up after a reasonable period can be appropriate." },
    ],
    relatedSlugs: ["how-to-follow-up-after-applying", "resume-tailoring-for-each-job", "how-to-find-remote-jobs"],
    cta: { label: "Open the Rolebolt application tracker", href: "/seeker/tracker", text: "Keep applications from every job site in one organized workspace." },
  },
  {
    slug: "how-to-find-remote-jobs",
    title: "How to Find Remote Jobs Without Wasting Your Search Time",
    metaTitle: "How to Find Remote Jobs | Rolebolt",
    description: "Use a focused process to find legitimate remote jobs, check location requirements, tailor applications, and avoid low-quality listings.",
    audience: "Job seekers",
    category: "Job search strategy",
    readTime: "7 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "how to find remote jobs",
    keywords: ["how to find remote jobs", "remote job search", "work from home jobs", "remote work applications"],
    summary: "A focused remote job search checks work authorization, time-zone expectations, employment type, and the quality of the employer before you invest in an application.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Career Guidance Team",
    image: seekerImage,
    imageAlt: "Rolebolt public job search and opportunity discovery",
    sections: [
      {
        heading: "Read “remote” carefully",
        paragraphs: [
          "Remote can mean work from anywhere, remote within a country, a specific time zone, or occasional travel to an office. Check the location and eligibility details before applying.",
          "A legitimate listing should explain the work, employer, process, and contact path. Be cautious when a role asks for money, sensitive identity information too early, or vague “easy income” promises.",
        ],
      },
      {
        heading: "Search with a role and outcome",
        paragraphs: ["Start with the work you want to do, then narrow by location eligibility and seniority."],
        bullets: ["Search by role plus skill or industry.", "Save promising roles and compare requirements.", "Check the company’s public identity and website.", "Tailor the resume to the actual work.", "Track applications and follow-up dates."],
      },
      {
        heading: "Use Rolebolt’s job workspace",
        paragraphs: [
          "Rolebolt’s public opportunities surface helps you browse open roles by role, skill, location, and work mode. The universal job workspace also lets you bring a job from another URL or paste its description for analysis.",
          "Use a match signal as a starting point, then decide whether the role, employer, and working arrangement are right for you.",
        ],
      },
    ],
    example: {
      title: "Remote job quality checklist",
      text: "Before applying, confirm:",
      bullets: ["Who the employer is.", "Where you are allowed to work.", "The expected work hours or time zone.", "How compensation and employment are handled.", "What the interview process looks like."],
    },
    faqs: [
      { question: "Where can I find legitimate remote jobs?", answer: "Use established job boards, company career pages, professional communities, and public opportunity platforms. Verify the employer and never pay to apply for a job." },
      { question: "What does remote work location mean?", answer: "It describes where an employee can legally and practically work. A role may be remote but limited to a country, state, or time zone." },
      { question: "How can I avoid remote job scams?", answer: "Verify the employer, reject requests for upfront payment, be careful with sensitive information, and look for a specific role, process, and accountable contact." },
    ],
    relatedSlugs: ["job-application-tracker", "resume-tailoring-for-each-job", "job-search-strategy-for-freshers"],
    cta: { label: "Browse public opportunities", href: "/recruit/opportunities", text: "Search Rolebolt opportunities by role, skill, location, and work mode." },
  },
  {
    slug: "how-to-write-a-better-resume",
    title: "How to Write a Better Resume: A Clear, Evidence-Based Method",
    metaTitle: "How to Write a Better Resume | Rolebolt",
    description: "Write a better resume by focusing on outcomes, relevant evidence, readable structure, and truthful examples of your work.",
    audience: "Job seekers",
    category: "Resume and applications",
    readTime: "8 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "how to write a better resume",
    keywords: ["how to write a better resume", "resume writing tips", "resume examples", "ATS resume"],
    summary: "A better resume makes it easy to understand the work you have done, the problems you can help solve, and the evidence that supports your claims.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Career Guidance Team",
    image: resumeImage,
    imageAlt: "Rolebolt resume builder and resume improvement workspace",
    sections: [
      {
        heading: "Lead with the role you want to earn",
        paragraphs: [
          "A resume is not a complete autobiography. It is a focused document for a specific opportunity. Make the target role clear and put the most relevant experience, skills, and outcomes where they can be found quickly.",
          "Use a short summary only when it adds context. Avoid generic adjectives that are not supported by examples.",
        ],
      },
      {
        heading: "Turn responsibilities into outcomes",
        paragraphs: ["Use the action, context, and result pattern to create specific bullets."],
        bullets: ["Action: what you changed or delivered.", "Context: the users, scale, constraint, or problem.", "Result: the measurable or observable outcome.", "Learning: only when it adds useful context."],
      },
      {
        heading: "Make the format easy to read",
        paragraphs: [
          "Use standard headings, consistent dates, readable spacing, and a searchable export. Keep design elements from competing with the evidence. Proofread company names, numbers, links, and contact information.",
          "Rolebolt’s AI resume builder can help you draft or improve a resume, but the final document should remain truthful and sound like the person who will discuss it in an interview.",
        ],
      },
    ],
    example: {
      title: "A stronger bullet",
      text: "Replace broad language with evidence:",
      bullets: ["Broad: “Helped with customer onboarding.”", "Stronger: “Created an onboarding checklist used by 40 new customers, reducing repeated setup questions for the support team.”"],
    },
    faqs: [
      { question: "What makes a resume stand out?", answer: "Relevant, specific evidence of outcomes and problem-solving usually stands out more than decorative design or a long list of generic skills." },
      { question: "How many pages should a resume be?", answer: "Use the length needed to show relevant evidence clearly. Early-career resumes may be shorter, while experienced candidates may need more space, but unnecessary detail should be removed." },
      { question: "Should a resume include a photo?", answer: "Requirements vary by market and role. Follow the norms of the location and application process, and prioritize readable, job-relevant information." },
    ],
    relatedSlugs: ["ai-resume-builder", "resume-tailoring-for-each-job", "job-search-strategy-for-freshers"],
    cta: { label: "Improve your resume with Rolebolt", href: "/seeker/resume", text: "Use an AI-assisted resume workspace while keeping control of every claim." },
  },
  {
    slug: "how-to-prepare-for-an-ai-interview",
    title: "How to Prepare for an AI Interview and Show Your Thinking",
    metaTitle: "How to Prepare for an AI Interview",
    description: "Prepare for AI-assisted interviews by understanding the role, practicing clear evidence, and asking how the process is evaluated.",
    audience: "Job seekers",
    category: "Interviews",
    readTime: "6 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "how to prepare for an AI interview",
    keywords: ["how to prepare for an AI interview", "AI interview preparation", "automated interview tips", "interview practice"],
    summary: "An AI-assisted interview still rewards clear thinking, relevant evidence, and honest communication. Prepare for the role and understand the process rather than trying to guess a hidden score.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Career Guidance Team",
    image: interviewImage,
    imageAlt: "Rolebolt AI interview preparation practice screen",
    sections: [
      {
        heading: "Find out what kind of interview it is",
        paragraphs: [
          "An AI interview might mean a recorded response, a conversational practice tool, a technical evaluation, or a human interview with AI-generated prompts. Read the instructions and ask the recruiter what is being evaluated when the process is unclear.",
          "You should know the expected format, time limit, equipment, accessibility contact, and whether a person will review the result.",
        ],
      },
      {
        heading: "Prepare evidence, not scripts",
        paragraphs: ["Choose a few real examples that show the skills the role requires."],
        bullets: ["A difficult problem and the options you considered.", "A decision you made with incomplete information.", "A collaboration or disagreement and how it ended.", "A result, metric, or lesson you can explain honestly."],
      },
      {
        heading: "Practice clarity and presence",
        paragraphs: [
          "Practice answering in a beginning, middle, and end. Speak directly, pause to think, and use concrete details. If the process is recorded, check audio, lighting, framing, and your connection before starting.",
          "Rolebolt’s interview preparation tool can generate practice questions from the job context and help you rehearse without turning the answer into a memorized performance.",
        ],
      },
    ],
    example: {
      title: "Before a recorded interview",
      text: "Run a short technical and content check:",
      bullets: ["Test camera, microphone, and browser permissions.", "Put the job description and three evidence examples nearby.", "Practice one answer in 90 seconds.", "Confirm the submission deadline and support contact."],
    },
    faqs: [
      { question: "What is an AI interview?", answer: "The term can describe several formats, including recorded responses, conversational systems, AI-assisted question generation, or automated assessments. Check the employer’s instructions for the exact process." },
      { question: "Can I use AI to answer an interview?", answer: "Follow the employer’s rules. Use AI for preparation when allowed, but do not misrepresent real-time assistance or submit answers that do not reflect your own experience." },
      { question: "How do I do well in an automated interview?", answer: "Understand the format, prepare role-relevant examples, answer clearly and specifically, check your technology, and ask for accessibility support when needed." },
    ],
    relatedSlugs: ["ai-interview-preparation", "resume-tailoring-for-each-job", "how-to-follow-up-after-applying"],
    cta: { label: "Practice interview answers", href: "/seeker/interview-prep", text: "Prepare with Rolebolt’s role-aware interview practice tools." },
  },
  {
    slug: "how-to-follow-up-after-applying",
    title: "How to Follow Up After Applying Without Overdoing It",
    metaTitle: "How to Follow Up After Applying",
    description: "Learn when and how to follow up after a job application with a concise, respectful message that adds useful context.",
    audience: "Job seekers",
    category: "Job search strategy",
    readTime: "5 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "how to follow up after applying",
    keywords: ["how to follow up after applying", "application follow-up email", "job application status", "recruiter follow up"],
    summary: "A good follow-up is brief, relevant, and aligned with the employer’s stated timeline. It reminds the reader of your interest without demanding a response.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Career Guidance Team",
    image: seekerImage,
    imageAlt: "Rolebolt job application tracker with follow-up actions",
    sections: [
      {
        heading: "Check the stated timeline first",
        paragraphs: [
          "If the job post or recruiter gave a review date, wait until that window has passed. If there is no timeline, a brief follow-up after several business days can be reasonable, especially when you have a relevant update.",
          "Do not send repeated messages across every channel. Keep a record of the date and contact in your application tracker.",
        ],
      },
      {
        heading: "Write a useful, short message",
        paragraphs: ["A follow-up can include four simple parts:"],
        bullets: ["The role and date you applied.", "One sentence about why the role is relevant.", "A relevant update or evidence, if you have one.", "A polite question about the next step."],
      },
      {
        heading: "Know when to move on",
        paragraphs: [
          "No response is information. Continue your search, keep the application record accurate, and avoid assuming silence is a judgment about your ability. A respectful process is a two-way evaluation.",
          "Rolebolt’s application tracker helps you see follow-ups alongside interviews, saved jobs, and other active opportunities.",
        ],
      },
    ],
    example: {
      title: "Follow-up structure",
      text: "Keep the message easy to scan:",
      bullets: ["Subject: Follow-up — [role] application", "Opening: mention the role and application date.", "Middle: connect one relevant achievement to the role.", "Close: ask whether there is an updated timeline."],
    },
    faqs: [
      { question: "How long should I wait before following up on a job application?", answer: "Follow the stated timeline when one exists. Otherwise, a concise follow-up after several business days can be reasonable." },
      { question: "Should I follow up by email or LinkedIn?", answer: "Use the channel provided by the employer or recruiter. Avoid contacting multiple people repeatedly unless you have a clear reason." },
      { question: "What if I never hear back after following up?", answer: "Record the outcome, continue applying elsewhere, and treat the lack of response as a signal about that process rather than a final statement about your ability." },
    ],
    relatedSlugs: ["job-application-tracker", "ai-interview-preparation", "candidate-experience"],
    cta: { label: "Organize your follow-ups", href: "/seeker/tracker", text: "Keep application stages and next actions visible in Rolebolt." },
  },
  {
    slug: "job-search-strategy-for-freshers",
    title: "Job Search Strategy for Freshers: Build Momentum Step by Step",
    metaTitle: "Job Search Strategy for Freshers",
    description: "A practical job search strategy for freshers covering evidence, applications, networking, interview practice, and weekly momentum.",
    audience: "Job seekers",
    category: "Job search strategy",
    readTime: "8 min read",
    publishedAt: "2026-08-03",
    modifiedAt: "2026-08-03",
    primaryKeyword: "job search strategy for freshers",
    keywords: ["job search strategy for freshers", "fresher jobs", "entry level job search", "graduate job search"],
    summary: "Freshers can build a stronger search by turning coursework, projects, internships, volunteering, and independent work into clear evidence connected to entry-level roles.",
    author: "Rolebolt Editorial Team",
    reviewer: "Rolebolt Career Guidance Team",
    image: seekerImage,
    imageAlt: "Rolebolt career workspace for a fresher job search",
    sections: [
      {
        heading: "Build an evidence portfolio",
        paragraphs: [
          "You do not need a long employment history to show how you work. Choose two or three projects, internships, courses, volunteer efforts, or personal builds and write down the problem, your contribution, the tools, and the result.",
          "A small, finished project that you can explain is often more useful than a long list of courses without examples.",
        ],
      },
      {
        heading: "Search for the first relevant experience",
        paragraphs: ["Use a wide but intentional search. Look for roles where your current evidence connects to the work and where the learning path is clear."],
        bullets: ["Search by skill, role, and industry rather than only “fresher.”", "Check work mode, location, eligibility, and salary details.", "Tailor the resume to the role’s top outcomes.", "Ask for feedback from a teacher, mentor, or trusted professional."],
      },
      {
        heading: "Create a weekly system",
        paragraphs: [
          "Set goals you can control: review a set number of relevant roles, send thoughtful applications, practice one interview answer, and improve one piece of your evidence. Track what you did and what happened so the strategy can improve.",
          "Rolebolt’s career workspace combines application tracking, job analysis, resume tools, cover letters, and interview preparation so a fresher can keep the process in one place.",
        ],
      },
    ],
    example: {
      title: "A simple fresher weekly plan",
      text: "A balanced week might include:",
      bullets: ["Research five relevant roles.", "Submit two or three tailored applications.", "Improve one project or resume example.", "Practice one interview story.", "Ask one person a specific career question."],
    },
    faqs: [
      { question: "How can freshers get experience for a resume?", answer: "Use coursework, projects, internships, volunteering, freelance work, clubs, open-source contributions, or personal builds as long as you explain your real contribution and outcome." },
      { question: "How many jobs should a fresher apply for?", answer: "Focus on relevant, thoughtful applications rather than a fixed high number. Track outcomes and adjust the search based on evidence." },
      { question: "What should a fresher put on a resume?", answer: "Include education, relevant skills, projects, internships, work samples, activities, and outcomes that connect to the target role." },
    ],
    relatedSlugs: ["how-to-write-a-better-resume", "job-application-tracker", "ai-interview-preparation"],
    cta: { label: "Start a fresher job workspace", href: "/seeker", text: "Track your search, improve your resume, and prepare for interviews in one place." },
  },
];

export const resourcesBySlug = Object.fromEntries(resourceArticles.map((article) => [article.slug, article])) as Record<string, ResourceArticle>;

export const recruiterResources = resourceArticles.filter((article) => article.audience === "Recruiters");
export const seekerResources = resourceArticles.filter((article) => article.audience === "Job seekers");

export function getRelatedResources(article: ResourceArticle) {
  return article.relatedSlugs.map((slug) => resourcesBySlug[slug]).filter(Boolean);
}