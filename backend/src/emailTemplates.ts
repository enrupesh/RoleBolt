// ── Email templates for the recruitment pipeline ──────────────────────────────
// All templates use inline CSS for maximum email-client compatibility.

export type EmailPayload = { subject: string; html: string; text: string };

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function nl2br(s: string) {
  return esc(s).replace(/\n/g, "<br>");
}

function shell(candidateName: string, subject: string, bodyHtml: string): string {
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

// ── 1. Screened ───────────────────────────────────────────────────────────────
export function screened(candidateName: string, jobTitle: string, companyName: string): EmailPayload {
  const co = companyName ? ` at <strong>${esc(companyName)}</strong>` : "";
  const subject = `Your application for ${jobTitle}${companyName ? ` at ${companyName}` : ""} has been shortlisted`;
  const html = shell(candidateName, subject, `
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      Great news — your application for <strong>${esc(jobTitle)}</strong>${co} has been reviewed and you've been <strong>shortlisted</strong> for the next stage of our hiring process.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      Our team will now review your profile in detail and reach out with next steps. Please keep an eye on your inbox over the next few days.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#333;line-height:1.65;">
      Thank you for the time and effort you put into your application — it made a strong impression.
    </p>
    <p style="margin:0;font-size:15px;color:#333;">Warm regards,<br><strong>The Hiring Team${companyName ? `, ${esc(companyName)}` : ""}</strong></p>
  `);
  const text = `Hi ${candidateName},\n\nGreat news — your application for ${jobTitle}${companyName ? ` at ${companyName}` : ""} has been shortlisted.\n\nOur team will reach out with next steps soon.\n\nWarm regards,\nThe Hiring Team`;
  return { subject, html, text };
}

// ── 2. Assessment ─────────────────────────────────────────────────────────────
export function assessment(candidateName: string, jobTitle: string, companyName: string, assessmentUrl: string): EmailPayload {
  const co = companyName ? ` at <strong>${esc(companyName)}</strong>` : "";
  const subject = `Action required: Complete your assessment for ${jobTitle}${companyName ? ` at ${companyName}` : ""}`;
  const html = shell(candidateName, subject, `
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      Congratulations on advancing to the next stage! We've prepared a written assessment for your application to <strong>${esc(jobTitle)}</strong>${co}.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      The assessment has <strong>5 written questions</strong> and typically takes <strong>20–40 minutes</strong> to complete. There's no timer — take your time and write thoughtful answers. Quality matters more than speed.
    </p>
    ${btn("Start Your Assessment →", assessmentUrl)}
    <p style="margin:8px 0 6px;font-size:12px;color:#999;">Or copy this link into your browser:</p>
    <p style="margin:0 0 24px;font-size:11px;color:#bbb;word-break:break-all;">${esc(assessmentUrl)}</p>
    <p style="margin:0;font-size:15px;color:#333;">Best of luck,<br><strong>The Hiring Team${companyName ? `, ${esc(companyName)}` : ""}</strong></p>
  `);
  const text = `Hi ${candidateName},\n\nCongratulations! You've been selected to complete a written assessment for the ${jobTitle} role${companyName ? ` at ${companyName}` : ""}.\n\nPlease complete it here: ${assessmentUrl}\n\nBest of luck,\nThe Hiring Team`;
  return { subject, html, text };
}

// ── 3. Assessment Reminder ────────────────────────────────────────────────────
export function assessmentReminder(candidateName: string, jobTitle: string, companyName: string, assessmentUrl: string): EmailPayload {
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
  `);
  const text = `Hi ${candidateName},\n\nJust a reminder — your assessment for ${jobTitle}${companyName ? ` at ${companyName}` : ""} is still pending.\n\nComplete it here: ${assessmentUrl}\n\nWarm regards,\nThe Hiring Team`;
  return { subject, html, text };
}

// ── 4. Interview Invitation ───────────────────────────────────────────────────
export function interview(candidateName: string, jobTitle: string, companyName: string): EmailPayload {
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
  `);
  const text = `Hi ${candidateName},\n\nWe'd like to invite you for an interview for the ${jobTitle} role${companyName ? ` at ${companyName}` : ""}.\n\nOur team will reach out shortly to schedule.\n\nLooking forward to meeting you,\nThe Hiring Team`;
  return { subject, html, text };
}

// ── 5. Offer Letter ───────────────────────────────────────────────────────────
export function offerEmail(candidateName: string, jobTitle: string, companyName: string, offerBody: string): EmailPayload {
  const subject = `Job Offer — ${jobTitle}${companyName ? ` at ${companyName}` : ""}`;
  const html = shell(candidateName, subject, `
    <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.65;">
      We are pleased to share your formal offer letter below. Please read it carefully and confirm your acceptance.
    </p>
    <div style="background:#f8f8ff;border-left:3px solid #4f46e5;border-radius:6px;padding:20px 24px;margin:0 0 20px;">
      <p style="margin:0;font-size:13.5px;color:#333;line-height:1.9;white-space:pre-wrap;font-family:Georgia,serif;">${nl2br(offerBody)}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#666;">To accept this offer, please reply to this email with your confirmation.</p>
  `);
  const text = `Hi ${candidateName},\n\nPlease find your offer letter below.\n\n${offerBody}\n\nTo accept, please reply to this email.`;
  return { subject, html, text };
}

