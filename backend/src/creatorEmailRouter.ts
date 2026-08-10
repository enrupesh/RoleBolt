import express, { Router } from "express";
import { connectMongo } from "./db";
import { sendCreatorPremiumEmails } from "./creatorEmailService";
import { respondStandardBillingError } from "./billing/standardEnforcement";
import { respondFormBillingError } from "./billing/formEnforcement";

function getUid(req: express.Request): string {
  const uid =
    (req as any).user?.uid ??
    (req as any).user?._id?.toString() ??
    (req as any).user?.id?.toString() ??
    "";
  return uid;
}

export const creatorEmailRouter = Router();

creatorEmailRouter.post("/send", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const {
      channel,
      contextId,
      recipients,
      subject,
      body,
      idempotencyKey,
    } = req.body as {
      channel?: "standard" | "form";
      contextId?: string;
      recipients?: Array<{ recipientId?: string }>;
      subject?: string;
      body?: string;
      idempotencyKey?: string;
    };

    if (channel !== "standard" && channel !== "form") {
      return res.status(400).json({ error: "Invalid channel." });
    }
    if (!contextId?.trim()) {
      return res.status(400).json({ error: "Missing contextId." });
    }

    const seed = String(idempotencyKey || `${uid}:${contextId}:${Date.now()}`).trim();
    const result = await sendCreatorPremiumEmails({
      uid,
      channel,
      contextId: contextId.trim(),
      recipients: (recipients || []).map((item) => ({ recipientId: String(item.recipientId || "") })),
      subject: String(subject || ""),
      body: String(body || ""),
      idempotencySeed: seed,
    });

    if (result.sent === 0 && result.failed > 0) {
      return res.status(502).json({
        error: "All emails failed to send.",
        ...result,
      });
    }

    return res.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send emails.";
    if (await respondStandardBillingError(res, err, getUid(req))) return;
    if (await respondFormBillingError(res, err, getUid(req))) return;
    console.error("[creator-email] POST /send", err);
    return res.status(500).json({ error: message });
  }
});
