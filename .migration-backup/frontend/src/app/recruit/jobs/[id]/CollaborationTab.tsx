"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiErrorFromPayload, apiUrl, readApiJson } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import { StandardErrorNotice } from "@/components/StandardErrorNotice";
import {
  Activity,
  Check,
  CheckCircle2,
  ClipboardList,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  ShieldCheck,
  Star,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type TeamRole =
  | "recruiter"
  | "senior_recruiter"
  | "hiring_manager"
  | "hr_manager"
  | "interviewer"
  | "admin";

type Candidate = {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  [key: string]: unknown;
};

type TeamMember = {
  id: string;
  _id?: string;
  name?: string;
  email: string;
  role: TeamRole;
  permissions?: string[];
  memberUid?: string;
  status?: "active" | "pending" | "revoked" | "invited" | "inactive";
  joinedAt?: string;
  assignedCandidateIds?: string[];
};

type ActivityItem = {
  id?: string;
  _id?: string;
  type?: string;
  message?: string;
  action?: string;
  actor?: { name?: string; email?: string };
  actorName?: string;
  createdAt?: string;
  timestamp?: string;
};

type Assignment = {
  candidateId: string;
  assignedTo?: { uid?: string; name?: string; role?: string };
};

type CollaborationData = {
  team?: TeamMember[];
  members?: TeamMember[];
  activity?: ActivityItem[];
  recentActivity?: ActivityItem[];
  assignments?: Record<string, string | TeamMember>;
  currentUser?: { id?: string; role?: TeamRole; isAdmin?: boolean; isOwner?: boolean };
  isOwner?: boolean;
  permissions?: string[];
  collaborations?: Assignment[];
};

type FeedbackEntry = {
  id?: string;
  _id?: string;
  body?: string;
  rating?: number;
  ratings?: Record<string, number>;
  author?: { name?: string; email?: string; uid?: string };
  createdAt?: string;
  updatedAt?: string;
};

type CandidateCollaboration = {
  comments?: Array<{ id?: string; _id?: string; body: string; author?: { name?: string; email?: string }; authorName?: string; createdAt?: string; updatedAt?: string; editHistory?: Array<{ body: string; editedAt?: string }> }>;
  internalNotes?: Array<{ id?: string; _id?: string; body: string; author?: { name?: string; email?: string }; authorName?: string; createdAt?: string; updatedAt?: string; editHistory?: Array<{ body: string; editedAt?: string }> }>;
  interviewFeedback?: FeedbackEntry[];
  commentsCount?: number;
  notesCount?: number;
};

type Notification = {
  _id: string;
  title: string;
  body: string;
  readAt?: string;
  createdAt?: string;
};

export type CollaborationTabProps = {
  jobId: string;
  token: string;
  candidates: Candidate[];
  initialData?: CollaborationData | null;
  onRefresh?: () => void | Promise<void>;
};

const ROLE_OPTIONS: Array<{ value: TeamRole; label: string; summary: string }> = [
  { value: "recruiter", label: "Recruiter", summary: "Manage candidates and communication" },
  { value: "senior_recruiter", label: "Senior recruiter", summary: "Manage pipelines and team decisions" },
  { value: "hiring_manager", label: "Hiring manager", summary: "Review candidates and leave feedback" },
  { value: "hr_manager", label: "HR manager", summary: "Manage hiring policy and reporting" },
  { value: "interviewer", label: "Interviewer", summary: "View assigned candidates and submit feedback" },
  { value: "admin", label: "Admin", summary: "Full access to this hiring workspace" },
];

const RATING_LABELS: Record<string, string> = {
  technicalSkills: "Technical Skills",
  communicationSkills: "Communication",
  problemSolving: "Problem Solving",
  cultureFit: "Culture Fit",
  leadership: "Leadership",
  roleSpecificSkills: "Role-Specific Skills",
  overallRecommendation: "Overall",
};

function roleLabel(role: TeamRole) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

function getId(candidate: Candidate) {
  return String(candidate._id ?? candidate.id ?? "");
}

function initials(member: TeamMember) {
  return (member.name || member.email)
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatDate(value?: string) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function RatingDots({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={11}
          className={i < value ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}
        />
      ))}
      <span className="ml-1 text-[10px] text-slate-500">{value}/{max}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-label="Loading collaboration workspace">
      <div className="rb-card p-5 space-y-3">
        <div className="rb-skeleton h-5 w-48" /><div className="rb-skeleton h-3 w-72" />
        <div className="grid gap-3 sm:grid-cols-3"><div className="rb-skeleton h-16" /><div className="rb-skeleton h-16" /><div className="rb-skeleton h-16" /></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><div className="rb-card h-80 p-5"><div className="rb-skeleton h-full" /></div><div className="rb-card h-80 p-5"><div className="rb-skeleton h-full" /></div></div>
    </div>
  );
}

