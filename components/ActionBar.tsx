"use client";

import { useEffect, useState } from "react";
import { UserPlus, Bell, HandHeart, MessageSquare, Check, MapPin, Heart, Apple, DollarSign, CreditCard, X } from "lucide-react";

export function ActionBar({
  memberName,
  memberId,
  isVendor,
  canInquire = false,
}: {
  memberName?: string;
  memberId: string;
  isVendor: boolean;
  /** Only show "Inquire" when the assistant is actually mounted on the page. */
  canInquire?: boolean;
}) {
  const [following, setFollowing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [visits, setVisits] = useState(0);
  const [justLogged, setJustLogged] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportAmount, setSupportAmount] = useState(50);

  const storageKey = `visits:${memberId}`;
  useEffect(() => {
    if (!isVendor) return;
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    setVisits(raw ? parseInt(raw, 10) || 0 : 0);
  }, [storageKey, isVendor]);

  const logVisit = () => {
    const next = visits + 1;
    setVisits(next);
    window.localStorage.setItem(storageKey, String(next));
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 1500);
  };

  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <button
        onClick={() => setFollowing((v) => !v)}
        className={
          "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition " +
          (following
            ? "bg-stone-900 text-white hover:bg-stone-800"
            : "bg-indigo-600 text-white hover:bg-indigo-700")
        }
      >
        {following ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        {following ? "Following" : "Follow"}
      </button>

      <button
        onClick={() => setSubscribed((v) => !v)}
        className={
          "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition " +
          (subscribed
            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
            : "border-stone-200 bg-white text-stone-700 hover:border-stone-300")
        }
      >
        <Bell className={`h-4 w-4 ${subscribed ? "fill-indigo-600 text-indigo-600" : ""}`} />
        {subscribed ? "Subscribed" : "Subscribe"}
      </button>

      {isVendor && (
        <button
          onClick={logVisit}
          className={
            "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition " +
            (visits > 0
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
              : "border-stone-200 bg-white text-stone-700 hover:border-emerald-300 hover:text-emerald-700")
          }
          title={visits > 0 ? `You've logged ${visits} visit${visits === 1 ? "" : "s"}` : "Log a visit"}
        >
          {justLogged ? <Check className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
          {justLogged ? "Visit logged!" : visits > 0 ? `Visited · ${visits}` : "Visited"}
        </button>
      )}

      <button
        onClick={() => setSupportOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-[13px] font-medium text-stone-700 transition hover:border-rose-300 hover:text-rose-600"
      >
        <HandHeart className="h-4 w-4" />
        Support
      </button>

      {canInquire && (
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-assistant"))}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-[13px] font-medium text-stone-700 transition hover:border-indigo-300 hover:text-indigo-700"
        >
          <MessageSquare className="h-4 w-4" />
          Inquire
        </button>
      )}

      {supportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm"
          onClick={() => setSupportOpen(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-rose-500 to-purple-600 p-4 text-white">
              <button
                aria-label="Close"
                onClick={() => setSupportOpen(false)}
                className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
              >
                <X className="h-4 w-4" />
              </button>
              <Heart className="h-7 w-7" />
              <h2 className="mt-3 text-xl font-semibold">
                Support {memberName || "this business"}
              </h2>
              <p className="mt-1 text-sm text-white/90">
                Show some love and help {memberName || "them"} keep going. Choose an amount and a
                payment method.
              </p>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                {[25, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setSupportAmount(amt)}
                    className={
                      "flex-1 rounded-xl border py-2 text-sm font-semibold transition " +
                      (supportAmount === amt
                        ? "border-purple-400 bg-purple-50 text-purple-700"
                        : "border-stone-200 bg-stone-50 text-stone-800 hover:border-purple-300 hover:bg-purple-50")
                    }
                  >
                    ${amt}
                  </button>
                ))}
              </div>
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800">
                <Apple className="h-4 w-4" /> Pay with Apple Pay
              </button>
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600">
                <DollarSign className="h-4 w-4" /> Pay with Cash App
              </button>
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
                <CreditCard className="h-4 w-4" /> Pay with Visa
              </button>
              <p className="pt-1 text-center text-xs text-stone-400">
                Demo only — Stripe integration coming soon.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
