import { randomUUID } from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";
import { UsageLedger, type IUsageLedger } from "../models/UsageLedger";
import { UsagePeriod } from "../models/UsagePeriod";
import { getBillingOperation } from "./operationCatalog";
import { getEntitlement, ensureUsagePeriod } from "./entitlements";
import { assertMeteredAccessAllowed } from "../billingTypes";
import { isLimited } from "./planCatalog";
import type { BillingCategory } from "../billingTypes";

export interface ReserveUsageInput {
  userId: string;
  category: BillingCategory;
  operation: string;
  idempotencyKey: string;
  resourceType?: string;
  resourceId?: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

export interface UsageReservation {
  reservationId: string;
  ledgerId: string;
  status: "reserved" | "committed" | "released";
  periodKey: string;
  units: number;
  counters: Record<string, number>;
}

export class UsageLimitError extends Error {
  readonly code = "PLAN_LIMIT_REACHED";
  readonly reasonCode: string;
  readonly category: BillingCategory;
  readonly feature: string;
  readonly used: number;
  readonly limit: number;

  constructor(input: {
    reasonCode: string;
    category: BillingCategory;
    feature: string;
    used: number;
    limit: number;
  }) {
    super(`The ${input.feature} limit has been reached for this plan.`);
    this.name = "UsageLimitError";
    this.reasonCode = input.reasonCode;
    this.category = input.category;
    this.feature = input.feature;
    this.used = input.used;
    this.limit = input.limit;
  }
}

export class UsageIdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_KEY_REUSED";

  constructor() {
    super("The idempotency key was already used for a different billing operation.");
    this.name = "UsageIdempotencyConflictError";
  }
}

function mapNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function mapValue(source: unknown, key: string): number {
  if (source instanceof Map) return mapNumber(source.get(key));
  if (source && typeof source === "object") return mapNumber((source as Record<string, unknown>)[key]);
  return 0;
}

function reservationFromLedger(ledger: IUsageLedger): UsageReservation {
  const counters = ledger.counters instanceof Map
    ? Object.fromEntries(ledger.counters.entries())
    : { ...(ledger.counters as Record<string, number>) };
  return {
    reservationId: ledger.reservationId,
    ledgerId: ledger._id.toString(),
    status: ledger.status === "committed" ? "committed" : ledger.status === "released" ? "released" : "reserved",
    periodKey: ledger.periodKey,
    units: ledger.units,
    counters,
  };
}

function assertSameIdempotentOperation(
  ledger: IUsageLedger,
  input: ReserveUsageInput,
): void {
  if (
    ledger.userId.toString() !== input.userId ||
    ledger.category !== input.category ||
    ledger.operation !== input.operation ||
    ledger.quantity !== (input.quantity ?? 1)
  ) {
    throw new UsageIdempotencyConflictError();
  }
}

