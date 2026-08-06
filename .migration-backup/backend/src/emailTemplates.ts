// ── Email templates for the recruitment pipeline ──────────────────────────────
// All templates use inline CSS for maximum email-client compatibility.

export type EmailPayload = { subject: string; html: string; text: string };

/** Optional footer data for candidate-facing emails. */
export type CandidateEmailContext = {
  officialContactEmail?: string;
  statusUrl?: string;
};

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function nl2br(s: string) {
  return esc(s).replace(/\n/g, "<br>");
}

function officialContactHtml(email?: string): string {
  if (!email?.trim()) return "";
  const e = email.trim();
  return `
    <p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:13px;color:#475569;line-height:1.65;">
      <strong>Official contact email:</strong>
      <a href="mailto:${esc(e)}" style="color:#0a66c2;text-decoration:none;">${esc(e)}</a><br>
      You may also receive communication from this email address.
    </p>`;
}

function officialContactPlain(email?: string): string {
  if (!email?.trim()) return "";
  return `\n\nOfficial contact email: ${email.trim()}\nYou may also receive communication from this email address.`;
}

const WHAT_HAPPENS_NEXT = `
  <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.65;background:#f8fafc;border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0;">
    <strong style="color:#0f172a;">What happens next:</strong> After you complete each step, the hiring team reviews your progress and decides whether you move forward — for example, to an interview or the next stage.
  </p>`;

