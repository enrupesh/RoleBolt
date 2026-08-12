import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Sora, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { RecruitAuthProvider } from "@/contexts/RecruitAuthContext";
import { BillingEntitlementProvider } from "@/contexts/BillingEntitlementContext";
import { SignupWelcomeModal } from "@/components/SignupWelcomeModal";
import { JudgeWelcomeModal } from "@/components/JudgeWelcomeModal";
import { JsonLd } from "@/components/JsonLd";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { buildMetadata, organizationJsonLd, websiteJsonLd, softwareApplicationJsonLd, productKeywords } from "@/lib/seo";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  preload: true,
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  preload: true,
});

const inter = localFont({
  src: [
    { path: "./fonts/InterVariable.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/InterVariable-Italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-geist-sans",
  display: "swap",
  preload: true,
  adjustFontFallback: "Arial",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.rolebolt.tech"),
  ...buildMetadata({
    title: "AI Recruiting Software & Job Search Workspace | Rolebolt",
    description:
      "Rolebolt combines AI recruiting software, applicant tracking, candidate evaluation and job-search tools in one focused workspace.",
    path: "/",
    keywords: [...productKeywords.recruit, "AI recruiting workspace", "job search workspace"],
    noIndex: true,
  }),
  icons: {
    icon: [
      { url: "/rolebolt-icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/rolebolt-icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/rolebolt-icon.png",
    other: [
      { rel: "manifest", url: "/manifest.webmanifest" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Rolebolt",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sora.variable} ${plusJakarta.variable}`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body className="app-theme min-h-screen antialiased" suppressHydrationWarning>
        <RecruitAuthProvider>
          <BillingEntitlementProvider>
            <ThemeProvider>
              <div className="min-h-screen">
                <JsonLd id="ld-rolebolt-organization" data={organizationJsonLd()} />
                <JsonLd id="ld-rolebolt-website" data={websiteJsonLd()} />
                <JsonLd id="ld-rolebolt-application" data={softwareApplicationJsonLd()} />
                {children}
                <SignupWelcomeModal />
                <JudgeWelcomeModal />
                <PwaInstallPrompt />
              </div>
            </ThemeProvider>
          </BillingEntitlementProvider>
        </RecruitAuthProvider>
      </body>
    </html>
  );
}