export async function reserveUsage(input: ReserveUsageInput): Promise<UsageReservation> {
  if (!input.idempotencyKey.trim()) throw new Error("An idempotency key is required.");
  const operation = getBillingOperation(input.operation);
  if (operation.category !== input.category) {
    throw new Error(`Operation ${input.operation} does not belong to ${input.category}.`);
  }
  const quantity = input.quantity ?? 1;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error("Usage quantity must be a positive integer.");
  }

  const existing = await UsageLedger.findOne({ idempotencyKey: input.idempotencyKey }).exec();
  if (existing) {
    assertSameIdempotentOperation(existing, input);
    return reservationFromLedger(existing);
  }

  const session = await mongoose.startSession();
  try {
    let reservation: UsageReservation | null = null;
    await session.withTransaction(async () => {
      const entitlement = await getEntitlement(input.userId, input.category, new Date(), session);
      // Fail closed for past_due / halted: keep read access, block new metered work.
      assertMeteredAccessAllowed(entitlement);
      const { period, periodKey } = await ensureUsagePeriod(entitlement, session);
      if (!period) throw new Error("Could not create billing usage period.");

      const counters: Record<string, number> = {};
      if (operation.counter) counters[operation.counter] = quantity;
      counters.ai_units = operation.units * quantity;

      const limitEntries = Object.entries(counters).filter(([counter]) =>
        isLimited(entitlement.definition.limits[counter]),
      );
      const conditions: Record<string, unknown> = {
        userId: period.userId,
        category: input.category,
        periodKey,
      };
      for (const [counter, requested] of limitEntries) {
        const limit = entitlement.definition.limits[counter] as number;
        const used = mapValue(period.usedCounters, counter);
        const reserved = mapValue(period.reservedCounters, counter);
        if (used + reserved + requested > limit) {
          throw new UsageLimitError({
            reasonCode: `${counter.toUpperCase()}_QUOTA_EXHAUSTED`,
            category: input.category,
            feature: operation.description,
            used: used + reserved,
            limit,
          });
        }
      }
      if (limitEntries.length > 0) {
        conditions.$expr = {
          $and: limitEntries.map(([key, requestedAmount]) => ({
            $lte: [
              {
                $add: [
                  { $ifNull: [`$usedCounters.${key}`, 0] },
                  { $ifNull: [`$reservedCounters.${key}`, 0] },
                  requestedAmount,
                ],
              },
              entitlement.definition.limits[key],
            ],
          })),
        };
      }

      const reservationId = randomUUID();
      const setReserved: Record<string, number> = {};
      for (const [counter, requested] of Object.entries(counters)) {
        setReserved[`reservedCounters.${counter}`] = requested;
      }
      const periodQuery = UsagePeriod.findOneAndUpdate(
        conditions,
        { $inc: setReserved },
        { new: true },
      ).session(session);
      const periodAfter = await periodQuery.exec();
      if (!periodAfter) {
        throw new UsageLimitError({
          reasonCode: "QUOTA_CONFLICT",
          category: input.category,
          feature: operation.description,
          used: 0,
          limit: 0,
        });
      }

      const ledger = new UsageLedger({
        userId: period.userId,
        category: input.category,
        periodKey,
        operation: input.operation,
        resourceType: input.resourceType ?? "",
        resourceId: input.resourceId ?? "",
        units: operation.units * quantity,
        quantity,
        counters,
        reservationId,
        idempotencyKey: input.idempotencyKey,
        status: "reserved",
        metadata: input.metadata ?? {},
      });
      await ledger.save({ session });
      reservation = reservationFromLedger(ledger);
    });
    return reservation!;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const duplicate = await UsageLedger.findOne({ idempotencyKey: input.idempotencyKey }).exec();
      if (duplicate) {
        assertSameIdempotentOperation(duplicate, input);
        return reservationFromLedger(duplicate);
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function commitUsage(reservationId: string): Promise<UsageReservation> {
  return transitionUsage(reservationId, "committed");
}

export async function releaseUsage(reservationId: string): Promise<UsageReservation> {
  return transitionUsage(reservationId, "released");
}

async function transitionUsage(
  reservationId: string,
  targetStatus: "committed" | "released",
): Promise<UsageReservation> {
  const session = await mongoose.startSession();
  try {
    let result: UsageReservation | null = null;
    await session.withTransaction(async () => {
      const ledger = await UsageLedger.findOne({ reservationId, status: "reserved" }).session(session).exec();
      if (!ledger) {
        const existing = await UsageLedger.findOne({ reservationId }).session(session).exec();
        if (!existing) throw new Error("Usage reservation not found.");
        result = reservationFromLedger(existing);
        return;
      }
      const counters = ledger.counters instanceof Map
        ? Object.fromEntries(ledger.counters.entries())
        : { ...(ledger.counters as Record<string, number>) };
      const decrement: Record<string, number> = {};
      const increment: Record<string, number> = {};
      for (const [counter, quantity] of Object.entries(counters)) {
        decrement[`reservedCounters.${counter}`] = -quantity;
        if (targetStatus === "committed") increment[`usedCounters.${counter}`] = quantity;
      }
      const periodUpdate = await UsagePeriod.updateOne(
        { userId: ledger.userId, category: ledger.category, periodKey: ledger.periodKey },
        { $inc: { ...decrement, ...increment } },
        { session },
      ).exec();
      if (periodUpdate.matchedCount !== 1) {
        throw new Error("Usage period was not found while transitioning reservation.");
      }
      ledger.status = targetStatus;
      await ledger.save({ session });
      result = reservationFromLedger(ledger);
    });
    return result!;
  } finally {
    await session.endSession();
  }
}