function shell(
  candidateName: string,
  subject: string,
  bodyHtml: string,
  ctx?: CandidateEmailContext,
): string {
  const contactBlock = officialContactHtml(ctx?.officialContactEmail);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr>
          <td style="background:#0a66c2;padding:28px 36px;text-align:center;">
            <span style="display:inline-block;background:#ffffff;border-radius:12px;padding:8px 14px;">
              <span style="font-size:18px;font-weight:900;color:#0a66c2;letter-spacing:-0.5px;">Rolebolt</span>
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px 24px;">
            <p style="margin:0 0 18px 0;font-size:15px;color:#0f172a;">Hi <strong>${esc(candidateName.split(" ")[0] || candidateName)}</strong>,</p>
            ${bodyHtml}
            ${contactBlock}
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #f1f5f9;padding:20px 36px;background:#fafafa;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
              You received this email because you applied for a job through Rolebolt. If you believe this was sent in error, please disregard it.
            </p>
            <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">
              © 2026 Rolebolt · <a href="https://www.rolebolt.tech" style="color:#94a3b8;text-decoration:none;">rolebolt.tech</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(text: string, href: string) {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
    <tr><td style="background:#0a66c2;border-radius:12px;padding:14px 32px;box-shadow:0 4px 14px rgba(10,102,194,0.35);">
      <a href="${href}" style="color:#fff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:-0.1px;">${text}</a>
    </td></tr>
  </table>`;
}

// ── 1. Screened (no assessment) ───────────────────────────────────────────────
export function screened(
  candidateName: string,
  jobTitle: string,
  companyName: string,
  ctx?: CandidateEmailContext,
): EmailPayload {
  const co = companyName ? ` at <strong>${esc(companyName)}</strong>` : "";
  const subject = `You've been screened — ${jobTitle}${companyName ? ` at ${companyName}` : ""}`;
  const html = shell(candidateName, subject, `
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      Congratulations! Your application for <strong>${esc(jobTitle)}</strong>${co} has been reviewed and you have been <strong>screened</strong> for the next stage of our hiring process.
    </p>
    ${WHAT_HAPPENS_NEXT}
    <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.65;">
      Our team will reach out with next steps soon. Please keep an eye on your inbox.
    </p>
    <p style="margin:0;font-size:15px;color:#333;">Warm regards,<br><strong>The Hiring Team${companyName ? `, ${esc(companyName)}` : ""}</strong></p>
  `, ctx);
  const text = `Hi ${candidateName},\n\nCongratulations! Your application for ${jobTitle}${companyName ? ` at ${companyName}` : ""} has been screened for the next stage.\n\nWhat happens next: After each step, the hiring team reviews your progress and decides whether you move forward.${officialContactPlain(ctx?.officialContactEmail)}\n\nWarm regards,\nThe Hiring Team`;
  return { subject, html, text };
}

// ── 1b. Screened + assessment invite (single email) ───────────────────────────
export function screenedWithAssessmentInvite(
  candidateName: string,
  jobTitle: string,
  companyName: string,
  assessmentUrl: string,
  ctx?: CandidateEmailContext,
): EmailPayload {
  const co = companyName ? ` at <strong>${esc(companyName)}</strong>` : "";
  const subject = `You've been screened — complete your assessment for ${jobTitle}${companyName ? ` at ${companyName}` : ""}`;
  const html = shell(candidateName, subject, `
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      Congratulations! You have been <strong>screened</strong> for the <strong>${esc(jobTitle)}</strong>${co} position.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      To continue, please complete a short written assessment. Click the button below when you are ready — the assessment will open on the next page.
    </p>
    ${btn("Start Assessment →", assessmentUrl)}
    <p style="margin:8px 0 6px;font-size:12px;color:#999;">Or copy this link into your browser:</p>
    <p style="margin:0 0 20px;font-size:11px;color:#bbb;word-break:break-all;">${esc(assessmentUrl)}</p>
    ${WHAT_HAPPENS_NEXT}
    <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.65;">
      After you complete the assessment, the hiring team will review your results and decide whether you proceed to the next round, such as an interview.
    </p>
    <p style="margin:0;font-size:15px;color:#333;">Best of luck,<br><strong>The Hiring Team${companyName ? `, ${esc(companyName)}` : ""}</strong></p>
  `, ctx);
  const text = `Hi ${candidateName},\n\nCongratulations! You have been screened for ${jobTitle}${companyName ? ` at ${companyName}` : ""}.\n\nTo receive your assessment, open this link when you are ready:\n${assessmentUrl}\n\nAfter you complete the assessment, the hiring team will review your results and decide whether you proceed to the next round.${officialContactPlain(ctx?.officialContactEmail)}\n\nBest of luck,\nThe Hiring Team`;
  return { subject, html, text };
}

// ── 2. Assessment reminder / standalone invite ────────────────────────────────
export function assessment(
  candidateName: string,
  jobTitle: string,
  companyName: string,
  assessmentUrl: string,
  ctx?: CandidateEmailContext,
): EmailPayload {
  const co = companyName ? ` at <strong>${esc(companyName)}</strong>` : "";
  const subject = `Complete your assessment — ${jobTitle}${companyName ? ` at ${companyName}` : ""}`;
  const html = shell(candidateName, subject, `
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      Your written assessment for <strong>${esc(jobTitle)}</strong>${co} is ready. Click below when you are ready to begin.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      The assessment has <strong>5 written questions</strong> and typically takes <strong>20–40 minutes</strong>. There is no timer — take your time and write thoughtful answers.
    </p>
    ${btn("Start Assessment →", assessmentUrl)}
    <p style="margin:8px 0 6px;font-size:12px;color:#999;">Or copy this link into your browser:</p>
    <p style="margin:0 0 20px;font-size:11px;color:#bbb;word-break:break-all;">${esc(assessmentUrl)}</p>
    ${WHAT_HAPPENS_NEXT}
    <p style="margin:0;font-size:15px;color:#333;">Best of luck,<br><strong>The Hiring Team${companyName ? `, ${esc(companyName)}` : ""}</strong></p>
  `, ctx);
  const text = `Hi ${candidateName},\n\nYour assessment for ${jobTitle}${companyName ? ` at ${companyName}` : ""} is ready.\n\nStart here: ${assessmentUrl}${officialContactPlain(ctx?.officialContactEmail)}\n\nBest of luck,\nThe Hiring Team`;
  return { subject, html, text };
}

// ── 3. Assessment Reminder ────────────────────────────────────────────────────
export function assessmentReminder(
  candidateName: string,
  jobTitle: string,
  companyName: string,
  assessmentUrl: string,
  ctx?: CandidateEmailContext,
): EmailPayload {
  const subject = `Reminder: Your assessment for ${jobTitle} is pending`;
  const html = shell(candidateName, subject, `
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      Just a friendly reminder — your written assessment for the <strong>${esc(jobTitle)}</strong>${companyName ? ` at <strong>${esc(companyName)}</strong>` : ""} role is still pending.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      This assessment is your opportunity to stand out. The link below is still active — take your time and share your genuine thinking.
    </p>
    ${btn("Complete Your Assessment →", assessmentUrl)}
    <p style="margin:8px 0 6px;font-size:12px;color:#999;">Or copy this link:</p>
    <p style="margin:0 0 24px;font-size:11px;color:#bbb;word-break:break-all;">${esc(assessmentUrl)}</p>
    <p style="margin:0;font-size:15px;color:#333;">Warm regards,<br><strong>The Hiring Team${companyName ? `, ${esc(companyName)}` : ""}</strong></p>
  `, ctx);
  const text = `Hi ${candidateName},\n\nJust a reminder — your assessment for ${jobTitle}${companyName ? ` at ${companyName}` : ""} is still pending.\n\nComplete it here: ${assessmentUrl}${officialContactPlain(ctx?.officialContactEmail)}\n\nWarm regards,\nThe Hiring Team`;
  return { subject, html, text };
}

// ── 3b. Assessed stage (assessment completed, under review) ─────────────────────
export function assessedStageEmail(
  candidateName: string,
  jobTitle: string,
  companyName: string,
  ctx?: CandidateEmailContext,
): EmailPayload {
  const co = companyName ? ` at <strong>${esc(companyName)}</strong>` : "";
  const subject = `Assessment received — ${jobTitle}${companyName ? ` at ${companyName}` : ""}`;
  const html = shell(candidateName, subject, `
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      Thank you for completing your assessment for the <strong>${esc(jobTitle)}</strong>${co} role.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      Our hiring team is now reviewing your responses. We appreciate the time and effort you put into your answers.
    </p>
    ${WHAT_HAPPENS_NEXT}
    <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.65;">
      We will contact you if you are selected to move forward — for example, to an interview.
    </p>
    <p style="margin:0;font-size:15px;color:#333;">Warm regards,<br><strong>The Hiring Team${companyName ? `, ${esc(companyName)}` : ""}</strong></p>
  `, ctx);
  const text = `Hi ${candidateName},\n\nThank you for completing your assessment for ${jobTitle}${companyName ? ` at ${companyName}` : ""}.\n\nOur hiring team is now reviewing your responses.${officialContactPlain(ctx?.officialContactEmail)}\n\nWarm regards,\nThe Hiring Team`;
  return { subject, html, text };
}

// ── 4. Interview Invitation ───────────────────────────────────────────────────
export function interview(
  candidateName: string,
  jobTitle: string,
  companyName: string,
  ctx?: CandidateEmailContext,
): EmailPayload {
  const co = companyName ? ` at <strong>${esc(companyName)}</strong>` : "";
  const subject = `Interview Invitation — ${jobTitle}${companyName ? ` at ${companyName}` : ""}`;
  const html = shell(candidateName, subject, `
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      Excellent news! After carefully reviewing your application and assessment, we'd like to invite you for an <strong>interview</strong> for the <strong>${esc(jobTitle)}</strong>${co} role.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      Our team will reach out shortly to schedule a convenient time. Please keep your calendar flexible over the coming days.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.65;">
      In the meantime, feel free to review the job description and prepare any questions you'd like to ask.
    </p>
    <p style="margin:0;font-size:15px;color:#333;">Looking forward to meeting you,<br><strong>The Hiring Team${companyName ? `, ${esc(companyName)}` : ""}</strong></p>
  `, ctx);
  const text = `Hi ${candidateName},\n\nWe'd like to invite you for an interview for the ${jobTitle} role${companyName ? ` at ${companyName}` : ""}.\n\nOur team will reach out shortly to schedule.${officialContactPlain(ctx?.officialContactEmail)}\n\nLooking forward to meeting you,\nThe Hiring Team`;
  return { subject, html, text };
}

// ── 5. Offer Letter ───────────────────────────────────────────────────────────
export function offerEmail(
  candidateName: string,
  jobTitle: string,
  companyName: string,
  offerBody: string,
  ctx?: CandidateEmailContext,
): EmailPayload {
  const subject = `Job Offer — ${jobTitle}${companyName ? ` at ${companyName}` : ""}`;
  const html = shell(candidateName, subject, `
    <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.65;">
      We are pleased to share your formal offer letter below. Please read it carefully and confirm your acceptance.
    </p>
    <div style="background:#f8f8ff;border-left:3px solid #4f46e5;border-radius:6px;padding:20px 24px;margin:0 0 20px;">
      <p style="margin:0;font-size:13.5px;color:#333;line-height:1.9;white-space:pre-wrap;font-family:Georgia,serif;">${nl2br(offerBody)}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#666;">To accept this offer, please reply to this email with your confirmation.</p>
  `, ctx);
  const text = `Hi ${candidateName},\n\nPlease find your offer letter below.\n\n${offerBody}${officialContactPlain(ctx?.officialContactEmail)}\n\nTo accept, please reply to this email.`;
  return { subject, html, text };
}

// ── 6. Hired / Welcome ────────────────────────────────────────────────────────
export function hired(
  candidateName: string,
  jobTitle: string,
  companyName: string,
  startDate?: string,
  ctx?: CandidateEmailContext,
): EmailPayload {
  const subject = `Welcome to the team, ${candidateName.split(" ")[0]}! 🎉`;
  const html = shell(candidateName, subject, `
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      We are absolutely thrilled to officially welcome you to the team! 🎉
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      You've been selected for the <strong>${esc(jobTitle)}</strong>${companyName ? ` at <strong>${esc(companyName)}</strong>` : ""}${startDate ? `, starting <strong>${esc(startDate)}</strong>` : ""}.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.65;">
      You'll be hearing from us very soon with onboarding details and everything you need to get started. We're genuinely excited to have you with us and can't wait to see what you'll accomplish.
    </p>
    <p style="margin:0;font-size:15px;color:#333;">Welcome aboard,<br><strong>The Hiring Team${companyName ? `, ${esc(companyName)}` : ""}</strong></p>
  `, ctx);
  const text = `Hi ${candidateName},\n\nWe're thrilled to welcome you to the team!\n\nYou've been selected for ${jobTitle}${companyName ? ` at ${companyName}` : ""}${startDate ? `, starting ${startDate}` : ""}.${officialContactPlain(ctx?.officialContactEmail)}\n\nWelcome aboard,\nThe Hiring Team`;
  return { subject, html, text };
}

// ── 7. Review Zone (Under Review) ────────────────────────────────────────────
export function reviewZoneEmail(
  candidateName: string,
  jobTitle: string,
  companyName: string,
  ctx?: CandidateEmailContext,
): EmailPayload {
  const co = companyName ? ` at <strong>${esc(companyName)}</strong>` : "";
  const subject = `Your application is under review`;
  const html = shell(candidateName, subject, `
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      Thank you for applying for the <strong>${esc(jobTitle)}</strong>${co} position.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      We have successfully received your application, and it is currently <strong>under review</strong> by our hiring team.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.65;">
      If your profile is selected for the next stage, we will contact you with further details.
    </p>
    <p style="margin:0;font-size:15px;color:#333;">Thank you for your interest in joining <strong>${companyName ? esc(companyName) : "our team"}</strong>.<br><br>Best regards,<br><strong>${companyName ? esc(companyName) : "The Hiring Team"}</strong></p>
  `, ctx);
  const text = `Hi ${candidateName},\n\nThank you for applying for the ${jobTitle}${companyName ? ` position at ${companyName}` : " position"}.\n\nYour application is under review.${officialContactPlain(ctx?.officialContactEmail)}\n\nBest regards,\n${companyName || "The Hiring Team"}`;
  return { subject, html, text };
}

// ── 8. Rejection ──────────────────────────────────────────────────────────────
export function rejectionEmailHtml(
  candidateName: string,
  jobTitle: string,
  companyName: string,
  body: string,
  ctx?: CandidateEmailContext,
): EmailPayload {
  const subject = `Update on your application — ${jobTitle}${companyName ? ` at ${companyName}` : ""}`;
  const html = shell(candidateName, subject, `
    <p style="margin:0;font-size:15px;color:#333;line-height:1.8;">${nl2br(body)}</p>
  `, ctx);
  return { subject, html, text: body + officialContactPlain(ctx?.officialContactEmail) };
}

// ── 8. Generic (custom / manually composed) ───────────────────────────────────
export function genericEmail(
  candidateName: string,
  subject: string,
  body: string,
  ctx?: CandidateEmailContext,
): string {
  return shell(candidateName, subject, `
    <p style="margin:0;font-size:15px;color:#333;line-height:1.8;">${nl2br(body)}</p>
  `, ctx);
}

// ── 9. Daily Recruiter Briefing ───────────────────────────────────────────────
export function dailyBriefing(
  recruiterName: string,
  briefingText: string,
  stats: { newApps: number; pendingReview: number; inInterview: number; activeJobs: number; staleJobs: string[] }
): string {
  const firstName = recruiterName.split(" ")[0] || recruiterName;
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const staleWarning = stats.staleJobs.length > 0
    ? `<tr><td style="padding:0 36px 24px;">
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;">
          <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#92400e;letter-spacing:0.04em;text-transform:uppercase;">⚠ Stale Jobs (low applications)</p>
          <p style="margin:0;font-size:13px;color:#92400e;">${stats.staleJobs.map(t => esc(t)).join(", ")}</p>
        </div>
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Daily Hiring Briefing</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0a66c2 0%,#1d4ed8 100%);padding:28px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="display:inline-block;background:#ffffff;border-radius:10px;padding:7px 13px;margin-bottom:14px;">
                    <span style="font-size:16px;font-weight:900;color:#0a66c2;letter-spacing:-0.5px;">Rolebolt</span>
                  </span>
                  <p style="margin:0;font-size:13px;font-weight:600;color:rgba(255,255,255,0.75);letter-spacing:0.04em;text-transform:uppercase;">Daily Briefing · ${esc(dateStr)}</p>
                  <p style="margin:6px 0 0;font-size:22px;font-weight:800;color:#ffffff;">Good morning, ${esc(firstName)}! ☀️</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Stats row -->
        <tr>
          <td style="padding:24px 36px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                ${[
                  { label: "New Applications", value: stats.newApps, color: "#0a66c2", bg: "#eff6ff" },
                  { label: "Awaiting Review", value: stats.pendingReview, color: "#7c3aed", bg: "#f5f3ff" },
                  { label: "In Interview", value: stats.inInterview, color: "#059669", bg: "#ecfdf5" },
                  { label: "Active Jobs", value: stats.activeJobs, color: "#d97706", bg: "#fffbeb" },
               ].map(s => `
                <td width="25%" style="padding:0 4px;">
                  <div style="background:${s.bg};border-radius:10px;padding:12px 10px;text-align:center;">
                    <p style="margin:0;font-size:22px;font-weight:800;color:${s.color};line-height:1;">${s.value}</p>
                    <p style="margin:4px 0 0;font-size:10px;font-weight:600;color:#64748b;line-height:1.3;">${s.label}</p>
                  </div>
                </td>`).join("")}
              </tr>
            </table>
          </td>
        </tr>

        <!-- Briefing text -->
        <tr>
          <td style="padding:24px 36px;">
            <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#64748b;letter-spacing:0.05em;text-transform:uppercase;">AI Analysis</p>
            <p style="margin:0;font-size:15px;color:#1e293b;line-height:1.75;">${nl2br(esc(briefingText))}</p>
          </td>
        </tr>

        ${staleWarning}

        <!-- CTA -->
        <tr>
          <td style="padding:0 36px 32px;text-align:center;">
            <a href="https://www.rolebolt.tech/recruit/dashboard" style="display:inline-block;background:#0a66c2;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:10px;">Open Dashboard →</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #f1f5f9;padding:20px 36px;background:#fafafa;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">You're receiving this because you have an active Rolebolt recruiter account.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}


// ── 10. Offer Reminder (to candidate) ─────────────────────────────────────────
export function offerReminderEmail(
  candidateName: string, jobTitle: string, companyName: string,
  offerUrl: string, daysLeft?: number,
  ctx?: CandidateEmailContext,
): EmailPayload {
  const subject = `Reminder: Your offer from ${companyName || 'us'} is waiting`;
  const expiryLine = daysLeft !== undefined && daysLeft > 0
    ? `<p style='margin:0 0 16px;font-size:13.5px;color:#b45309;font-weight:600;'>⏳ This offer expires in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>. Please respond before it expires.</p>`
    : '';
  const html = shell(candidateName, subject, `
    <p style='margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;'>
      This is a friendly reminder that your offer for <strong>${esc(jobTitle)}</strong>${companyName ? ` at <strong>${esc(companyName)}</strong>` : ''} is still awaiting your response.
    </p>
    ${expiryLine}
    <p style='margin:0 0 20px;font-size:14px;color:#555;line-height:1.65;'>
      Please take a moment to review the offer and let us know your decision by clicking the button below.
    </p>
    ${btn('Review & Respond to Offer', offerUrl)}
    <p style='margin:20px 0 0;font-size:13px;color:#888;'>Or copy this link: <a href='${offerUrl}' style='color:#0a66c2;'>${offerUrl}</a></p>
  `, ctx);
  const text = `Hi ${candidateName},\n\nThis is a reminder that your offer for ${jobTitle}${companyName ? ` at ${companyName}` : ''} is still awaiting your response.\n${daysLeft ? `\nThis offer expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.\n` : ''}\nPlease review and respond: ${offerUrl}${officialContactPlain(ctx?.officialContactEmail)}`;
  return { subject, html, text };
}

// ── 11. Offer Email with Review Link (to candidate) ───────────────────────────
export function offerEmailWithLink(
  candidateName: string, jobTitle: string, companyName: string,
  offerBody: string, offerUrl: string,
  ctx?: CandidateEmailContext,
): EmailPayload {
  const subject = `Job Offer — ${jobTitle}${companyName ? ` at ${companyName}` : ''}`;
  const html = shell(candidateName, subject, `
    <p style='margin:0 0 20px;font-size:15px;color:#333;line-height:1.65;'>
      We are pleased to extend you an offer for <strong>${esc(jobTitle)}</strong>${companyName ? ` at <strong>${esc(companyName)}</strong>` : ''}. Please review the letter below and use the button to officially accept or decline.
    </p>
    <div style='background:#f8f8ff;border-left:3px solid #4f46e5;border-radius:6px;padding:20px 24px;margin:0 0 20px;'>
      <p style='margin:0;font-size:13.5px;color:#333;line-height:1.9;white-space:pre-wrap;font-family:Georgia,serif;'>${nl2br(offerBody)}</p>
    </div>
    ${btn('Review & Sign Offer', offerUrl)}
    <p style='margin:16px 0 0;font-size:13px;color:#666;'>Or copy this link: <a href='${offerUrl}' style='color:#0a66c2;'>${offerUrl}</a></p>
  `, ctx);
  const text = `Hi ${candidateName},\n\nWe are pleased to extend you an offer for ${jobTitle}${companyName ? ` at ${companyName}` : ''}.\n\n${offerBody}\n\nReview and respond here: ${offerUrl}${officialContactPlain(ctx?.officialContactEmail)}`;
  return { subject, html, text };
}

// ── 12. Offer Response Notification (to recruiter) ────────────────────────────
export function offerResponseEmail(
  recruiterName: string, candidateName: string, jobTitle: string,
  response: 'accepted' | 'declined', signerName?: string
): string {
  const accepted = response === 'accepted';
  const color = accepted ? '#059669' : '#dc2626';
  const bg    = accepted ? '#f0fdf4' : '#fef2f2';
  const icon  = accepted ? '✅' : '❌';
  const label = accepted ? 'Accepted' : 'Declined';
  return `<!DOCTYPE html><html><body style='margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;'>
  <table width='100%' cellpadding='0' cellspacing='0' style='background:#f0f2f5;padding:40px 16px;'>
    <tr><td align='center'>
      <table width='100%' style='max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;'>
        <tr><td style='background:#0a66c2;padding:22px 36px;text-align:center;'>
          <span style='display:inline-block;background:#ffffff;border-radius:12px;padding:8px 14px;'>
            <span style='font-size:18px;font-weight:900;color:#0a66c2;letter-spacing:-0.5px;'>Rolebolt</span>
          </span>
        </td></tr>
        <tr><td style='padding:28px 36px;'>
          <p style='margin:0 0 16px;font-size:15px;color:#0f172a;'>Hi <strong>${esc(recruiterName || 'Recruiter')}</strong>,</p>
          <div style='background:${bg};border:1px solid ${color}30;border-radius:12px;padding:18px 20px;margin:0 0 20px;text-align:center;'>
            <p style='margin:0 0 8px;font-size:28px;'>${icon}</p>
            <p style='margin:0;font-size:17px;font-weight:700;color:${color};'>${esc(candidateName)} has <strong>${label}</strong> the offer</p>
            <p style='margin:6px 0 0;font-size:13px;color:#64748b;'>${esc(jobTitle)}</p>
            ${signerName && accepted ? `<p style='margin:8px 0 0;font-size:12px;color:#64748b;'>Signed as: <strong>${esc(signerName)}</strong></p>` : ''}
          </div>
          <p style='margin:0 0 20px;font-size:14px;color:#475569;line-height:1.65;'>
            ${accepted
              ? 'Great news! The candidate has accepted the offer and signed digitally. You can proceed with onboarding.'
              : 'The candidate has declined the offer. You may want to review other candidates or reach out for feedback.'
            }
          </p>
          <table cellpadding='0' cellspacing='0'><tr><td style='background:#0a66c2;border-radius:12px;padding:12px 28px;'>
            <a href='https://www.rolebolt.tech/recruit/dashboard' style='color:#fff;font-size:14px;font-weight:700;text-decoration:none;'>Open Dashboard →</a>
          </td></tr></table>
        </td></tr>
        <tr><td style='border-top:1px solid #f1f5f9;padding:18px 36px;background:#fafafa;text-align:center;'>
          <p style='margin:0;font-size:12px;color:#94a3b8;'>You received this because a candidate responded to an offer sent through Rolebolt.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── 13a. Offer Extended / Reactivated Notification (to candidate) ─────────────
export function offerExtendedEmail(
  candidateName: string, jobTitle: string, companyName: string,
  newExpiryDate: string, offerUrl: string, reactivated = false,
  ctx?: CandidateEmailContext,
): EmailPayload {
  const subject = reactivated
    ? `Your offer for ${jobTitle}${companyName ? ` at ${companyName}` : ''} has been reactivated`
    : `Your offer deadline has been extended — ${jobTitle}${companyName ? ` at ${companyName}` : ''}`;
  const intro = reactivated
    ? `Good news! Your offer for <strong>${esc(jobTitle)}</strong>${companyName ? ` at <strong>${esc(companyName)}</strong>` : ''} has been <strong>reactivated</strong>. You now have additional time to review and respond.`
    : `We wanted to let you know that the deadline on your offer for <strong>${esc(jobTitle)}</strong>${companyName ? ` at <strong>${esc(companyName)}</strong>` : ''} has been extended.`;
  const html = shell(candidateName, subject, `
    <p style='margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;'>${intro}</p>
    <div style='background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:14px 18px;margin:0 0 20px;text-align:center;'>
      <p style='margin:0;font-size:13px;color:#166534;font-weight:600;'>📅 New Expiry Date</p>
      <p style='margin:4px 0 0;font-size:18px;font-weight:700;color:#15803d;'>${esc(newExpiryDate)}</p>
    </div>
    <p style='margin:0 0 20px;font-size:14px;color:#555;line-height:1.65;'>
      Please review the offer and let us know your decision before the new deadline.
    </p>
    ${btn('Review & Respond to Offer', offerUrl)}
    <p style='margin:16px 0 0;font-size:13px;color:#888;'>Or copy this link: <a href='${offerUrl}' style='color:#0a66c2;'>${offerUrl}</a></p>
  `, ctx);
  const text = `Hi ${candidateName},\n\n${reactivated ? 'Your offer for ' : 'The deadline on your offer for '}${jobTitle}${companyName ? ` at ${companyName}` : ''} has been ${reactivated ? 'reactivated' : 'extended'}.\n\nNew expiry date: ${newExpiryDate}\n\nPlease review and respond: ${offerUrl}${officialContactPlain(ctx?.officialContactEmail)}`;
  return { subject, html, text };
}

// ── 13. Offer Expiry Warning (to recruiter) ───────────────────────────────────
export function offerExpiryWarning(
  recruiterName: string, candidateName: string, jobTitle: string, daysLeft: number
): string {
  const urgent = daysLeft <= 1;
  const color  = urgent ? '#dc2626' : '#d97706';
  return `<!DOCTYPE html><html><body style='margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;'>
  <table width='100%' cellpadding='0' cellspacing='0' style='background:#f0f2f5;padding:40px 16px;'>
    <tr><td align='center'>
      <table width='100%' style='max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;'>
        <tr><td style='background:#0a66c2;padding:22px 36px;text-align:center;'>
          <span style='display:inline-block;background:#ffffff;border-radius:12px;padding:8px 14px;'>
            <span style='font-size:18px;font-weight:900;color:#0a66c2;letter-spacing:-0.5px;'>Rolebolt</span>
          </span>
        </td></tr>
        <tr><td style='padding:28px 36px;'>
          <p style='margin:0 0 16px;font-size:15px;color:#0f172a;'>Hi <strong>${esc(recruiterName || 'Recruiter')}</strong>,</p>
          <div style='background:${urgent ? '#fef2f2' : '#fffbeb'};border:1px solid ${color}30;border-radius:12px;padding:16px 20px;margin:0 0 20px;'>
            <p style='margin:0;font-size:16px;font-weight:700;color:${color};'>⏰ Offer expiring ${daysLeft === 0 ? 'today' : `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}</p>
            <p style='margin:6px 0 0;font-size:13px;color:#64748b;'>${esc(candidateName)} · ${esc(jobTitle)}</p>
          </div>
          <p style='margin:0 0 20px;font-size:14px;color:#475569;line-height:1.65;'>The offer for <strong>${esc(candidateName)}</strong> is set to expire ${daysLeft === 0 ? 'today' : `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`} and the candidate has not yet responded. You may want to follow up or extend the deadline.</p>
          <table cellpadding='0' cellspacing='0'><tr><td style='background:#0a66c2;border-radius:12px;padding:12px 28px;'>
            <a href='https://www.rolebolt.tech/recruit/dashboard' style='color:#fff;font-size:14px;font-weight:700;text-decoration:none;'>View in Dashboard →</a>
          </td></tr></table>
        </td></tr>
        <tr><td style='border-top:1px solid #f1f5f9;padding:18px 36px;background:#fafafa;text-align:center;'>
          <p style='margin:0;font-size:12px;color:#94a3b8;'>You received this because you have an active offer in Rolebolt that is approaching expiry.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── 14. Assessment Completion Rate Alert (to recruiter) ───────────────────────
export function assessmentCompletionAlertEmail(
  recruiterName: string,
  jobTitle: string,
  completionRate: number,
  threshold: number,
  totalSent: number,
  totalCompleted: number,
  generatedAt: string,
  dashboardUrl: string,
): EmailPayload {
  const subject = `⚠️ Low assessment completion rate — ${jobTitle}`;
  const html = `<!DOCTYPE html><html><body style='margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;'>
  <table width='100%' cellpadding='0' cellspacing='0' style='background:#f0f2f5;padding:40px 16px;'>
    <tr><td align='center'>
      <table width='100%' style='max-width:540px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;'>
        <tr><td style='background:#0a66c2;padding:22px 36px;text-align:center;'>
          <span style='display:inline-block;background:#ffffff;border-radius:12px;padding:8px 14px;'>
            <span style='font-size:18px;font-weight:900;color:#0a66c2;letter-spacing:-0.5px;'>Rolebolt</span>
          </span>
        </td></tr>
        <tr><td style='padding:28px 36px;'>
          <p style='margin:0 0 16px;font-size:15px;color:#0f172a;'>Hi <strong>${esc(recruiterName || 'Recruiter')}</strong>,</p>
          <div style='background:#fffbeb;border:1px solid #fbbf2430;border-radius:12px;padding:18px 20px;margin:0 0 20px;'>
            <p style='margin:0;font-size:16px;font-weight:700;color:#d97706;'>⚠️ Assessment Completion Rate Alert</p>
            <p style='margin:8px 0 0;font-size:14px;color:#475569;line-height:1.6;'>
              The assessment completion rate for <strong>${esc(jobTitle)}</strong> has dropped to
              <strong style='color:#dc2626;'>${completionRate}%</strong>, which is below your
              configured threshold of <strong>${threshold}%</strong>.
            </p>
          </div>
          <table width='100%' cellpadding='0' cellspacing='0' style='border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:0 0 20px;'>
            <tr style='background:#f8fafc;'>
              <td style='padding:10px 16px;font-size:12px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0;'>Metric</td>
              <td style='padding:10px 16px;font-size:12px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0;text-align:right;'>Value</td>
            </tr>
            <tr><td style='padding:10px 16px;font-size:13px;color:#374151;border-bottom:1px solid #f1f5f9;'>Completion Rate</td><td style='padding:10px 16px;font-size:13px;font-weight:700;color:#dc2626;text-align:right;'>${completionRate}%</td></tr>
            <tr style='background:#fafafa;'><td style='padding:10px 16px;font-size:13px;color:#374151;border-bottom:1px solid #f1f5f9;'>Configured Threshold</td><td style='padding:10px 16px;font-size:13px;font-weight:700;color:#d97706;text-align:right;'>${threshold}%</td></tr>
            <tr><td style='padding:10px 16px;font-size:13px;color:#374151;border-bottom:1px solid #f1f5f9;'>Assessments Sent</td><td style='padding:10px 16px;font-size:13px;color:#374151;text-align:right;'>${totalSent}</td></tr>
            <tr style='background:#fafafa;'><td style='padding:10px 16px;font-size:13px;color:#374151;border-bottom:1px solid #f1f5f9;'>Assessments Completed</td><td style='padding:10px 16px;font-size:13px;color:#374151;text-align:right;'>${totalCompleted}</td></tr>
            <tr><td style='padding:10px 16px;font-size:12px;color:#94a3b8;'>Report Generated</td><td style='padding:10px 16px;font-size:12px;color:#94a3b8;text-align:right;'>${esc(generatedAt)}</td></tr>
          </table>
          <p style='margin:0 0 20px;font-size:14px;color:#475569;line-height:1.65;'>
            You may want to review the assessment experience, send reminder emails to candidates, or evaluate whether the assessment is too long or difficult.
          </p>
          <table cellpadding='0' cellspacing='0'><tr><td style='background:#0a66c2;border-radius:12px;padding:12px 28px;'>
            <a href='${esc(dashboardUrl)}' style='color:#fff;font-size:14px;font-weight:700;text-decoration:none;'>View Assessment Analytics →</a>
          </td></tr></table>
        </td></tr>
        <tr><td style='border-top:1px solid #f1f5f9;padding:18px 36px;background:#fafafa;text-align:center;'>
          <p style='margin:0;font-size:12px;color:#94a3b8;'>You received this because you configured an assessment completion rate alert in Rolebolt. To change your settings, visit the Assessment Analytics dashboard.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = `Hi ${recruiterName || 'Recruiter'},\n\nAssessment Completion Rate Alert for ${jobTitle}\n\nCurrent Rate: ${completionRate}% (threshold: ${threshold}%)\nSent: ${totalSent} | Completed: ${totalCompleted}\nGenerated: ${generatedAt}\n\nYou may want to review the assessment experience or send reminder emails to candidates.\n\nView dashboard: ${dashboardUrl}`;
  return { subject, html, text };
}

// ── 15. Team invitation (pending teammate — must accept via link) ───────────────
export function teamInviteEmail(args: {
  inviteeName: string;
  inviterName: string;
  companyName: string;
  jobTitle: string;
  roleLabel: string;
  permissionBullets: string[];
  acceptUrl: string;
  expiresAt: Date;
}): EmailPayload {
  const org = args.companyName?.trim() || args.jobTitle;
  const subject = `You're invited to join ${org} on Rolebolt`;
  const expiryStr = args.expiresAt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const bullets = args.permissionBullets.length
    ? args.permissionBullets.map(b => `<li style="margin:0 0 8px;font-size:14px;color:#475569;line-height:1.55;">${esc(b)}</li>`).join("")
    : `<li style="margin:0;font-size:14px;color:#475569;">Collaborate on this hiring workspace</li>`;

  const html = shell(args.inviteeName, subject, `
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      <strong>${esc(args.inviterName)}</strong> has invited you to join their hiring team on Rolebolt.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin:0 0 20px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Invitation details</p>
      <p style="margin:8px 0 0;font-size:15px;font-weight:700;color:#0f172a;">${esc(args.jobTitle)}</p>
      ${args.companyName ? `<p style="margin:4px 0 0;font-size:13px;color:#64748b;">${esc(args.companyName)}</p>` : ""}
      <p style="margin:12px 0 0;font-size:13px;color:#475569;"><strong>Your role:</strong> ${esc(args.roleLabel)}</p>
    </div>
    <p style="margin:0 0 12px;font-size:14px;color:#475569;line-height:1.65;">
      Rolebolt helps teams review candidates, run assessments, and make hiring decisions together. As a team member, you'll be able to:
    </p>
    <ul style="margin:0 0 20px;padding-left:20px;">${bullets}</ul>
    ${btn("Accept Invitation →", args.acceptUrl)}
    <p style="margin:8px 0 6px;font-size:12px;color:#94a3b8;">Or copy this link into your browser:</p>
    <p style="margin:0 0 20px;font-size:11px;color:#cbd5e1;word-break:break-all;">${esc(args.acceptUrl)}</p>
    <p style="margin:0 0 16px;font-size:13px;color:#64748b;line-height:1.6;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;">
      <strong style="color:#92400e;">This invitation expires on ${esc(expiryStr)}.</strong> After that, you'll need to ask ${esc(args.inviterName)} to send a new invite.
    </p>
    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.55;">
      If you weren't expecting this invitation, you can safely ignore this email.
    </p>
  `);

  const text = [
    `Hi ${args.inviteeName},`,
    "",
    `${args.inviterName} has invited you to join their hiring team on Rolebolt.`,
    "",
    `Job: ${args.jobTitle}`,
    args.companyName ? `Organization: ${args.companyName}` : "",
    `Role: ${args.roleLabel}`,
    "",
    "Accept your invitation:",
    args.acceptUrl,
    "",
    `This invitation expires on ${expiryStr}.`,
    "",
    "If you weren't expecting this, you can ignore this email.",
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}

// ── 16. Team added (existing Rolebolt user — immediate access) ─────────────────
export function teamMemberAddedEmail(args: {
  memberName: string;
  inviterName: string;
  companyName: string;
  jobTitle: string;
  roleLabel: string;
  jobUrl: string;
}): EmailPayload {
  const org = args.companyName?.trim() || args.jobTitle;
  const subject = `You've been added to ${org} on Rolebolt`;
  const html = shell(args.memberName, subject, `
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      <strong>${esc(args.inviterName)}</strong> added you to the hiring team for <strong>${esc(args.jobTitle)}</strong>${args.companyName ? ` at <strong>${esc(args.companyName)}</strong>` : ""}.
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.65;">
      Your role: <strong>${esc(args.roleLabel)}</strong>. You can sign in to Rolebolt and start collaborating right away.
    </p>
    ${btn("Open hiring workspace →", args.jobUrl)}
    <p style="margin:8px 0 0;font-size:11px;color:#cbd5e1;word-break:break-all;">${esc(args.jobUrl)}</p>
  `);
  const text = `Hi ${args.memberName},\n\n${args.inviterName} added you to ${args.jobTitle} as ${args.roleLabel}.\n\nOpen workspace: ${args.jobUrl}`;
  return { subject, html, text };
}

// ── 17. Form application received (confirmation to applicant) ───────────────────
export function formApplicationReceived(
  applicantName: string,
  formTitle: string,
  companyName: string,
  ctx?: CandidateEmailContext,
): EmailPayload {
  const org = companyName?.trim() || formTitle;
  const subject = `We received your application — ${formTitle}`;
  const html = shell(applicantName, subject, `
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      Thank you for applying${companyName ? ` to <strong>${esc(companyName)}</strong>` : ""}! We have successfully received your application for <strong>${esc(formTitle)}</strong>.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      Our team will review your responses and get back to you if you are selected to move forward.
    </p>
    ${WHAT_HAPPENS_NEXT}
    ${ctx?.statusUrl ? `<p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">You can check your application status anytime: <a href="${esc(ctx.statusUrl)}" style="color:#0a66c2;">View status</a></p>` : ""}
    <p style="margin:0;font-size:15px;color:#333;">Thank you for your interest!<br><strong>${companyName ? esc(companyName) : "The Hiring Team"}</strong></p>
  `, ctx);
  const text = `Hi ${applicantName},\n\nThank you for applying for ${formTitle}. We received your application and will review it soon.${ctx?.statusUrl ? `\n\nCheck status: ${ctx.statusUrl}` : ""}${officialContactPlain(ctx?.officialContactEmail)}\n\nThank you!`;
  return { subject, html, text };
}

// ── 18. Creator premium candidate email (Pro / Ultra Pro) ─────────────────────

export type CreatorEmailSender = {
  username: string;
  email: string;
  companyName: string;
};

function creatorEmailFooterHtml(sender: CreatorEmailSender): string {
  const username = sender.username?.trim() || "creator";
  const email = sender.email?.trim() || "unknown";
  return `
    <div data-rolebolt-immutable-footer="true" style="margin-top:28px;padding:18px 20px;border-radius:12px;background:linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%);border:1px solid #e2e8f0;">
      <p style="margin:0 0 8px;font-size:12px;color:#64748b;line-height:1.6;text-align:center;">
        This email was sent through <strong style="color:#0f172a;">Rolebolt</strong>.
      </p>
      <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;text-align:center;">
        Sent by <strong style="color:#0f172a;">@${esc(username)}</strong>
        <span style="color:#cbd5e1;"> · </span>
        <a href="mailto:${esc(email)}" style="color:#0a66c2;text-decoration:none;">${esc(email)}</a>
      </p>
    </div>`;
}

function creatorEmailFooterPlain(sender: CreatorEmailSender): string {
  const username = sender.username?.trim() || "creator";
  const email = sender.email?.trim() || "unknown";
  return `\n\n---\nThis email was sent through Rolebolt.\nSent by @${username} · ${email}`;
}

export function creatorPremiumCandidateEmail(args: {
  candidateName: string;
  subject: string;
  body: string;
  sender: CreatorEmailSender;
}): EmailPayload {
  const firstName = esc(args.candidateName.split(" ")[0] || args.candidateName || "there");
  const company = esc(args.sender.companyName?.trim() || "Your hiring team");
  const subject = args.subject.trim();
  const bodyHtml = nl2br(args.body.trim());
  const footerHtml = creatorEmailFooterHtml(args.sender);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:36px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 18px 50px rgba(15,23,42,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 55%,#0a66c2 100%);padding:28px 32px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.55);">Verified creator message</p>
            <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;line-height:1.2;">${company}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 28px;">
            <p style="margin:0 0 18px;font-size:15px;color:#0f172a;line-height:1.65;">Hi <strong>${firstName}</strong>,</p>
            <div style="font-size:15px;color:#334155;line-height:1.75;">${bodyHtml}</div>
            ${footerHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px;background:#fafbfc;border-top:1px solid #f1f5f9;text-align:center;">
            <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.5;">
              © ${new Date().getFullYear()} Rolebolt · <a href="https://www.rolebolt.tech" style="color:#94a3b8;text-decoration:none;">rolebolt.tech</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = `Hi ${args.candidateName.split(" ")[0] || args.candidateName},\n\n${args.body.trim()}${creatorEmailFooterPlain(args.sender)}`;
  return { subject, html, text };
}
