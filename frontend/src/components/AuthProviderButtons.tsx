"use client";

import { useEffect, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  OAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  type ConfirmationResult,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebaseClient";

type Props = {
  mode: "login" | "signup";
  onSuccess: () => void;
};

const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider("apple.com");

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.2-1.4 3.6-5.5 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M16.37 12.08c.02 2.25 1.98 3 2 3.01-.02.05-.31 1.07-1.03 2.12-.62.9-1.27 1.8-2.29 1.82-1 .02-1.32-.59-2.46-.59-1.14 0-1.5.57-2.43.61-.98.04-1.72-.98-2.35-1.88-1.27-1.83-2.25-5.16-.94-7.44.65-1.13 1.8-1.85 3.04-1.87.95-.02 1.86.64 2.46.64.6 0 1.73-.79 2.91-.67.5.02 1.9.2 2.79 1.5-.07.04-1.66.97-1.64 2.75ZM14.6 5.4c.52-.63.87-1.5.77-2.37-.74.03-1.63.49-2.16 1.12-.48.56-.9 1.45-.79 2.31.83.07 1.67-.42 2.18-1.06Z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm5 18.3a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4ZM7 5v11h10V5H7Z" />
    </svg>
  );
}

export function AuthProviderButtons({ mode, onSuccess }: Props) {
  const [loadingProvider, setLoadingProvider] = useState<
    "google" | "apple" | "phone" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [confirmationResult, setConfirmationResult] =
    useState<ConfirmationResult | null>(null);

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaId = `recaptcha-container-${mode}`;

  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
    };
  }, []);

  const continueWithPopup = async (provider: "google" | "apple") => {
    setError(null);
    setLoadingProvider(provider);
    try {
      const auth = getFirebaseAuth();
      const selected = provider === "google" ? googleProvider : appleProvider;
      await signInWithPopup(auth, selected);
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to continue with ${provider}.`
      );
    } finally {
      setLoadingProvider(null);
    }
  };

  const startPhoneFlow = async () => {
    setError(null);
    setLoadingProvider("phone");
    setShowPhoneModal(true);
    setLoadingProvider(null);
  };

  const sendCode = async () => {
    setError(null);
    setSendingCode(true);
    try {
      const auth = getFirebaseAuth();

      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, recaptchaId, {
          size: "normal",
        });
      }

      const result = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        recaptchaRef.current
      );
      setConfirmationResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP.");
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
    } finally {
      setSendingCode(false);
    }
  };

  const verifyCode = async () => {
    if (!confirmationResult) return;
    setError(null);
    setVerifyingCode(true);
    try {
      await confirmationResult.confirm(otpCode);
      setShowPhoneModal(false);
      setConfirmationResult(null);
      setPhoneNumber("");
      setOtpCode("");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP code.");
    } finally {
      setVerifyingCode(false);
    }
  };

  const providerButtons = [
    {
      id: "google" as const,
      label: mode === "login" ? "Continue with Google" : "Sign up with Google",
    },
    {
      id: "apple" as const,
      label: mode === "login" ? "Continue with Apple" : "Sign up with Apple",
    },
    {
      id: "phone" as const,
      label: mode === "login" ? "Continue with Phone" : "Sign up with Phone",
    },
  ];

  return (
    <div className="mt-6">
      <div className="relative mb-4">
        <div className="h-px" style={{ background: "var(--border)" }} />
        <span
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-3 text-[10px] uppercase tracking-[0.25em]"
          style={{ background: "var(--surface)", color: "var(--text-muted)" }}
        >
          or
        </span>
      </div>

      <div className="space-y-3">
        {providerButtons.map((item, index) => (
          <button
            key={item.id}
            type="button"
            disabled={loadingProvider !== null}
            onClick={() => {
              if (item.id === "phone") startPhoneFlow();
              else continueWithPopup(item.id);
            }}
            style={{
              animation: `providerFadeIn 380ms ease forwards`,
              animationDelay: `${index * 80}ms`,
              opacity: 0,
              transform: "translateY(6px)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--foreground)",
            }}
            className="group relative flex h-11 w-full items-center justify-center overflow-hidden rounded-2xl text-sm font-medium transition duration-300 hover:-translate-y-0.5 disabled:opacity-60"
          >
            <span className="absolute inset-0 -z-0 bg-gradient-to-r from-pink-500/0 via-purple-500/10 to-sky-500/0 opacity-0 transition group-hover:opacity-100" />
            <span className="absolute left-4" style={{ color: "var(--text-secondary)" }}>
              {item.id === "google" ? (
                <GoogleIcon />
              ) : item.id === "apple" ? (
                <AppleIcon />
              ) : (
                <PhoneIcon />
              )}
            </span>
            {loadingProvider === item.id ? "Please wait..." : item.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {showPhoneModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end p-4 sm:items-center sm:justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowPhoneModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl p-4"
            style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
              Verify phone number
            </h3>
            <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              Enter your phone in E.164 format (example: +919876543210).
            </p>

            {!confirmationResult ? (
              <div className="mt-4 space-y-3">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="h-11 w-full rounded-xl px-3 text-sm outline-none"
                  style={{ border: "1px solid var(--border)", background: "var(--surface-muted)", color: "var(--foreground)" }}
                  placeholder="+919876543210"
                />
                <div id={recaptchaId} />
                <button
                  type="button"
                  disabled={sendingCode || phoneNumber.trim().length < 8}
                  onClick={sendCode}
                  className="h-11 w-full rounded-2xl bg-[#1d2226] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {sendingCode ? "Sending code..." : "Send OTP"}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="h-11 w-full rounded-xl px-3 text-sm outline-none"
                  style={{ border: "1px solid var(--border)", background: "var(--surface-muted)", color: "var(--foreground)" }}
                  placeholder="Enter OTP"
                />
                <button
                  type="button"
                  disabled={verifyingCode || otpCode.trim().length < 4}
                  onClick={verifyCode}
                  className="h-11 w-full rounded-2xl bg-[#1d2226] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {verifyingCode ? "Verifying..." : "Verify & Continue"}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

