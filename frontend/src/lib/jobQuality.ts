export type QualityTier = "high" | "standard" | "basic";

export type QualityResult = {
  score: number;
  tier: QualityTier;
  label: string;
  color: string;
  bg: string;
  border: string;
  signals: { label: string; present: boolean }[];
};

export function computeJobQuality(job: {
  salaryMin?: number | null;
  salaryMax?: number | null;
  verifiedCompany?: boolean;
  generatedJD?: string;
  mustHaveSkills?: string;
  workMode?: string;
  freshersAllowed?: boolean;
  experienceMin?: number | null;
  experienceMax?: number | null;
  companyName?: string;
  noticePeriod?: string;
}): QualityResult {
  const signals = [
    { label: "Salary disclosed", present: Boolean(job.salaryMin || job.salaryMax) },
    { label: "Verified company", present: Boolean(job.verifiedCompany) },
    { label: "Full job description", present: Boolean(job.generatedJD && job.generatedJD.length > 100) },
    { label: "Skills listed", present: Boolean(job.mustHaveSkills && job.mustHaveSkills.trim().length > 0) },
    { label: "Work mode specified", present: Boolean(job.workMode) },
    { label: "Freshers eligibility clear", present: job.freshersAllowed !== undefined && job.freshersAllowed !== null },
    { label: "Experience range stated", present: job.experienceMin !== undefined && job.experienceMin !== null },
    { label: "Company info provided", present: Boolean(job.companyName && job.companyName.trim().length > 0) },
  ];

  const weights = [20, 20, 15, 15, 10, 8, 7, 5];
  const score = signals.reduce((sum, s, i) => sum + (s.present ? weights[i] : 0), 0);

  let tier: QualityTier;
  let label: string;
  let color: string;
  let bg: string;
  let border: string;

  if (score >= 70) {
    tier = "high";
    label = "High quality listing";
    color = "text-green-700";
    bg = "bg-green-50";
    border = "border-green-200";
  } else if (score >= 40) {
    tier = "standard";
    label = "Standard listing";
    color = "text-blue-700";
    bg = "bg-blue-50";
    border = "border-blue-200";
  } else {
    tier = "basic";
    label = "Basic listing";
    color = "text-slate-500";
    bg = "bg-slate-50";
    border = "border-slate-200";
  }

  return { score, tier, label, color, bg, border, signals };
}
