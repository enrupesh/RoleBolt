"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/trackEvent";

type Props = {
  event: string;
  data?: Record<string, string | number | boolean | null | undefined>;
};

export default function PageTracker({ event, data }: Props) {
  useEffect(() => {
    trackEvent(event, data);
  }, []);

  return null;
}
