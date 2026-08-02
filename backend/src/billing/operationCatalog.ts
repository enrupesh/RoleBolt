export interface BillingOperation {
  key: string;
  category: "seeker" | "creator_form" | "creator_standard";
  units: number;
  counter?: string;
  quantity?: number;
  description: string;
}

const operations: BillingOperation[] = [
  { key: "resume_build", category: "seeker", units: 1, description: "Build a resume with AI." },
  { key: "resume_improve", category: "seeker", units: 1, description: "Improve a resume with AI." },
  { key: "resume_analysis", category: "seeker", units: 2, counter: "resume_analyses", description: "Analyze a resume." },
  { key: "cover_letter", category: "seeker", units: 2, counter: "cover_letters", description: "Generate a cover letter." },
  { key: "job_fit_analysis", category: "seeker", units: 2, counter: "job_fit_analyses", description: "Analyze job fit." },
  { key: "interview_session", category: "seeker", units: 3, counter: "interview_sessions", description: "Run interview preparation." },
  { key: "profile_optimization", category: "seeker", units: 2, description: "Optimize a seeker profile." },
  { key: "email_intelligence", category: "seeker", units: 1, description: "Parse job email intelligence." },
  { key: "candidate_score", category: "creator_standard", units: 1, counter: "ai_scored_candidates", description: "Score a Standard Job candidate." },
  { key: "form_response_score", category: "creator_form", units: 1, counter: "ai_scored_responses", description: "Score a Form Job response." },
  { key: "job_analysis", category: "creator_standard", units: 3, counter: "job_analysis_reports", description: "Generate a job analysis report." },
  { key: "form_hiring_summary", category: "creator_form", units: 4, counter: "hiring_summaries", description: "Generate a Form Job hiring summary." },
  { key: "copilot_turn_standard", category: "creator_standard", units: 1, counter: "copilot_turns", description: "Use Standard Job Copilot." },
  { key: "copilot_turn_form", category: "creator_form", units: 1, counter: "copilot_turns", description: "Use Form Job Copilot." },
  { key: "offer_letter_standard", category: "creator_standard", units: 3, counter: "offer_letters", description: "Draft a Standard Job offer letter." },
  { key: "offer_letter_form", category: "creator_form", units: 3, counter: "offer_letters", description: "Draft a Form Job offer letter." },
  { key: "short_improvement", category: "creator_form", units: 1, counter: "ai_content_actions", description: "Generate a short Form Job improvement." },
];

export const BILLING_OPERATIONS: ReadonlyMap<string, BillingOperation> = new Map(
  operations.map((operation) => [operation.key, Object.freeze(operation)]),
);

export function getBillingOperation(key: string): BillingOperation {
  const operation = BILLING_OPERATIONS.get(key);
  if (!operation) throw new Error(`Unknown billing operation: ${key}`);
  return operation;
}