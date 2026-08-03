export interface BillingOperation {
  key: string;
  category: "seeker" | "creator_form" | "creator_standard";
  units: number;
  counter?: string;
  quantity?: number;
  description: string;
}

const operations: BillingOperation[] = [
  // ── Job Seeker ───────────────────────────────────────────────────────────
  { key: "resume_build", category: "seeker", units: 1, description: "Build a resume with AI." },
  { key: "resume_improve", category: "seeker", units: 1, description: "Improve a resume with AI." },
  { key: "resume_analysis", category: "seeker", units: 2, counter: "resume_analyses", description: "Analyze a resume." },
  { key: "resume_parse", category: "seeker", units: 1, counter: "resume_parses", description: "Parse an uploaded resume." },
  { key: "cover_letter", category: "seeker", units: 2, counter: "cover_letters", description: "Generate a cover letter." },
  { key: "job_fit_analysis", category: "seeker", units: 2, counter: "job_fit_analyses", description: "Analyze job fit." },
  { key: "workspace_analyze", category: "seeker", units: 2, counter: "job_fit_analyses", description: "Analyze a workspace job listing." },
  { key: "extension_analysis", category: "seeker", units: 2, counter: "job_fit_analyses", description: "Analyze a job from the browser extension." },
  { key: "interview_session", category: "seeker", units: 3, counter: "interview_sessions", description: "Run interview preparation." },
  { key: "interview_questions", category: "seeker", units: 3, counter: "interview_sessions", description: "Generate interview questions." },
  { key: "interview_evaluation", category: "seeker", units: 3, counter: "interview_sessions", description: "Evaluate interview answers." },
  { key: "profile_optimization", category: "seeker", units: 2, description: "Optimize a seeker profile." },
  { key: "email_intelligence", category: "seeker", units: 1, description: "Parse job email intelligence." },
  { key: "seeker_copilot_turn", category: "seeker", units: 1, counter: "copilot_turns", description: "Seeker Copilot turn." },
  { key: "export_seeker", category: "seeker", units: 0, counter: "exports", description: "Export seeker application data." },

  // ── Form Jobs ──────────────────────────────────────────────────────────────
  { key: "form_response_intake", category: "creator_form", units: 0, counter: "form_responses", description: "Accept a public form response." },
  { key: "form_response_score", category: "creator_form", units: 1, counter: "ai_scored_responses", description: "Score a Form Job response." },
  { key: "form_hiring_summary", category: "creator_form", units: 4, counter: "hiring_summaries", description: "Generate a Form Job hiring summary." },
  { key: "copilot_turn_form", category: "creator_form", units: 1, counter: "copilot_turns", description: "Use Form Job Copilot." },
  { key: "offer_letter_form", category: "creator_form", units: 3, counter: "offer_letters", description: "Draft a Form Job offer letter." },
  { key: "short_improvement", category: "creator_form", units: 1, counter: "ai_content_actions", description: "Generate a short Form Job improvement." },
  { key: "short_rewrite", category: "creator_form", units: 1, counter: "ai_content_actions", description: "Short rewrite / field suggestion (Form Jobs)." },
  { key: "assessment_generate_form", category: "creator_form", units: 2, counter: "ai_units", description: "Generate a Form Job assessment." },
  { key: "assessment_score_form", category: "creator_form", units: 1, counter: "ai_units", description: "Score a Form Job assessment response." },
  { key: "assessment_send_form", category: "creator_form", units: 0, counter: "assessment_sends", description: "Send a Form Job assessment invitation." },
  { key: "automated_email_form", category: "creator_form", units: 0, counter: "automated_emails", description: "Send a Form Job automated email." },
  { key: "creator_premium_email_form", category: "creator_form", units: 0, counter: "automated_emails", description: "Send a premium creator email to Form Job applicants (Pro/Ultra)." },
  // Stage-only rule firings — metered for access/audit, not against automated_emails.
  { key: "pipeline_rule_execution_form", category: "creator_form", units: 0, description: "Execute a Form Job pipeline rule action." },
  { key: "export_form", category: "creator_form", units: 0, counter: "exports", description: "Export Form Job responses." },
  { key: "interview_questions_form", category: "creator_form", units: 2, description: "Generate interview questions for a Form Job candidate." },
  { key: "reject_email_draft_form", category: "creator_form", units: 1, counter: "ai_content_actions", description: "Draft a Form Job rejection email." },

  // ── Standard Jobs ──────────────────────────────────────────────────────────
  { key: "candidate_score", category: "creator_standard", units: 1, counter: "ai_scored_candidates", description: "Score a Standard Job candidate." },
  { key: "deep_candidate_analysis", category: "creator_standard", units: 2, counter: "ai_scored_candidates", description: "Deep candidate analysis." },
  { key: "new_candidate_intake", category: "creator_standard", units: 0, counter: "new_candidates", description: "Add a new Standard Job candidate." },
  { key: "job_analysis", category: "creator_standard", units: 3, counter: "job_analysis_reports", description: "Generate a job analysis report." },
  { key: "job_generation", category: "creator_standard", units: 3, description: "Generate a job description with AI." },
  { key: "short_rewrite_standard", category: "creator_standard", units: 1, description: "Short rewrite / field suggestion (Standard Jobs)." },
  { key: "copilot_turn_standard", category: "creator_standard", units: 1, counter: "copilot_turns", description: "Use Standard Job Copilot." },
  { key: "offer_letter_standard", category: "creator_standard", units: 3, counter: "offer_letters", description: "Draft a Standard Job offer letter." },
  { key: "agent_action", category: "creator_standard", units: 1, description: "Execute a hiring agent action." },
  { key: "daily_briefing", category: "creator_standard", units: 3, counter: "daily_briefings", description: "Generate a daily hiring briefing." },
  { key: "resume_parse_candidate", category: "creator_standard", units: 1, counter: "resume_analyses", description: "Parse a candidate resume." },
  { key: "bulk_import_item", category: "creator_standard", units: 1, counter: "bulk_import_files", description: "Process one bulk-import resume file." },
  { key: "bulk_import_batch", category: "creator_standard", units: 0, counter: "bulk_imports", description: "Start a bulk resume import batch." },
  { key: "assessment_generate_standard", category: "creator_standard", units: 2, description: "Generate a Standard Job assessment." },
  { key: "assessment_score_standard", category: "creator_standard", units: 1, counter: "ai_units", description: "Score a Standard Job assessment response." },
  { key: "assessment_send_standard", category: "creator_standard", units: 0, counter: "assessment_invitations", description: "Send a Standard Job assessment invitation." },
  { key: "automated_email_standard", category: "creator_standard", units: 0, counter: "automated_emails", description: "Send a Standard Job automated email." },
  { key: "creator_premium_email_standard", category: "creator_standard", units: 0, counter: "automated_emails", description: "Send a premium creator email to Standard Job candidates (Pro/Ultra)." },
  // Stage-only rule firings — metered for access/audit, not against automated_emails.
  { key: "pipeline_rule_execution", category: "creator_standard", units: 0, description: "Execute a Standard Job pipeline rule action." },
  { key: "export_standard", category: "creator_standard", units: 0, counter: "exports", description: "Export Standard Job data." },

  // Aliases for audit inventory names (`payment.md` §5.1 / Phase -1)
  { key: "copilot_turn", category: "creator_standard", units: 1, counter: "copilot_turns", description: "Copilot turn (Standard Jobs default)." },
  { key: "offer_letter_draft", category: "creator_standard", units: 3, counter: "offer_letters", description: "Offer letter draft (Standard Jobs default)." },
  { key: "assessment_generate", category: "creator_standard", units: 2, description: "Generate an assessment (Standard Jobs default)." },
  { key: "assessment_score", category: "creator_standard", units: 1, counter: "ai_units", description: "Score an assessment (Standard Jobs default)." },
  { key: "automated_email", category: "creator_standard", units: 0, counter: "automated_emails", description: "Send an automated email (Standard Jobs default)." },
  { key: "export", category: "creator_standard", units: 0, counter: "exports", description: "Export data (Standard Jobs default)." },
];

