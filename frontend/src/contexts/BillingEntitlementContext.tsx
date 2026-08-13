"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import {
  fetchEntitlements,
  type BillingCategory,
  type CategoryEntitlement,
  type ProcessingPriority,
} from "@/lib/billing";
import { isUpgradeRequiredError } from "@/lib/billing";

type BillingEntitlementContextValue = {
  loading: boolean;
  error: string;
  entitlements: CategoryEntitlement[];
  refresh: () => Promise<void>;
  getEntitlement: (category: BillingCategory) => CategoryEntitlement | null;
  canUse: (category: BillingCategory, feature: string) => boolean;
  remaining: (category: BillingCategory, counter: string) => number | null | undefined;
  processingPriority: (category: BillingCategory) => ProcessingPriority;
  isUpgradeRequired: (error: unknown) => boolean;
};

const BillingEntitlementContext = createContext<BillingEntitlementContextValue | null>(null);

function emptyEntitlement(category: BillingCategory): CategoryEntitlement {
  return {
    category,
    plan: "free",
    interval: "monthly",
    status: "free",
    processingPriority: "free",
    featureFlags: {},
    cancelAtPeriodEnd: false,
    meteredAccessAllowed: true,
    billingWarning: null,
    pendingPlan: null,
    pendingInterval: null,
    pendingChangeAt: null,
    periodStart: new Date().toISOString(),
    periodEnd: new Date().toISOString(),
    usedCounters: {},
    reservedCounters: {},
    remaining: {},
  };
}

export function BillingEntitlementProvider({ children }: { children: ReactNode }) {
  const { sessionToken } = useRecruitAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [entitlements, setEntitlements] = useState<CategoryEntitlement[]>([]);

  const refresh = useCallback(async () => {
    if (!sessionToken) {
      setEntitlements([]);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await fetchEntitlements(sessionToken);
      setEntitlements(data.entitlements ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load entitlements.");
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll while checkout/webhook confirmation may still be pending.
  useEffect(() => {
    if (!sessionToken || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const checkoutPending = params.get("checkout") === "pending";
    const hasPendingState = entitlements.some(
      (item) =>
        item.billingWarning === "payment_pending" ||
        item.billingWarning === "plan_change_pending" ||
        Boolean(item.pendingPlan),
    );
    if (!checkoutPending && !hasPendingState) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [sessionToken, entitlements, refresh]);

  const getEntitlement = useCallback(
    (category: BillingCategory) =>
      entitlements.find((item) => item.category === category) ?? null,
    [entitlements],
  );

  const canUse = useCallback(
    (category: BillingCategory, feature: string) => {
      const entitlement = getEntitlement(category);
      if (!entitlement) return true;
      if (!entitlement.meteredAccessAllowed) return false;
      if (!(feature in entitlement.featureFlags)) return true;
      return Boolean(entitlement.featureFlags[feature]);
    },
    [getEntitlement],
  );

  const remaining = useCallback(
    (category: BillingCategory, counter: string) => {
      const entitlement = getEntitlement(category);
      if (!entitlement) return undefined;
      return entitlement.remaining[counter];
    },
    [getEntitlement],
  );

  const processingPriority = useCallback(
    (category: BillingCategory) => getEntitlement(category)?.processingPriority ?? "free",
    [getEntitlement],
  );

  const value = useMemo<BillingEntitlementContextValue>(
    () => ({
      loading,
      error,
      entitlements,
      refresh,
      getEntitlement,
      canUse,
      remaining,
      processingPriority,
      isUpgradeRequired: isUpgradeRequiredError,
    }),
    [
      loading,
      error,
      entitlements,
      refresh,
      getEntitlement,
      canUse,
      remaining,
      processingPriority,
    ],
  );

  return (
    <BillingEntitlementContext.Provider value={value}>
      {children}
    </BillingEntitlementContext.Provider>
  );
}

export function useBillingEntitlements(): BillingEntitlementContextValue {
  const ctx = useContext(BillingEntitlementContext);
  if (!ctx) {
    // Safe fallback when provider is not mounted (public pages).
    return {
      loading: false,
      error: "",
      entitlements: [],
      refresh: async () => undefined,
      getEntitlement: () => null,
      canUse: () => true,
      remaining: () => undefined,
      processingPriority: () => "free",
      isUpgradeRequired: isUpgradeRequiredError,
    };
  }
  return ctx;
}

export function useCategoryEntitlement(category: BillingCategory): CategoryEntitlement {
  const { getEntitlement } = useBillingEntitlements();
  return getEntitlement(category) ?? emptyEntitlement(category);
}
