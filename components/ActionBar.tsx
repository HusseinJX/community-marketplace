"use client";

import { useEffect, useState } from "react";
import { UserPlus, Bell, HandHeart, MessageSquare, Check, MapPin } from "lucide-react";

export function ActionBar({
  memberId,
  isVendor,
}: {
  memberName?: string;
  memberId: string;
  isVendor: boolean;
}) {
  const [following, setFollowing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [visits, setVisits] = useState(0);
  const [justLogged, setJustLogged] = useState(false);

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
          "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition " +
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
          "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition " +
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
            "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition " +
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

      <button className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-rose-300 hover:text-rose-600">
        <HandHeart className="h-4 w-4" />
        Support
      </button>

      <button
        onClick={() => window.dispatchEvent(new CustomEvent("open-assistant"))}
        className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-indigo-300 hover:text-indigo-700"
      >
        <MessageSquare className="h-4 w-4" />
        Inquire
      </button>
    </div>
  );
}
