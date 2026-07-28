import express from "express";
import Stripe from "stripe";
import { connectMongo } from "./db";
import { Subscription } from "./models/Subscription";
import { User } from "./models/User";

export const billingRouter = express.Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(key, { apiVersion: "2025-06-30.basil" });
}

function getUid(req: express.Request): string {
  return (req as any).user?._id?.toString() ?? (req as any).user?.id?.toString() ?? "";
}

const PRICE_IDS: Record<string, string | undefined> = {
  pro:        process.env.STRIPE_PRO_PRICE_ID,
  agency:     process.env.STRIPE_AGENCY_PRICE_ID,
  seeker_pro: process.env.STRIPE_SEEKER_PRICE_ID,
};

// ── GET /billing/subscription ─────────────────────────────────────────────────
billingRouter.get("/subscription", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const sub = await Subscription.findOne({ userId: uid }).lean() as any;
    if (!sub) return res.json({ plan: "free", status: "active" });
    return res.json({
      plan: sub.plan,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      stripeCustomerId: sub.stripeCustomerId,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /billing/create-checkout ─────────────────────────────────────────────
billingRouter.post("/create-checkout", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const { plan } = req.body as { plan: string };

    const priceId = PRICE_IDS[plan];
    if (!priceId) return res.status(400).json({ error: `Unknown plan: ${plan}. Valid plans: pro, agency, seeker_pro.` });

    const stripe = getStripe();
    const user = await User.findById(uid).lean() as any;
    if (!user) return res.status(404).json({ error: "User not found." });

    // Reuse existing customer or create new one
    let sub = await Subscription.findOne({ userId: uid }).lean() as any;
    let customerId = sub?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: uid },
      });
      customerId = customer.id;
    }

    const frontendUrl = process.env.FRONTEND_URL || "https://www.rolebolt.tech";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${frontendUrl}/recruit/billing?success=1`,
      cancel_url: `${frontendUrl}/recruit/pricing?canceled=1`,
      metadata: { userId: uid, plan },
    });

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("[billing] create-checkout error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /billing/create-portal ───────────────────────────────────────────────
billingRouter.post("/create-portal", async (req, res) => {
  try {
    await connectMongo();
    const uid = getUid(req);
    const sub = await Subscription.findOne({ userId: uid }).lean() as any;
    if (!sub?.stripeCustomerId) {
      return res.status(400).json({ error: "No active subscription found." });
    }
    const stripe = getStripe();
    const frontendUrl = process.env.FRONTEND_URL || "https://www.rolebolt.tech";
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${frontendUrl}/recruit/billing`,
    });
    return res.json({ url: portal.url });
  } catch (err: any) {
    console.error("[billing] create-portal error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /billing/webhook ─────────────────────────────────────────────────────
// Must be registered BEFORE express.json() with raw body parsing
export async function handleStripeWebhook(
  req: express.Request,
  res: express.Response
) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn("[billing] STRIPE_WEBHOOK_SECRET not set — skipping signature check");
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    if (webhookSecret) {
      const sig = req.headers["stripe-signature"] as string;
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = JSON.parse(req.body.toString()) as Stripe.Event;
    }
  } catch (err: any) {
    console.error("[billing] webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await connectMongo();
    await handleStripeEvent(event);
    return res.json({ received: true });
  } catch (err: any) {
    console.error("[billing] webhook handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan as "pro" | "agency" | "seeker_pro";
      if (!userId || !plan) return;

      const sub = session.subscription
        ? await new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-06-30.basil" }).subscriptions.retrieve(session.subscription as string)
        : null;

      await Subscription.findOneAndUpdate(
        { userId },
        {
          $set: {
            userId,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            plan,
            status: "active",
            currentPeriodEnd: sub ? new Date((sub as any).current_period_end * 1000) : undefined,
            cancelAtPeriodEnd: false,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`[billing] checkout.session.completed → userId=${userId} plan=${plan}`);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const sub = await Subscription.findOne({ stripeCustomerId: customerId });
      if (!sub) return;
      sub.status = subscription.status as any;
      sub.cancelAtPeriodEnd = subscription.cancel_at_period_end;
      sub.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      await sub.save();
      console.log(`[billing] subscription.updated → customer=${customerId} status=${subscription.status}`);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      await Subscription.findOneAndUpdate(
        { stripeCustomerId: customerId },
        { $set: { status: "canceled", plan: "free" } }
      );
      console.log(`[billing] subscription.deleted → customer=${customerId} downgraded to free`);
      break;
    }

    default:
      // Ignore other events
      break;
  }
}
