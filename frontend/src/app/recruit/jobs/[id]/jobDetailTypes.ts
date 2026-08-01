export type CandidateStage =
  | "applied"
  | "review_zone"
  | "screened"
  | "assessed"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

export type AgentMode = {
  enabled: boolean;
  shortlistThreshold: number;
  rejectThreshold: number;
  autoEmailShortlist: boolean;
  autoEmailReject: boolean;
  autoSendAssessment: boolean;
  emailReviewZoneCandidates: boolean;
};

export type PerformanceAlert = {
  id: string;
  type: "low_applications" | "no_hire_14_days" | "high_reject_rate";
  message: string;
  aiSuggestions: string[];
  createdAt: string;
  dismissed: boolean;
};

export type PipelineRule = {
  id: string;
  condition: "score_above" | "score_below" | "assessment_passed" | "assessment_failed" | "stage_age_days";
  threshold: number;
  fromStage?: string;
  action:
    | "move_to_screened"
    | "move_to_assessed"
    | "move_to_interview"
    | "move_to_offer"
    | "move_to_rejected"
    | "send_assessment"
    | "send_reminder";
  enabled: boolean;
  triggerCount: number;
};

export type HiringMode = "manual" | "assisted" | "autopilot";

export const DEFAULT_AGENT_MODE: AgentMode = {
  enabled: false,
  shortlistThreshold: 75,
  rejectThreshold: 40,
  autoEmailShortlist: true,
  autoEmailReject: false,
  autoSendAssessment: false,
  emailReviewZoneCandidates: false,
};