// ── 6. Hired / Welcome ────────────────────────────────────────────────────────
export function hired(candidateName: string, jobTitle: string, companyName: string, startDate?: string): EmailPayload {
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
  `);
  const text = `Hi ${candidateName},\n\nWe're thrilled to welcome you to the team!\n\nYou've been selected for ${jobTitle}${companyName ? ` at ${companyName}` : ""}${startDate ? `, starting ${startDate}` : ""}.\n\nYou'll hear from us soon with onboarding details.\n\nWelcome aboard,\nThe Hiring Team`;
  return { subject, html, text };
}

// ── 7. Review Zone (Under Review) ────────────────────────────────────────────
export function reviewZoneEmail(candidateName: string, jobTitle: string, companyName: string): EmailPayload {
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
  `);
  const text = `Hi ${candidateName},\n\nThank you for applying for the ${jobTitle}${companyName ? ` position at ${companyName}` : " position"}.\n\nWe have successfully received your application, and it is currently under review by our hiring team.\n\nIf your profile is selected for the next stage, we will contact you with further details.\n\nThank you for your interest in joining ${companyName || "our team"}.\n\nBest regards,\n${companyName || "The Hiring Team"}`;
  return { subject, html, text };
}

// ── 8. Rejection ──────────────────────────────────────────────────────────────
export function rejectionEmailHtml(candidateName: string, jobTitle: string, companyName: string, body: string): EmailPayload {
  const subject = `Update on your application — ${jobTitle}${companyName ? ` at ${companyName}` : ""}`;
  const html = shell(candidateName, subject, `
    <p style="margin:0;font-size:15px;color:#333;line-height:1.8;">${nl2br(body)}</p>
  `);
  return { subject, html, text: body };
}

// ── 8. Generic (custom / manually composed) ───────────────────────────────────
export function genericEmail(candidateName: string, subject: string, body: string): string {
  return shell(candidateName, subject, `
    <p style="margin:0;font-size:15px;color:#333;line-height:1.8;">${nl2br(body)}</p>
  `);
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
 // ── 10. Offer Reminder (to candidate) ────────────────────────────────────────
export function offerReminderEmail(
  candidateName: string, jobTitle: string, companyName: string,
  offerUrl: string, daysLeft?: number
): EmailPayload {
  const subject = `Reminder: Your offer from ${companyName || "us"} is waiting`;
  const expiryLine = daysLeft !== undefined && daysLeft > 0
    ? `<p style="margin:0 0 16px;font-size:13.5px;color:#b45309;font-weight:600;">⏳ This offer expires in <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong>. Please respond before it expires.</p>`
    : "";
  const html = shell(candidateName, subject, `
    <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.65;">
      This is a friendly reminder that your offer for <strong>${esc(jobTitle)}</strong>${companyName ? ` at <strong>${esc(companyName)}</strong>` : ""} is still awaiting your response.
    </p>
    ${expiryLine}
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.65;">
      Please take a moment to review the offer and let us know your decision by clicking the button below.
    </p>
    ${btn("Review & Respond to Offer", offerUrl)}
    <p style="margin:20px 0 0;font-size:13px;color:#888;">Or copy this link: <a href="${offerUrl}" style="color:#0a66c2;">${offerUrl}</a></p>
  `);
  const text = `Hi ${candidateName},\n\nThis is a reminder that your offer for ${jobTitle}${companyName ? ` at ${companyName}` : ""} is still awaiting your response.\n${daysLeft ? `\nThis offer expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.\n` : ""}\nPlease review and respond: ${offerUrl}`;
  return { subject, html, text };
}

// ── 11. Offer Email with Review Link (to candidate) ───────────────────────────
export function offerEmailWithLink(
  candidateName: string, jobTitle: string, companyName: string,
  offerBody: string, offerUrl: string
): EmailPayload {
  const subject = `Job Offer — ${jobTitle}${companyName ? ` at ${companyName}` : ""}`;
  const html = shell(candidateName, subject, `
    <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.65;">
      We are pleased to extend you an offer for <strong>${esc(jobTitle)}</strong>${companyName ? ` at <strong>${esc(companyName)}</strong>` : ""}. Please review the letter below and use the button to officially accept or decline.
    </p>
    <div style="background:#f8f8ff;border-left:3px solid #4f46e5;border-radius:6px;padding:20px 24px;margin:0 0 20px;">
      <p style="margin:0;font-size:13.5px;color:#333;line-height:1.9;white-space:pre-wrap;font-family:Georgia,serif;">${nl2br(offerBody)}</p>
    </div>
    ${btn("Review & Sign Offer", offerUrl)}
    <p style="margin:16px 0 0;font-size:13px;color:#666;">Or copy this link: <a href="${offerUrl}" style="color:#0a66c2;">${offerUrl}</a></p>
  `);
  const text = `Hi ${candidateName},\n\nWe are pleased to extend you an offer for ${jobTitle}${companyName ? ` at ${companyName}` : ""}.\n\n${offerBody}\n\nReview and respond here: ${offerUrl}`;
  return { subject, html, text };
}

// ── 12. Offer Response Notification (to recruiter) ────────────────────────────
export function offerResponseEmail(
  recruiterName: string, candidateName: string, jobTitle: string,
  response: "accepted" | "declined", signerName?: string
): string {
  const accepted = response === "accepted";
  const color = accepted ? "#059669" : "#dc2626";
  const bg    = accepted ? "#f0fdf4" : "#fef2f2";
  const icon  = accepted ? "✅" : "❌";
  const label = accepted ? "Accepted" : "Declined";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="background:#0a66c2;padding:22px 36px;text-align:center;">
          <span style="display:inline-block;background:#ffffff;border-radius:12px;padding:8px 14px;">
            <span style="font-size:18px;font-weight:900;color:#0a66c2;letter-spacing:-0.5px;">Rolebolt</span>
          </span>
        </td></tr>
        <tr><td style="padding:28px 36px;">
          <p style="margin:0 0 16px;font-size:15px;color:#0f172a;">Hi <strong>${esc(recruiterName || "Recruiter")}</strong>,</p>
          <div style="background:${bg};border:1px solid ${color}30;border-radius:12px;padding:18px 20px;margin:0 0 20px;text-align:center;">
            <p style="margin:0 0 8px;font-size:28px;">${icon}</p>
            <p style="margin:0;font-size:17px;font-weight:700;color:${color};">${esc(candidateName)} has <strong>${label}</strong> the offer</p>
            <p style="margin:6px 0 0;font-size:13px;color:#64748b;">${esc(jobTitle)}</p>
            ${signerName && accepted ? `<p style="margin:8px 0 0;font-size:12px;color:#64748b;">Signed as: <strong>${esc(signerName)}</strong></p>` : ""}
          </div>
          <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.65;">
            ${accepted
              ? "Great news! The candidate has accepted the offer and signed digitally. You can proceed with onboarding."
              : "The candidate has declined the offer. You may want to review other candidates or reach out for feedback."
            }
          </p>
          <table cellpadding="0" cellspacing="0"><tr><td style="background:#0a66c2;border-radius:12px;padding:12px 28px;">
            <a href="https://www.rolebolt.tech/recruit/dashboard" style="color:#fff;font-size:14px;font-weight:700;text-decoration:none;">Open Dashboard →</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="border-top:1px solid #f1f5f9;padding:18px 36px;background:#fafafa;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">You received this because a candidate responded to an offer sent through Rolebolt.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── 13. Offer Expiry Warning (to recruiter) ───────────────────────────────────
export function offerExpiryWarning(
  recruiterName: string, candidateName: string, jobTitle: string, daysLeft: number
): string {
  const urgent = daysLeft <= 1;
  const color  = urgent ? "#dc2626" : "#d97706";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="background:#0a66c2;padding:22px 36px;text-align:center;">
          <span style="display:inline-block;background:#ffffff;border-radius:12px;padding:8px 14px;">
            <span style="font-size:18px;font-weight:900;color:#0a66c2;letter-spacing:-0.5px;">Rolebolt</span>
          </span>
        </td></tr>
        <tr><td style="padding:28px 36px;">
          <p style="margin:0 0 16px;font-size:15px;color:#0f172a;">Hi <strong>${esc(recruiterName || "Recruiter")}</strong>,</p>
          <div style="background:${urgent ? "#fef2f2" : "#fffbeb"};border:1px solid ${color}30;border-radius:12px;padding:16px 20px;margin:0 0 20px;">
            <p style="margin:0;font-size:16px;font-weight:700;color:${color};">⏰ Offer expiring ${daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}</p>
            <p style="margin:6px 0 0;font-size:13px;color:#64748b;">${esc(candidateName)} · ${esc(jobTitle)}</p>
          </div>
          <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.65;">The offer for <strong>${esc(candidateName)}</strong> is set to expire ${daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`} and the candidate has not yet responded. You may want to follow up or extend the deadline.</p>
          <table cellpadding="0" cellspacing="0"><tr><td style="background:#0a66c2;border-radius:12px;padding:12px 28px;">
            <a href="https://www.rolebolt.tech/recruit/dashboard" style="color:#fff;font-size:14px;font-weight:700;text-decoration:none;">View in Dashboard →</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="border-top:1px solid #f1f5f9;padding:18px 36px;background:#fafafa;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">You received this because you have an active offer in Rolebolt that is approaching expiry.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

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
