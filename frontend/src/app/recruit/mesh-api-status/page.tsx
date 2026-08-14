// Legacy route — redirect to /recruit/status
import { redirect } from "next/navigation";

export default function LegacyStatusRedirect() {
  redirect("/recruit/status");
}
