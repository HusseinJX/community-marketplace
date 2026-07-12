"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { X, Loader2, ArrowRight } from "lucide-react";

// Vendors create their account with a phone number in /join, so they log back
// in the same way — a phone code, not Clerk's email/Google modal (that's the
// shopper path). Reuses the proven onboarding phone-code flow.
export function VendorPhoneLogin({
  onClose,
  redirectUrl = "/vendor",
}: {
  onClose: () => void;
  redirectUrl?: string;
}) {
  const clerk = useClerk();
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [noAccount, setNoAccount] = useState(false);

  async function sendCode() {
    if (phone.replace(/\D/g, "").length < 10) return setErr("Enter a valid mobile number.");
    setBusy(true);
    setErr("");
    setNoAccount(false);
    const e164 = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;
    try {
      const si = await clerk.client.signIn.create({ identifier: e164 });
      const factor = si.supportedFirstFactors?.find((f) => f.strategy === "phone_code") as
        | { strategy: "phone_code"; phoneNumberId: string }
        | undefined;
      if (!factor) throw new Error("This number can't sign in with a code.");
      await clerk.client.signIn.prepareFirstFactor({
        strategy: "phone_code",
        phoneNumberId: factor.phoneNumberId,
      });
      setStep("code");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      // No account for this phone → send them to onboarding instead.
      if (/couldn.?t find|not found|no account|identifier|invalid/i.test(msg)) {
        setNoAccount(true);
        setErr("No vendor account for that number yet.");
      } else {
        setErr(msg || "Couldn't text a code. Check the number.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (code.trim().length < 4) return setErr("Enter the 6-digit code.");
    setBusy(true);
    setErr("");
    try {
      const res = await clerk.client.signIn.attemptFirstFactor({
        strategy: "phone_code",
        code: code.trim(),
      });
      if (res.status !== "complete") throw new Error("That code didn't match.");
      await clerk.setActive({ session: res.createdSessionId });
      router.push(redirectUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That code didn't match.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">Vendor login</h2>
          <button onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-stone-400" />
          </button>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          {step === "phone"
            ? "Sign in with the phone number you used to set up your page."
            : `We texted a code to ${phone}.`}
        </p>

        {err && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
        {noAccount && (
          <a
            href="/join"
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-violet-700 hover:text-violet-900"
          >
            Set up your page <ArrowRight className="h-4 w-4" />
          </a>
        )}

        {step === "phone" ? (
          <>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="🇺🇸 +1 (415) 555-0132"
              className="mt-4 w-full rounded-lg border border-stone-200 px-3 py-2.5 text-sm"
            />
            <button
              onClick={sendCode}
              disabled={busy}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Text me a code
            </button>
          </>
        ) : (
          <>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              placeholder="Enter the 6-digit code"
              className="mt-4 w-full rounded-lg border border-stone-200 px-3 py-2.5 text-center text-lg tracking-widest"
            />
            <button
              onClick={confirm}
              disabled={busy}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm &amp; sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