/* ─── Interview Feedback Section ─────────────────────────────────────────────*/
function InterviewFeedbackSection({
  feedback,
  feedbackLocked,
  feedbackCount,
  members,
  isOwner,
  permissions,
}: {
  feedback: FeedbackEntry[];
  feedbackLocked: boolean;
  feedbackCount: number;
  members: TeamMember[];
  isOwner?: boolean;
  permissions?: string[];
}) {
  const canReview = isOwner || permissions?.includes("review_candidates");

  // Build status list: team members with submit_feedback permission
  const interviewers = members.filter(m =>
    m.status === "active" &&
    (m.permissions?.includes("submit_feedback") || m.role === "interviewer" || m.role === "hiring_manager")
  );
  const submittedUids = new Set(feedback.map(f => f.author?.uid).filter(Boolean));

  if (feedbackLocked) {
    return (
      <div className="rb-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-indigo-600" />
            <h3 className="font-bold text-slate-900">Interview Feedback</h3>
          </div>
          <span className="rb-badge rb-badge-slate">{feedbackCount} submitted</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center">
          <div className="rounded-xl bg-amber-50 p-3 text-amber-500">
            <Lock size={20} />
          </div>
          <p className="text-sm font-semibold text-slate-800">Submit your feedback first</p>
          <p className="max-w-xs text-xs leading-5 text-slate-500">
            To prevent bias, you cannot view other interviewers' feedback until you have submitted your own evaluation for this candidate.
          </p>
          {feedbackCount > 0 && (
            <p className="text-xs text-indigo-600 font-medium">{feedbackCount} interviewer{feedbackCount !== 1 ? "s have" : " has"} already submitted — yours will unlock the full view.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rb-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-indigo-600" />
          <h3 className="font-bold text-slate-900">Interview Feedback</h3>
        </div>
        <div className="flex items-center gap-2">
          {feedback.length > 0 && (
            <span className="rb-badge rb-badge-blue">{feedback.length} submitted</span>
          )}
        </div>
      </div>

      {/* Interviewer status roster */}
      {interviewers.length > 0 && (
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Interviewer Status</p>
          <div className="flex flex-wrap gap-2">
            {interviewers.map(m => {
              const uid = m.memberUid ?? m.id ?? m._id ?? "";
              const submitted = submittedUids.has(uid);
              return (
                <span
                  key={m.id || m._id}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
                    submitted
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                  }`}
                >
                  {submitted
                    ? <CheckCircle2 size={11} className="text-emerald-500" />
                    : <div className="h-2.5 w-2.5 rounded-full border-2 border-slate-300" />
                  }
                  {m.name || m.email}
                  <span className={`text-[10px] ${submitted ? "text-emerald-600" : "text-slate-400"}`}>
                    · {submitted ? "Submitted" : "Pending"}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Feedback entries */}
      {feedback.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
          <ClipboardList size={24} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No feedback submitted yet</p>
          <p className="text-xs text-slate-500">Submitted interview feedback will appear here.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {feedback.map((item, i) => (
            <div key={item._id || item.id || i} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700">
                    {(item.author?.name || "?").split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.author?.name || "Team member"}</p>
                    <p className="text-[10px] text-slate-400">{formatDate(item.createdAt)}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <CheckCircle2 size={10} /> Submitted
                </span>
              </div>

              {/* Structured ratings */}
              {item.ratings && Object.keys(item.ratings).length > 0 && (
                <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl bg-slate-50 px-4 py-3">
                  {Object.entries(item.ratings).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-600 truncate">{RATING_LABELS[key] ?? key}</span>
                      <RatingDots value={val} />
                    </div>
                  ))}
                </div>
              )}

              {/* Overall rating */}
              {item.rating && !item.ratings && (
                <div className="mb-3">
                  <RatingDots value={item.rating} />
                </div>
              )}

              {/* Written comments */}
              {item.body ? (
                <p className="text-sm leading-6 text-slate-700 whitespace-pre-wrap">{item.body}</p>
              ) : (
                <p className="text-xs italic text-slate-400">No written comments.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────────*/
export default function CollaborationTab({ jobId, token, candidates, initialData, onRefresh }: CollaborationTabProps) {
  const [data, setData] = useState<CollaborationData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<unknown>("");
  const [notice, setNotice] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [candidateAssignmentFilter, setCandidateAssignmentFilter] = useState("all");
  const [candidateRoleFilter, setCandidateRoleFilter] = useState("all");
  const [selectedMember, setSelectedMember] = useState("");
  const [candidateDetails, setCandidateDetails] = useState<CandidateCollaboration | null>(null);
  const [feedbackLocked, setFeedbackLocked] = useState(false);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("recruiter");
  const [busy, setBusy] = useState("");
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");
  const [feedbackRatings, setFeedbackRatings] = useState<Record<string, string>>({});
  const [feedbackComment, setFeedbackComment] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editingCommentBody, setEditingCommentBody] = useState("");

  const members = useMemo(() => data?.team ?? data?.members ?? [], [data]);
  const activity = useMemo(() => data?.recentActivity ?? data?.activity ?? [], [data]);
  const canManage = Boolean(data?.isOwner || data?.currentUser?.isAdmin || data?.currentUser?.isOwner || data?.currentUser?.role === "admin" || data?.permissions?.includes("manage_team"));
  const activeMembers = members.filter((member) => member.status !== "inactive" && member.status !== "revoked");
  const assignments = data?.collaborations ?? [];
  const filteredCandidates = candidates.filter((candidate) => {
    const assignment = assignments.find((item) => item.candidateId === getId(candidate))?.assignedTo;
    const matchesMember = candidateAssignmentFilter === "all" || assignment?.uid === candidateAssignmentFilter || assignment?.name === candidateAssignmentFilter;
    const matchesRole = candidateRoleFilter === "all" || assignment?.role === candidateRoleFilter;
    return matchesMember && matchesRole;
  });
  const selectedCandidateRecord = candidates.find((candidate) => getId(candidate) === selectedCandidate);

  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const response = await fetch(apiUrl(`/recruit/collaboration/jobs/${jobId}${path}`), {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    const result = await readApiJson<Record<string, unknown>>(response);
    if (!response.ok) {
      throw apiErrorFromPayload(
        response.status,
        result as any,
        String((result as any).message || (result as any).error || "The collaboration request could not be completed."),
      );
    }
    return result;
  }, [jobId, token]);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch(apiUrl("/recruit/collaboration/notifications"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const result = await readApiJson<{ notifications?: Notification[] }>(response);
      setNotifications(result.notifications ?? []);
    } catch {
      // Notifications should not block the collaboration workspace.
    }
  }, [token]);

  const load = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    setError("");
    try {
      const result = await request("/collaboration");
      setData(result as CollaborationData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load collaboration data.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { void load(!initialData); }, [load, initialData]);
  useEffect(() => { void loadNotifications(); }, [loadNotifications]);

  const loadCandidateDetails = useCallback(async (candidateId: string) => {
    if (!candidateId) { setCandidateDetails(null); setFeedbackLocked(false); setFeedbackCount(0); return; }
    setDetailLoading(true);
    try {
      const result = await request(`/candidates/${candidateId}/collaboration`);
      setCandidateDetails((result.collaboration ?? result) as CandidateCollaboration);
      setFeedbackLocked(Boolean(result.feedbackLocked));
      setFeedbackCount(Number(result.feedbackCount ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load candidate collaboration.");
    } finally { setDetailLoading(false); }
  }, [request]);

  useEffect(() => { void loadCandidateDetails(selectedCandidate); }, [loadCandidateDetails, selectedCandidate]);

  async function invite() {
    if (!inviteEmail.trim()) return;
    setBusy("invite"); setError(""); setNotice("");
    try {
      const result = await request("/team", { method: "POST", body: JSON.stringify({ name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole }) });
      setData((current) => ({ ...(current ?? {}), team: [...(current?.team ?? current?.members ?? []), (result.member ?? result) as TeamMember] }));
      setInviteName(""); setInviteEmail(""); setInviteOpen(false); setNotice(`Invitation sent to ${inviteEmail.trim()}.`);
      await onRefresh?.();
    } catch (e) { setError(e); }
    finally { setBusy(""); }
  }

  async function removeMember(member: TeamMember) {
    if (!window.confirm(`Remove ${member.name || member.email} from this job?`)) return;
    const memberId = member.id || member._id || "";
    setBusy(`remove-${memberId}`); setError("");
    try {
      await request(`/team/${memberId}`, { method: "DELETE" });
      setData((current) => ({ ...(current ?? {}), team: (current?.team ?? current?.members ?? []).filter((item) => item.id !== memberId && item._id !== memberId) }));
      setNotice("Team member removed."); await onRefresh?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not remove team member."); }
    finally { setBusy(""); }
  }

  async function assign() {
    if (!selectedCandidate || !selectedMember) return;
    setBusy("assign"); setError(""); setNotice("");
    try {
      await request(`/candidates/${selectedCandidate}/assign`, { method: "POST", body: JSON.stringify({ teamMemberId: selectedMember, memberId: selectedMember }) });
      setNotice(`Candidate assigned to ${activeMembers.find((member) => (member.id || member._id) === selectedMember)?.name || "team member"}.`);
      setSelectedMember(""); await load(); await onRefresh?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not assign candidate."); }
    finally { setBusy(""); }
  }

  async function addCandidateContent(kind: "comments" | "internal-notes") {
    const value = kind === "comments" ? comment : note;
    if (!selectedCandidate || !value.trim()) return;
    setBusy(kind); setError(""); setNotice("");
    try {
      await request(`/candidates/${selectedCandidate}/${kind}`, { method: "POST", body: JSON.stringify({ body: value.trim(), content: value.trim(), text: value.trim() }) });
      if (kind === "comments") setComment(""); else setNote("");
      setNotice(kind === "comments" ? "Comment added to the candidate record." : "Private note saved.");
      await loadCandidateDetails(selectedCandidate); await load(); await onRefresh?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save this entry."); }
    finally { setBusy(""); }
  }

  async function addInterviewFeedback() {
    const hasRatings = Object.values(feedbackRatings).some(v => v !== "");
    if (!selectedCandidate || (!feedbackComment.trim() && !hasRatings)) return;
    setBusy("interview-feedback"); setError(""); setNotice("");
    const ratingsPayload: Record<string, number> = {};
    for (const [key, val] of Object.entries(feedbackRatings)) {
      if (val !== "") ratingsPayload[key] = Number(val);
    }
    try {
      await request(`/candidates/${selectedCandidate}/interview-feedback`, {
        method: "POST",
        body: JSON.stringify({
          body: feedbackComment.trim(),
          ratings: Object.keys(ratingsPayload).length ? ratingsPayload : undefined,
        }),
      });
      setFeedbackRatings({});
      setFeedbackComment("");
      setNotice("Structured interview feedback submitted. You can now view all feedback for this candidate.");
      await loadCandidateDetails(selectedCandidate); await load(); await onRefresh?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save interview feedback."); }
    finally { setBusy(""); }
  }

  async function editComment(commentId: string) {
    if (!editingCommentBody.trim()) return;
    setBusy(`edit-${commentId}`); setError(""); setNotice("");
    try {
      await request(`/candidates/${selectedCandidate}/comments/${commentId}`, {
        method: "PATCH",
        body: JSON.stringify({ body: editingCommentBody.trim() }),
      });
      setEditingCommentId("");
      setEditingCommentBody("");
      setNotice("Comment updated.");
      await loadCandidateDetails(selectedCandidate);
      await load();
      await onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not edit this comment.");
    } finally {
      setBusy("");
    }
  }

  function wrapComment(format: "bold" | "italic" | "bullet") {
    const marker = format === "bold" ? "**" : format === "italic" ? "_" : "- ";
    const selected = comment || "text";
    setComment(format === "bullet" ? `${marker}${selected}` : `${marker}${selected}${marker}`);
  }

  if (loading) return <Skeleton />;

  return (
    <section className="space-y-4 pb-8" data-testid="collaboration-tab">
      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-sky-50/60 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-indigo-700"><Users size={17} /><span className="text-[11px] font-bold uppercase tracking-[.18em]">Hiring room</span></div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Decide together, with context</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">Keep ownership, candidate feedback, and the decision trail in one focused workspace.</p>
        </div>
        {canManage && <button type="button" onClick={() => setInviteOpen(true)} className="rb-btn rb-btn-primary rb-btn-sm self-start" data-testid="button-open-invite"><UserPlus size={15} /> Invite teammate</button>}
      </div>

      {error ? (
        <div className="flex items-start justify-between gap-3" role="alert" data-testid="status-collaboration-error">
          <StandardErrorNotice error={error} className="flex-1" />
          <button type="button" onClick={() => void load(true)} aria-label="Retry loading collaboration" className="mt-2 text-slate-500 hover:text-slate-800">
            <RefreshCw size={15} />
          </button>
        </div>
      ) : null}
      {notice && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status" data-testid="status-collaboration-success"><Check size={16} />{notice}<button type="button" className="ml-auto" onClick={() => setNotice("")} aria-label="Dismiss success message"><X size={15} /></button></div>}

      {notifications.filter((item) => !item.readAt).length > 0 && (
        <div className="rb-card border-indigo-100 bg-indigo-50/50 p-4" data-testid="collaboration-notifications">
          <div className="mb-2 flex items-center justify-between">
            <div><p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Notifications</p><p className="mt-1 text-xs text-slate-500">Mentions and assignments that need your attention.</p></div>
            <span className="rb-badge rb-badge-blue">{notifications.filter((item) => !item.readAt).length} new</span>
          </div>
          <div className="space-y-2">{notifications.filter((item) => !item.readAt).slice(0, 4).map((item) => <div key={item._id} className="flex items-start justify-between gap-3 rounded-xl bg-white/80 p-3"><div><p className="text-xs font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-600">{item.body}</p></div><button type="button" className="shrink-0 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800" onClick={async () => { await fetch(apiUrl(`/recruit/collaboration/notifications/${item._id}/read`), { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }); setNotifications((current) => current.map((entry) => entry._id === item._id ? { ...entry, readAt: new Date().toISOString() } : entry)); }}>Mark read</button></div>)}</div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {([
          ["Team members", members.length, Users],
          ["Active collaborators", activeMembers.length, ShieldCheck],
          ["Recent decisions", activity.length, Activity],
        ] as Array<[string, number, LucideIcon]>).map(([label, value, Icon]) => (
          <div className="rb-stat-card" key={String(label)} data-testid={`stat-${String(label).toLowerCase().replaceAll(" ", "-")}`}><div className="mb-3 flex items-center justify-between text-slate-500"><span className="text-xs font-semibold uppercase tracking-wider">{label}</span><Icon size={17} /></div><strong className="text-2xl font-bold text-slate-900">{value}</strong></div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rb-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold text-slate-900">People on this role</h3><p className="mt-0.5 text-xs text-slate-500">Roles clarify who can move a decision forward.</p></div><span className="rb-badge rb-badge-blue">{members.length} total</span></div>
          <div className="divide-y divide-slate-100">
            {members.length === 0 ? <div className="px-5 py-12 text-center"><Users className="mx-auto mb-3 text-slate-300" size={30} /><p className="text-sm font-semibold text-slate-700">No collaborators yet</p><p className="mt-1 text-xs text-slate-500">Invite the first person to start the hiring room.</p></div> : members.map((member) => (
              <div className="flex items-center gap-3 px-5 py-4" key={member.id || member._id} data-testid={`member-${member.id || member._id}`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-xs font-bold text-indigo-700">{initials(member)}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{member.name || member.email}</p><p className="truncate text-xs text-slate-500">{member.email}</p></div>
                <div className="hidden text-right sm:block"><span className="rb-badge rb-badge-slate">{roleLabel(member.role)}</span><p className="mt-1 max-w-[190px] text-[10px] text-slate-400">{ROLE_OPTIONS.find((item) => item.value === member.role)?.summary}</p></div>
                <span className={`h-2 w-2 rounded-full ${member.status === "inactive" || member.status === "revoked" ? "bg-slate-300" : member.status === "invited" || member.status === "pending" ? "bg-amber-400" : "bg-emerald-500"}`} title={member.status || "active"} />
                {canManage && <button type="button" onClick={() => void removeMember(member)} disabled={busy === `remove-${member.id || member._id}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${member.name || member.email}`}><Trash2 size={15} /></button>}
              </div>
            ))}
          </div>
        </div>

        <div className="rb-card p-5">
          <div className="mb-4 flex items-start gap-3"><div className="rounded-xl bg-amber-50 p-2 text-amber-600"><ClipboardList size={17} /></div><div><h3 className="font-bold text-slate-900">Assign a candidate</h3><p className="mt-0.5 text-xs leading-5 text-slate-500">Give an active collaborator a clear next review.</p></div></div>
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-600">Assigned member<select value={candidateAssignmentFilter} onChange={(e) => setCandidateAssignmentFilter(e.target.value)} className="rb-input mt-1.5" data-testid="select-assignment-filter"><option value="all">Everyone</option>{activeMembers.map((member) => <option key={member.id || member._id} value={member.id || member._id}>{member.name || member.email}</option>)}</select></label>
              <label className="block text-xs font-semibold text-slate-600">Role<select value={candidateRoleFilter} onChange={(e) => setCandidateRoleFilter(e.target.value)} className="rb-input mt-1.5" data-testid="select-role-filter"><option value="all">All roles</option>{ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
            </div>
            <label className="block text-xs font-semibold text-slate-600">Candidate<select value={selectedCandidate} onChange={(e) => setSelectedCandidate(e.target.value)} className="rb-input mt-1.5" data-testid="select-assignment-candidate"><option value="">Choose a candidate ({filteredCandidates.length})</option>{filteredCandidates.map((candidate) => <option key={getId(candidate)} value={getId(candidate)}>{candidate.name || candidate.email || "Unnamed candidate"}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-600">Assign to<select value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)} className="rb-input mt-1.5" data-testid="select-assignment-member"><option value="">Choose a collaborator</option>{activeMembers.map((member) => <option key={member.id || member._id} value={member.id || member._id}>{member.name || member.email} · {roleLabel(member.role)}</option>)}</select></label>
            <button type="button" onClick={() => void assign()} disabled={!selectedCandidate || !selectedMember || busy === "assign"} className="rb-btn rb-btn-primary w-full" data-testid="button-assign-candidate">{busy === "assign" ? "Assigning…" : "Assign candidate"}</button>
          </div>
        </div>
      </div>

      {/* ── Interview Feedback (dedicated section) ───────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Interview Feedback</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Interviewers submit independently — feedback is hidden until each person has submitted their own.
            </p>
          </div>
        </div>

        {/* Candidate selector for this section */}
        <div className="rb-card p-4">
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Select candidate to view feedback</label>
          <select
            value={selectedCandidate}
            onChange={(e) => setSelectedCandidate(e.target.value)}
            className="rb-input w-full max-w-sm"
            data-testid="select-feedback-candidate"
          >
            <option value="">Choose a candidate ({candidates.length})</option>
            {candidates.map((candidate) => (
              <option key={getId(candidate)} value={getId(candidate)}>
                {candidate.name || candidate.email || "Unnamed candidate"}
              </option>
            ))}
          </select>
        </div>

        {selectedCandidate && (
          <>
            {detailLoading ? (
              <div className="rb-card p-8 text-center text-xs text-slate-400">Loading feedback…</div>
            ) : (
              <InterviewFeedbackSection
                feedback={candidateDetails?.interviewFeedback ?? []}
                feedbackLocked={feedbackLocked}
                feedbackCount={feedbackCount}
                members={activeMembers}
                isOwner={data?.isOwner}
                permissions={data?.permissions}
              />
            )}

            {/* Submit feedback form */}
            {(data?.permissions?.includes("submit_feedback") || data?.isOwner) && (
              <div className="rb-card p-5">
                <div className="mb-4 flex items-start gap-3">
                  <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600"><ClipboardList size={17} /></div>
                  <div>
                    <h3 className="font-bold text-slate-900">Submit your interview feedback</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Rate each dimension independently. Your feedback is hidden from other interviewers until they submit their own.
                    </p>
                  </div>
                </div>
                <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 mb-3">
                  {([
                    ["technicalSkills", "Technical Skills"],
                    ["communicationSkills", "Communication Skills"],
                    ["problemSolving", "Problem Solving"],
                    ["cultureFit", "Culture Fit"],
                    ["leadership", "Leadership (optional)"],
                    ["roleSpecificSkills", "Role-Specific Skills"],
                    ["overallRecommendation", "Overall Recommendation"],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 text-xs text-slate-600 shrink-0">{label}</span>
                      <select
                        value={feedbackRatings[key] ?? ""}
                        onChange={e => setFeedbackRatings(prev => ({ ...prev, [key]: e.target.value }))}
                        disabled={!selectedCandidate}
                        className="rb-input w-28 shrink-0 py-1 text-xs"
                      >
                        <option value="">—</option>
                        {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v} / 5</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <textarea
                  value={feedbackComment}
                  onChange={e => setFeedbackComment(e.target.value)}
                  disabled={!selectedCandidate}
                  rows={3}
                  placeholder="Strengths, areas for improvement, overall impression…"
                  className="rb-input mb-3 h-auto resize-none border-indigo-200 bg-indigo-50/30 py-3"
                  data-testid="textarea-interview-feedback"
                />
                <button
                  type="button"
                  onClick={() => void addInterviewFeedback()}
                  disabled={!selectedCandidate || busy === "interview-feedback" || (feedbackComment.trim() === "" && !Object.values(feedbackRatings).some(v => v !== ""))}
                  className="rb-btn rb-btn-secondary rb-btn-sm border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  data-testid="button-submit-interview-feedback"
                >
                  {busy === "interview-feedback" ? "Submitting…" : <><ClipboardList size={14} /> Submit feedback</>}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Comments & Notes ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[.95fr_1.05fr]">
        <div className="rb-card p-5">
          <div className="mb-4 flex items-start gap-3"><div className="rounded-xl bg-sky-50 p-2 text-sky-600"><MessageSquare size={17} /></div><div><h3 className="font-bold text-slate-900">Candidate context</h3><p className="mt-0.5 text-xs text-slate-500">Add a visible comment or private hiring note.</p></div></div>
          <select value={selectedCandidate} onChange={(e) => setSelectedCandidate(e.target.value)} className="rb-input mb-3" data-testid="select-context-candidate"><option value="">Choose a candidate</option>{candidates.map((candidate) => <option key={getId(candidate)} value={getId(candidate)}>{candidate.name || candidate.email || "Unnamed candidate"}</option>)}</select>
          {selectedCandidateRecord && <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs"><span className="font-semibold text-slate-700">{selectedCandidateRecord.name || selectedCandidateRecord.email}</span><span className="text-slate-500">{candidateDetails?.comments?.length ?? 0} comments · {candidateDetails?.internalNotes?.length ?? 0} private notes</span></div>}
          <div className="mb-2 flex items-center gap-1"><button type="button" onClick={() => wrapComment("bold")} disabled={!selectedCandidate} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50" aria-label="Bold comment">B</button><button type="button" onClick={() => wrapComment("italic")} disabled={!selectedCandidate} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] italic text-slate-600 hover:bg-slate-50" aria-label="Italic comment">I</button><button type="button" onClick={() => wrapComment("bullet")} disabled={!selectedCandidate} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50" aria-label="Bulleted comment">List</button><span className="text-[10px] text-slate-400">Markdown formatting is supported</span></div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} disabled={!selectedCandidate} rows={3} placeholder="Share feedback with the hiring team…" className="rb-input mb-2 h-auto resize-none py-3" data-testid="textarea-candidate-comment" />
          <button type="button" onClick={() => void addCandidateContent("comments")} disabled={!selectedCandidate || !comment.trim() || busy === "comments"} className="rb-btn rb-btn-secondary rb-btn-sm mb-4" data-testid="button-add-comment">{busy === "comments" ? "Saving…" : <><Plus size={14} /> Add comment</>}</button>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} disabled={!selectedCandidate} rows={3} placeholder="Private note for internal decision-making…" className="rb-input mb-2 h-auto resize-none border-amber-200 bg-amber-50/40 py-3" data-testid="textarea-internal-note" />
          <button type="button" onClick={() => void addCandidateContent("internal-notes")} disabled={!selectedCandidate || !note.trim() || busy === "internal-notes"} className="rb-btn rb-btn-secondary rb-btn-sm border-amber-200 text-amber-800 hover:bg-amber-50" data-testid="button-add-internal-note">{busy === "internal-notes" ? "Saving…" : <><ShieldCheck size={14} /> Save private note</>}</button>
          {detailLoading && <p className="mt-3 text-xs text-slate-400">Loading candidate context…</p>}
          {candidateDetails && selectedCandidate && (
            <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Team comments</p>
                {(candidateDetails.comments ?? []).length === 0 ? <p className="text-xs text-slate-400">No comments yet.</p> : <div className="space-y-2">{candidateDetails.comments?.map((item) => <div key={item._id || item.id} className="rounded-xl bg-slate-50 p-3">{editingCommentId === (item._id || item.id) ? <><textarea value={editingCommentBody} onChange={(e) => setEditingCommentBody(e.target.value)} className="rb-input h-auto resize-none py-2 text-xs" rows={3} /><div className="mt-2 flex gap-2"><button type="button" onClick={() => void editComment(item._id || item.id || "")} className="rb-btn rb-btn-primary rb-btn-sm">Save edit</button><button type="button" onClick={() => setEditingCommentId("")} className="rb-btn rb-btn-ghost rb-btn-sm">Cancel</button></div></> : <><div className="prose prose-sm max-w-none text-xs text-slate-700"><ReactMarkdown>{item.body}</ReactMarkdown></div><div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400"><span>{item.author?.name || item.authorName || "Team member"} · {formatDate(item.updatedAt || item.createdAt)}{item.editHistory?.length ? " · edited" : ""}</span>{item.author?.name && <button type="button" onClick={() => { setEditingCommentId(item._id || item.id || ""); setEditingCommentBody(item.body); }} className="font-semibold text-indigo-600 hover:text-indigo-800">Edit</button>}</div></>}</div>)}</div>}
              </div>
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-600">Private internal notes</p>
                {(candidateDetails.internalNotes ?? []).length === 0 ? <p className="text-xs text-slate-400">No private notes yet.</p> : <div className="space-y-2">{candidateDetails.internalNotes?.map((item) => <div key={item._id || item.id} className="rounded-xl border border-amber-100 bg-amber-50/50 p-3"><p className="text-xs leading-5 text-slate-700">{item.body}</p><p className="mt-1 text-[10px] text-slate-400">{item.author?.name || item.authorName || "Team member"} · {formatDate(item.updatedAt || item.createdAt)}{item.editHistory?.length ? " · edited" : ""}</p></div>)}</div>}
              </div>
            </div>
          )}
        </div>

        <div className="rb-card p-5">
          <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><Activity size={17} className="text-indigo-600" /><h3 className="font-bold text-slate-900">Recent activity</h3></div><button type="button" onClick={() => void load()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" aria-label="Refresh recent activity"><RefreshCw size={15} /></button></div>
          {activity.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center text-center"><Activity className="mb-3 text-slate-300" size={28} /><p className="text-sm font-semibold text-slate-700">No activity yet</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">Invites, assignments, and feedback will appear here as the team works.</p></div> : <div className="space-y-4">{activity.slice(0, 8).map((item, index) => <div className="flex gap-3" key={item.id || item._id || `${item.createdAt}-${index}`} data-testid={`activity-${item.id || item._id || index}`}><div className="relative mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Activity size={13} /></div><div className="min-w-0 flex-1"><p className="text-sm leading-5 text-slate-700">{item.message || item.action || `${item.actor?.name || item.actorName || "A teammate"} updated collaboration`}</p><p className="mt-1 text-[11px] text-slate-400">{item.actor?.name || item.actorName ? `${item.actor?.name || item.actorName} · ` : ""}{formatDate(item.createdAt || item.timestamp)}</p></div></div>)}</div>}
        </div>
      </div>

      {inviteOpen && <div className="rb-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="invite-title" onMouseDown={(e) => { if (e.target === e.currentTarget) setInviteOpen(false); }}><div className="rb-modal w-full max-w-md"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="invite-title" className="font-bold text-slate-900">Invite teammate</h2><p className="mt-0.5 text-xs text-slate-500">Choose access that matches their responsibility.</p></div><button type="button" onClick={() => setInviteOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close invite dialog"><X size={17} /></button></div><div className="space-y-4 p-5"><label className="block text-xs font-semibold text-slate-600">Name<input value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="rb-input mt-1.5" placeholder="Alex Morgan" data-testid="input-invite-name" /></label><label className="block text-xs font-semibold text-slate-600">Work email<input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email" className="rb-input mt-1.5" placeholder="name@company.com" data-testid="input-invite-email" /></label><label className="block text-xs font-semibold text-slate-600">Role<select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as TeamRole)} className="rb-input mt-1.5" data-testid="select-invite-role">{ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label><div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{ROLE_OPTIONS.find((role) => role.value === inviteRole)?.summary}</div></div><div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4"><button type="button" onClick={() => setInviteOpen(false)} className="rb-btn rb-btn-ghost">Cancel</button><button type="button" onClick={() => void invite()} disabled={!inviteName.trim() || !inviteEmail.trim() || busy === "invite"} className="rb-btn rb-btn-primary">{busy === "invite" ? "Sending…" : <><UserPlus size={15} /> Send invitation</>}</button></div></div></div>}
    </section>
  );
}