export const BILLING_OPERATIONS: ReadonlyMap<string, BillingOperation> = new Map(
  operations.map((operation) => [operation.key, Object.freeze(operation)]),
);

/** Minimum operation keys required by Phase -1 audit and `payment.md` §5. */
export const REQUIRED_BILLING_OPERATION_KEYS = [
  "resume_build",
  "resume_improve",
  "resume_analysis",
  "cover_letter",
  "job_fit_analysis",
  "interview_questions",
  "interview_evaluation",
  "profile_optimization",
  "email_intelligence",
  "candidate_score",
  "deep_candidate_analysis",
  "form_response_score",
  "job_analysis",
  "form_hiring_summary",
  "copilot_turn",
  "offer_letter_draft",
  "agent_action",
  "form_response_intake",
  "resume_parse",
  "seeker_copilot_turn",
  "daily_briefing",
  "assessment_generate_standard",
  "assessment_score_standard",
  "automated_email_standard",
  "bulk_import_item",
  "pipeline_rule_execution",
  "export_seeker",
  "export_form",
  "export_standard",
  "interview_questions_form",
  "reject_email_draft_form",
  "short_rewrite",
  "short_rewrite_standard",
  "assessment_generate",
  "assessment_score",
  "automated_email",
  "export",
] as const;

export function assertOperationCatalogComplete(): void {
  for (const key of REQUIRED_BILLING_OPERATION_KEYS) {
    getBillingOperation(key);
  }
}

export function getBillingOperation(key: string): BillingOperation {
  const operation = BILLING_OPERATIONS.get(key);
  if (!operation) throw new Error(`Unknown billing operation: ${key}`);
  return operation;
}
