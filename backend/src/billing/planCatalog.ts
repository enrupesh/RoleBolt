import {
  BILLING_CATEGORIES,
  BILLING_INTERVALS,
  BILLING_PLANS,
  type BillingCategory,
  type BillingInterval,
  type BillingPlan,
  type FeatureFlags,
  type LimitValue,
  type PlanDefinition,
  type PlanLimits,
  type ProcessingPriority,
} from "../billingTypes";

const prices: Record<BillingCategory, Record<BillingPlan, Record<BillingInterval, number>>> = {
  seeker: {
    free: { monthly: 0, yearly: 0 },
    pro: { monthly: 9900, yearly: 99900 },
    ultra: { monthly: 24900, yearly: 249900 },
  },
  creator_form: {
    free: { monthly: 0, yearly: 0 },
    pro: { monthly: 49900, yearly: 499900 },
    ultra: { monthly: 99900, yearly: 999900 },
  },
  creator_standard: {
    free: { monthly: 0, yearly: 0 },
    pro: { monthly: 99900, yearly: 999900 },
    ultra: { monthly: 199900, yearly: 1999900 },
  },
};

const priorities: Record<BillingPlan, ProcessingPriority> = {
  free: "free",
  pro: "normal",
  ultra: "priority",
};

const commonFlags: FeatureFlags = {
  profile: true,
  manualReview: true,
  manualPipeline: true,
  publicSharing: true,
};

const seekerLimits: Record<BillingPlan, PlanLimits> = {
  free: {
    active_resume_versions: 1,
    stored_resume_versions: 2,
    saved_jobs: 10,
    active_applications: 10,
    application_history: 25,
    workspace_items: 3,
    projects: 3,
    certifications: 3,
    ai_units: 10,
    cover_letters: 2,
    resume_analyses: 1,
    job_fit_analyses: 2,
    interview_sessions: 1,
    copilot_turns: 10,
    job_alerts: 1,
    resume_parses: 1,
    exports: 1,
  },
  pro: {
    active_resume_versions: 5,
    stored_resume_versions: 20,
    saved_jobs: null,
    active_applications: 100,
    application_history: 500,
    workspace_items: 25,
    projects: 20,
    certifications: 20,
    ai_units: 60,
    cover_letters: 20,
    resume_analyses: 10,
    job_fit_analyses: 20,
    interview_sessions: 10,
    copilot_turns: 60,
    job_alerts: 10,
    resume_parses: 10,
    exports: 10,
  },
  ultra: {
    active_resume_versions: 20,
    stored_resume_versions: 100,
    saved_jobs: null,
    active_applications: null,
    application_history: 2000,
    workspace_items: 100,
    projects: 100,
    certifications: 100,
    ai_units: 200,
    cover_letters: 50,
    resume_analyses: 30,
    job_fit_analyses: 50,
    interview_sessions: 30,
    copilot_turns: 200,
    job_alerts: 50,
    resume_parses: 50,
    exports: 50,
  },
};

const formLimits: Record<BillingPlan, PlanLimits> = {
  free: {
    active_forms: 1,
    stored_forms: 3,
    form_responses: 25,
    stored_responses: 100,
    ai_scored_responses: 10,
    ai_units: 15,
    ai_content_actions: 3,
    active_assessments: 1,
    assessment_sends: 10,
    pipeline_rules: 1,
    automated_emails: 10,
    offer_letters: 1,
    recruiter_seats: 1,
    bulk_action_size: 5,
    exports: 1,
    hiring_summaries: 1,
    copilot_turns: 10,
  },
  pro: {
    active_forms: 5,
    stored_forms: 50,
    form_responses: 1000,
    stored_responses: 3000,
    ai_scored_responses: 500,
    ai_units: 750,
    ai_content_actions: 100,
    active_assessments: 5,
    assessment_sends: 500,
    pipeline_rules: 10,
    automated_emails: 500,
    offer_letters: 20,
    recruiter_seats: 3,
    bulk_action_size: 100,
    exports: 25,
    hiring_summaries: 10,
    copilot_turns: 300,
  },
  ultra: {
    active_forms: 20,
    stored_forms: 200,
    form_responses: 5000,
    stored_responses: 15000,
    ai_scored_responses: 2500,
    ai_units: 3500,
    ai_content_actions: 500,
    active_assessments: 20,
    assessment_sends: 2500,
    pipeline_rules: 25,
    automated_emails: 2500,
    offer_letters: 100,
    recruiter_seats: 5,
    bulk_action_size: 500,
    exports: 100,
    hiring_summaries: 50,
    copilot_turns: 1500,
  },
};

