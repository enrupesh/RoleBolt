/** Shared Copilot workspace types — Standard Job and Form Job are fully separate. */

export type CopilotWorkspace = "standard" | "form";

export type StandardContextLevel = "global" | "job" | "candidate";
export type FormContextLevel = "form_global" | "form" | "form_applicant";
export type CopilotContextLevel = StandardContextLevel | FormContextLevel;

export type StandardContextMode = StandardContextLevel;
export type FormContextMode = FormContextLevel;

export interface CopilotApiContext {
  workspace: CopilotWorkspace;
  level: CopilotContextLevel;
  jobId?: string;
  candidateId?: string;
  formId?: string;
  responseId?: string;
}

export function inferWorkspace(ctx: { workspace?: string; level?: string }): CopilotWorkspace {
  if (ctx.workspace === "form" || ctx.workspace === "standard") return ctx.workspace;
  const level = ctx.level || "";
  if (level === "form" || level.startsWith("form_")) return "form";
  return "standard";
}

export function defaultContextMode(workspace: CopilotWorkspace): StandardContextLevel | FormContextLevel {
  return workspace === "form" ? "form_global" : "global";
}

export function buildApiContext(args: {
  workspace: CopilotWorkspace;
  mode: CopilotContextLevel;
  jobId?: string | null;
  candidateId?: string | null;
  formId?: string | null;
  responseId?: string | null;
}): CopilotApiContext {
  const { workspace, mode } = args;
  if (workspace === "standard") {
    const level = mode as StandardContextLevel;
    if (level === "candidate") {
      return { workspace, level, jobId: args.jobId!, candidateId: args.candidateId! };
    }
    if (level === "job") return { workspace, level, jobId: args.jobId! };
    return { workspace, level: "global" };
  }
  const level = mode as FormContextLevel;
  if (level === "form_applicant") {
    return { workspace, level, formId: args.formId!, responseId: args.responseId! };
  }
  if (level === "form") return { workspace, level, formId: args.formId! };
  return { workspace, level: "form_global" };
}

export function workspaceLabel(w: CopilotWorkspace): string {
  return w === "form" ? "Form Job" : "Standard Job";
}
