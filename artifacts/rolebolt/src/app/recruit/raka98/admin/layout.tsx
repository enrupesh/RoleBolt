import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Rolebolt",
  robots: { index: false, follow: false },
};

export default function Raka98AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