const standardLimits: Record<BillingPlan, PlanLimits> = {
  free: {
    active_jobs: 1,
    stored_jobs: 3,
    new_candidates: 25,
    stored_candidates: 100,
    ai_scored_candidates: 10,
    ai_units: 20,
    resume_analyses: 5,
    bulk_import_files: 3,
    bulk_imports: 1,
    active_assessments: 1,
    assessment_invitations: 10,
    pipeline_rules: 1,
    automated_emails: 10,
    offer_letters: 1,
    copilot_turns: 10,
    job_analysis_reports: 1,
    daily_briefings: 1,
    recruiter_seats: 1,
    bulk_action_size: 5,
    exports: 1,
  },
  pro: {
    active_jobs: 5,
    stored_jobs: 50,
    new_candidates: 500,
    stored_candidates: 3000,
    ai_scored_candidates: 300,
    ai_units: 1000,
    resume_analyses: 100,
    bulk_import_files: 50,
    bulk_imports: 20,
    active_assessments: 5,
    assessment_invitations: 300,
    pipeline_rules: 10,
    automated_emails: 300,
    offer_letters: 10,
    copilot_turns: 300,
    job_analysis_reports: 20,
    daily_briefings: null,
    recruiter_seats: 3,
    bulk_action_size: 100,
    exports: 25,
  },
  ultra: {
    active_jobs: 20,
    stored_jobs: 500,
    new_candidates: 2000,
    stored_candidates: 25000,
    ai_scored_candidates: 1500,
    ai_units: 5000,
    resume_analyses: 500,
    bulk_import_files: 50,
    bulk_imports: 100,
    active_assessments: 20,
    assessment_invitations: 1500,
    pipeline_rules: 25,
    automated_emails: 1500,
    offer_letters: 50,
    copilot_turns: 1500,
    job_analysis_reports: 100,
    daily_briefings: null,
    recruiter_seats: 10,
    bulk_action_size: 500,
    exports: 100,
  },
};

const featureFlagsByCategory: Record<BillingCategory, Record<BillingPlan, FeatureFlags>> = {
  seeker: {
    free: { ...commonFlags, advancedMatching: true, priorityProcessing: false },
    pro: { ...commonFlags, advancedMatching: true, priorityProcessing: false },
    ultra: { ...commonFlags, advancedMatching: true, priorityProcessing: true },
  },
  creator_form: {
    free: { ...commonFlags, assessments: true, advancedAnalytics: false, customBranding: false, creatorEmailComposer: false },
    pro: { ...commonFlags, assessments: true, advancedAnalytics: true, customBranding: true, creatorEmailComposer: true },
    ultra: { ...commonFlags, assessments: true, advancedAnalytics: true, customBranding: true, creatorEmailComposer: true },
  },
  creator_standard: {
    free: { ...commonFlags, assessments: true, advancedAnalytics: false, customBranding: false, creatorEmailComposer: false },
    pro: { ...commonFlags, assessments: true, advancedAnalytics: true, customBranding: true, creatorEmailComposer: true },
    ultra: { ...commonFlags, assessments: true, advancedAnalytics: true, customBranding: true, creatorEmailComposer: true },
  },
};

function priceLabel(pricePaise: number, interval: BillingInterval): string {
  if (pricePaise === 0) return "₹0";
  const rupees = pricePaise / 100;
  return `₹${rupees.toLocaleString("en-IN")}/${interval === "monthly" ? "mo" : "yr"}`;
}

function makeDefinition(
  category: BillingCategory,
  plan: BillingPlan,
  interval: BillingInterval,
): PlanDefinition {
  const pricePaise = prices[category][plan][interval];
  return {
    id: `${category}_${plan}_${interval}`,
    category,
    plan,
    interval,
    pricePaise,
    displayPriceInr: priceLabel(pricePaise, interval),
    razorpayPlanId: "",
    limits:
      category === "seeker"
        ? { ...seekerLimits[plan] }
        : category === "creator_form"
          ? { ...formLimits[plan] }
          : { ...standardLimits[plan] },
    featureFlags: { ...featureFlagsByCategory[category][plan] },
    processingPriority: priorities[plan],
    catalogVersion: 1,
  };
}

export const PLAN_CATALOG: readonly PlanDefinition[] = BILLING_CATEGORIES.flatMap((category) =>
  BILLING_PLANS.flatMap((plan) =>
    BILLING_INTERVALS.map((interval) => makeDefinition(category, plan, interval)),
  ),
);

export function getPlanDefinition(
  category: BillingCategory,
  plan: BillingPlan,
  interval: BillingInterval = "monthly",
): PlanDefinition {
  const definition = PLAN_CATALOG.find(
    (candidate) =>
      candidate.category === category &&
      candidate.plan === plan &&
      candidate.interval === interval,
  );
  if (!definition) throw new Error(`Unknown billing catalog entry: ${category}/${plan}/${interval}`);
  return definition;
}

export function getPublicPlanCatalog(): Array<Omit<PlanDefinition, "razorpayPlanId">> {
  return PLAN_CATALOG.map(({ razorpayPlanId: _razorpayPlanId, ...definition }) => definition);
}

export function isLimited(value: LimitValue): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function assertNonNegativeQuantity(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}

export function assertCatalogComplete(): void {
  for (const category of BILLING_CATEGORIES) {
    for (const plan of BILLING_PLANS) {
      for (const interval of BILLING_INTERVALS) {
        getPlanDefinition(category, plan, interval);
      }
    }
  }
}