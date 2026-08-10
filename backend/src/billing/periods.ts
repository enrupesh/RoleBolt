import type { BillingInterval } from "../billingTypes";

export interface PeriodWindow {
  periodKey: string;
  periodStart: Date;
  periodEnd: Date;
}

function monthEnd(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
}

export function getCalendarPeriod(now = new Date()): PeriodWindow {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const periodStart = new Date(Date.UTC(year, month, 1));
  return {
    periodKey: `${year}-${String(month + 1).padStart(2, "0")}`,
    periodStart,
    periodEnd: monthEnd(year, month),
  };
}

export function getPeriodWindow(
  interval: BillingInterval,
  now = new Date(),
  providerStart?: Date,
  providerEnd?: Date,
): PeriodWindow {
  if (providerStart && providerEnd && providerEnd.getTime() > providerStart.getTime()) {
    return {
      periodKey: `${providerStart.toISOString()}_${providerEnd.toISOString()}`,
      periodStart: new Date(providerStart),
      periodEnd: new Date(providerEnd),
    };
  }

  if (interval === "yearly") {
    const year = now.getUTCFullYear();
    const periodStart = new Date(Date.UTC(year, 0, 1));
    return {
      periodKey: `${year}`,
      periodStart,
      periodEnd: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
    };
  }

  return getCalendarPeriod(now);
}

export function isPeriodActive(period: PeriodWindow, now = new Date()): boolean {
  return now.getTime() >= period.periodStart.getTime() && now.getTime() <= period.periodEnd.getTime();
}