"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { sitegenDisplayPublicUrl } from "../../lib/publicUrl";

type SitegenShareToolsProps = {
  username: string;
  publicUrl: string;
};

export function SitegenShareTools({ username, publicUrl }: SitegenShareToolsProps) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    void QRCode.toDataURL(publicUrl, {
      width: 180,
      margin: 1,
      color: { dark: "#1a1033", light: "#ffffff" },
    }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [publicUrl]);

  async function handleCopy() {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyError("Couldn't copy the URL. Please copy it manually.");
    }
  }

  async function handleShare() {
    const shareData = {
      title: `${username} on Sitegen`,
      text: `Check out my website at ${sitegenDisplayPublicUrl(username)}`,
      url: publicUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled
      }
      return;
    }
    await handleCopy();
  }

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-white">Share your website</h2>
      <p className="mt-2 text-sm text-violet-100/60">
        Your live URL: <span className="font-medium text-white">{sitegenDisplayPublicUrl(username)}</span>
      </p>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex flex-1 flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1a1033] hover:bg-violet-50"
          >
            {copied ? "Copied!" : "Copy URL"}
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            Share
          </button>
        </div>

        {copyError ? <p className="mt-3 text-sm text-red-300">{copyError}</p> : null}

        {qrDataUrl ? (
          <div className="rounded-2xl border border-white/10 bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt={`QR code for ${sitegenDisplayPublicUrl(username)}`} width={180} height={180} className="block" />
            <p className="mt-2 text-center text-xs text-slate-500">Scan to open your site</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
