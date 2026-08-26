"use client";

import useSWR from "swr";
import { useState } from "react";
import { Loader2, Plus, Trash2, Users, X } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  billing_interval: "month" | "year";
  discount_percent: number | null;
  perks: string[];
  active: boolean;
}

interface Member {
  id: string;
  plan_id: string;
  subscriber_name: string | null;
  subscriber_email: string | null;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  price_cents: number;
  billing_interval: string;
  started_at: string | null;
}

interface Payload {
  plans: Plan[];
  members: Member[];
  stats: { active: number; canceling: number; monthlyRevenueCents: number };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

const BLANK = {
  name: "",
  description: "",
  price: "",
  billing_interval: "month" as "month" | "year",
  discount_percent: "",
  perks: [""],
};

export function MembershipsManager() {
  const { data, isLoading, mutate } = useSWR<Payload>("/api/vendor/memberships", fetcher);
  const [form, setForm] = useState<typeof BLANK | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plans = data?.plans ?? [];
  const members = data?.members ?? [];
  const stats = data?.stats;

  function openNew() {
    setEditingId(null);
    setForm({ ...BLANK, perks: [""] });
    setError(null);
  }

  function openEdit(plan: Plan) {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      description: plan.description ?? "",
      price: (plan.price_cents / 100).toString(),
      billing_interval: plan.billing_interval,
      discount_percent: plan.discount_percent ? String(plan.discount_percent) : "",
      perks: plan.perks.length ? plan.perks : [""],
    });
    setError(null);
  }

  async function save() {
    if (!form) return;
    const priceCents = Math.round(parseFloat(form.price || "0") * 100);
    if (!form.name.trim() || !priceCents || priceCents < 100) {
      setError("Give it a name and a price of at least $1.");
      return;
    }
    setSaving(true);
    const body = {
      ...(editingId ? { id: editingId } : {}),
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_cents: priceCents,
      billing_interval: form.billing_interval,
      discount_percent: form.discount_percent ? parseInt(form.discount_percent, 10) : null,
      perks: form.perks.map((p) => p.trim()).filter(Boolean),
    };
    const res = await fetch("/api/vendor/memberships", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Couldn't save that. Please try again.");
      return;
    }
    setForm(null);
    setEditingId(null);
    await mutate();
  }

  async function retire(plan: Plan) {
    // Retiring is not deleting, and the wording has to say so — people are still
    // being charged for this tier and will keep being charged.
    const onIt = members.filter(
      (m) => m.plan_id === plan.id && ["active", "trialing", "past_due"].includes(m.status)
    ).length;
    const msg = onIt
      ? `Stop offering "${plan.name}"? The ${onIt} ${onIt === 1 ? "person" : "people"} already on it keep their membership and keep being charged — it just disappears from your profile.`
      : `Stop offering "${plan.name}"?`;
    if (!confirm(msg)) return;
    await fetch(`/api/vendor/memberships?id=${plan.id}`, { method: "DELETE" });
    await mutate();
  }

  const countFor = (planId: string) =>
    members.filter((m) => m.plan_id === planId && ["active", "trialing", "past_due"].includes(m.status))
      .length;

  return (
    <div className="space-y-6">
      {/* What it adds up to. Three numbers, because a membership business is
          really only ever asking two questions: how many, and how much. */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-soft p-4">
          <p className="text-2xl font-semibold text-stone-900">{stats?.active ?? "—"}</p>
          <p className="t-meta text-stone-500">Members</p>
        </div>
        <div className="card-soft p-4">
          <p className="text-2xl font-semibold text-stone-900">
            {stats ? money(stats.monthlyRevenueCents) : "—"}
          </p>
          <p className="t-meta text-stone-500">A month</p>
        </div>
        <div className="card-soft p-4">
          <p className="text-2xl font-semibold text-stone-900">{stats?.canceling ?? "—"}</p>
          <p className="t-meta text-stone-500">Leaving</p>
        </div>
      </div>

      {/* Tiers */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="section-label">Your tiers</p>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-4 py-2 t-meta font-semibold text-white transition hover:bg-stone-800"
          >
            <Plus className="h-4 w-4" /> New tier
          </button>
        </div>

        {isLoading && <p className="t-meta text-stone-400">Loading…</p>}

        {!isLoading && !plans.length && !form && (
          <div className="card-soft p-6 text-center">
            <p className="t-lead text-stone-900">No membership yet</p>
            <p className="mx-auto mt-1 max-w-md t-meta text-stone-500">
              A membership is a monthly charge your regulars pay for something they get back — money
              off everything, a free coffee, first pick of tickets. It lands in the same bank account
              as your sales.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {plans.map((plan) => (
            <div key={plan.id} className={`card-soft p-4 ${plan.active ? "" : "opacity-60"}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="t-strong text-stone-900">
                  {plan.name}
                  {!plan.active && <span className="ml-2 t-meta text-stone-400">retired</span>}
                </span>
                <span className="shrink-0 t-strong text-stone-900">
                  {money(plan.price_cents)}/{plan.billing_interval === "year" ? "yr" : "mo"}
                </span>
              </div>
              {plan.description && <p className="mt-1 t-meta text-stone-500">{plan.description}</p>}
              <p className="mt-2 t-meta text-stone-500">
                {plan.discount_percent ? `${plan.discount_percent}% off everything · ` : ""}
                {plan.perks.length} {plan.perks.length === 1 ? "other perk" : "other perks"}
                {" · "}
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {countFor(plan.id)}
                </span>
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => openEdit(plan)}
                  className="t-meta font-medium text-stone-600 underline underline-offset-2 hover:text-stone-900"
                >
                  Edit
                </button>
                {plan.active && (
                  <button
                    onClick={() => retire(plan)}
                    className="inline-flex items-center gap-1 t-meta font-medium text-stone-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Stop offering
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      {form && (
        <div className="card-soft space-y-4 p-4">
          <div className="flex items-center justify-between">
            <p className="t-strong text-stone-900">{editingId ? "Edit tier" : "New tier"}</p>
            <button onClick={() => setForm(null)} className="text-stone-400 hover:text-stone-900">
              <X className="h-5 w-5" />
            </button>
          </div>

          <label className="block">
            <span className="t-meta text-stone-500">What it&apos;s called</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Coffee Club"
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="t-meta text-stone-500">One line about it (optional)</span>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="For the regulars who are in most mornings."
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="t-meta text-stone-500">Price</span>
              <input
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                inputMode="decimal"
                placeholder="12"
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block flex-1">
              <span className="t-meta text-stone-500">Charged</span>
              <select
                value={form.billing_interval}
                onChange={(e) =>
                  setForm({ ...form, billing_interval: e.target.value as "month" | "year" })
                }
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
              >
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="t-meta text-stone-500">Discount on everything you sell (optional)</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                value={form.discount_percent}
                onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
                inputMode="numeric"
                placeholder="10"
                className="w-24 rounded-xl border border-stone-200 px-3 py-2 text-sm"
              />
              <span className="t-meta text-stone-500">% off</span>
            </div>
            {/* The one perk the software keeps for them, so it is worth saying
                plainly that it is not something they have to remember. */}
            <span className="mt-1 block t-meta text-stone-400">
              Taken off automatically at checkout. You never have to apply it.
            </span>
          </label>

          <div>
            <span className="t-meta text-stone-500">Everything else they get</span>
            <span className="mt-0.5 block t-meta text-stone-400">
              Things you hand over in person — a free pastry, members-only hours, first pick of
              tickets. We show these; you honour them.
            </span>
            <div className="mt-2 space-y-2">
              {form.perks.map((perk, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={perk}
                    onChange={(e) => {
                      const perks = [...form.perks];
                      perks[i] = e.target.value;
                      setForm({ ...form, perks });
                    }}
                    placeholder="A free pastry every month"
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() =>
                      setForm({ ...form, perks: form.perks.filter((_, j) => j !== i) })
                    }
                    className="shrink-0 px-2 text-stone-400 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setForm({ ...form, perks: [...form.perks, ""] })}
                className="t-meta font-medium text-stone-600 underline underline-offset-2"
              >
                Add another
              </button>
            </div>
          </div>

          {error && <p className="t-meta text-red-600">{error}</p>}

          <button
            onClick={save}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 t-meta font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editingId ? "Save changes" : "Start offering it"}
          </button>
          {editingId && (
            <p className="t-meta text-stone-400">
              Changing the price only affects people who join from now on. Everyone already on this
              tier keeps paying what they agreed to.
            </p>
          )}
        </div>
      )}

      {/* Members */}
      {members.length > 0 && (
        <div>
          <p className="section-label mb-3">Your members</p>
          <div className="space-y-2">
            {members.map((m) => {
              const plan = plans.find((p) => p.id === m.plan_id);
              const live = ["active", "trialing", "past_due"].includes(m.status);
              return (
                <div key={m.id} className="card-soft flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    {/* data-private: a customer's name and email, on a screen
                        PostHog records at 100%. */}
                    <p className="truncate t-strong text-stone-900" data-private>
                      {m.subscriber_name || m.subscriber_email || "A member"}
                    </p>
                    <p className="truncate t-meta text-stone-500">
                      {plan?.name ?? "Membership"}
                      {m.started_at
                        ? ` · since ${new Date(m.started_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 t-meta ${live ? "text-stone-500" : "text-stone-400"}`}
                  >
                    {m.status === "past_due"
                      ? "Payment failed"
                      : m.cancel_at_period_end
                        ? "Leaving"
                        : live
                          ? `${money(m.price_cents)}/${m.billing_interval === "year" ? "yr" : "mo"}`
                          : "Ended"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
