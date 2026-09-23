"use client";

import Link from "next/link";
import useSWR from "swr";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ArrowRight, BadgeCheck, Calendar, Package, Receipt, Ticket, WalletCards } from "lucide-react";
import { BackToHome } from "@/components/BackToHome";
import { useLogin } from "@/components/auth/ClerkAuthProvider";

type Filter = "all" | "tickets" | "purchases" | "memberships";

interface OrderRow {
  id: string;
  order_number: string;
  member_id: string;
  status: string;
  items: { name: string; qty?: number; price_cents?: number }[];
  subtotal_cents: number;
  discount_cents: number | null;
  member_discount_percent: number | null;
  fulfillment_type: string;
  delivery_provider: string | null;
  delivery_fee_charged_cents: number | null;
  event_id: string | null;
  created_at: string;
}

interface TicketRow {
  token: string;
  code: string;
  typeName: string | null;
  status: string;
  priceCents: number;
  event: {
    id: string;
    title: string;
    date: string | null;
    time: string | null;
    location: string | null;
    hostName: string | null;
  };
}

interface MembershipRow {
  id: string;
  member_id: string;
  plan_name: string;
  business_name: string;
  status: string;
  price_cents: number;
  billing_interval: string;
  current_period_end: string | null;
}

interface TimelineItem {
  id: string;
  type: Exclude<Filter, "all">;
  href: string;
  title: string;
  subtitle: string;
  meta: string;
  amount: string;
  at: string;
}

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))));

function money(cents: number | null | undefined): string {
  return `$${((cents ?? 0) / 100).toFixed(2)}`;
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return "Date pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function orderTitle(order: OrderRow): string {
  const first = order.items?.[0]?.name;
  if (!first) return order.order_number;
  const extra = Math.max(0, (order.items?.length ?? 0) - 1);
  return extra ? `${first} + ${extra} more` : first;
}

function fulfillmentLabel(order: OrderRow): string {
  if (order.fulfillment_type === "digital") return "Digital delivery";
  if (order.fulfillment_type === "service") return "Service";
  if (order.delivery_provider === "printify") return "Ships from Printify";
  if (order.fulfillment_type === "delivery") return "Delivery";
  if (order.fulfillment_type === "pickup") return "Pickup";
  return order.fulfillment_type || "Purchase";
}

export function OrdersClient() {
  const { isLoaded, isSignedIn } = useAuth();
  const openLogin = useLogin();
  const [filter, setFilter] = useState<Filter>("all");

  const { data: ordersData, isLoading: ordersLoading } = useSWR<{ orders: OrderRow[] }>(
    isSignedIn ? "/api/orders/mine" : null,
    fetcher,
  );
  const { data: ticketsData, isLoading: ticketsLoading } = useSWR<{ tickets: TicketRow[] }>(
    isSignedIn ? "/api/tickets/mine" : null,
    fetcher,
  );
  const { data: membershipsData, isLoading: membershipsLoading } = useSWR<{ memberships: MembershipRow[] }>(
    isSignedIn ? "/api/memberships" : null,
    fetcher,
  );

  if (isLoaded && !isSignedIn) {
    return (
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8">
        <BackToHome href="/shopper" label="Your space" />
        <div className="card-soft p-6 text-center">
          <Receipt className="mx-auto h-8 w-8 text-stone-300" />
          <p className="mt-2 text-sm text-stone-600">Sign in to see your orders and tickets.</p>
          <button
            onClick={() => openLogin({ redirectUrl: "/orders" })}
            className="mt-4 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800"
          >
            Sign in
          </button>
        </div>
      </main>
    );
  }

  const purchases: TimelineItem[] = (ordersData?.orders ?? [])
    .filter((order) => order.fulfillment_type !== "ticket")
    .map((order) => ({
      id: `order:${order.id}`,
      type: "purchases",
      href: `/orders#${encodeURIComponent(order.order_number)}`,
      title: orderTitle(order),
      subtitle: `${fulfillmentLabel(order)} · ${order.status}`,
      meta: `Order ${order.order_number} · ${dateLabel(order.created_at)}`,
      amount: money(order.subtotal_cents + (order.delivery_fee_charged_cents ?? 0)),
      at: order.created_at,
    }));

  const tickets: TimelineItem[] = (ticketsData?.tickets ?? []).map((ticket) => ({
    id: `ticket:${ticket.token}`,
    type: "tickets",
    href: `/tickets/${ticket.token}`,
    title: ticket.event.title,
    subtitle: [ticket.typeName ?? "Admission", ticket.status].join(" · "),
    meta: [ticket.event.date, ticket.event.time, ticket.event.location].filter(Boolean).join(" · ") || ticket.code,
    amount: money(ticket.priceCents),
    at: ticket.event.date ?? "",
  }));

  const memberships: TimelineItem[] = (membershipsData?.memberships ?? []).map((membership) => ({
    id: `membership:${membership.id}`,
    type: "memberships",
    href: "/shopper/memberships",
    title: membership.business_name,
    subtitle: `${membership.plan_name} · ${membership.status}`,
    meta: membership.current_period_end ? `Next date ${dateLabel(membership.current_period_end)}` : "Membership",
    amount: `${money(membership.price_cents)}/${membership.billing_interval === "year" ? "yr" : "mo"}`,
    at: membership.current_period_end ?? "",
  }));

  const all = [...purchases, ...tickets, ...memberships].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  const visible = filter === "all" ? all : all.filter((item) => item.type === filter);
  const loading = ordersLoading || ticketsLoading || membershipsLoading;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8">
      <BackToHome href="/shopper" label="Your space" />

      <div>
        <p className="section-label">Purchase history</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">Orders</h1>
        <p className="mt-1 t-meta text-stone-500">
          Products, memberships and ticket purchases in one place.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          ["all", "All"],
          ["tickets", "Tickets"],
          ["purchases", "Purchases"],
          ["memberships", "Memberships"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value as Filter)}
            className={
              "shrink-0 rounded-full px-4 py-2 t-meta font-semibold transition " +
              (filter === value
                ? "bg-stone-900 text-white"
                : "border border-stone-200 bg-white text-stone-600 hover:border-stone-300")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="t-meta text-stone-400">Loading…</p>}

      {!loading && visible.length === 0 && (
        <div className="card-soft p-6 text-center">
          <WalletCards className="mx-auto h-8 w-8 text-stone-300" />
          <p className="mt-2 text-sm text-stone-600">No {filter === "all" ? "orders" : filter} yet.</p>
          <Link
            href="/?tab=shop"
            className="mt-4 inline-flex rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800"
          >
            Browse shop
          </Link>
        </div>
      )}

      {visible.length > 0 && (
        <div className="space-y-2">
          {visible.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="card-soft card-hover flex items-center gap-3 p-4"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-stone-100 text-stone-600">
                {item.type === "tickets" ? (
                  <Ticket className="h-5 w-5" />
                ) : item.type === "memberships" ? (
                  <BadgeCheck className="h-5 w-5" />
                ) : (
                  <Package className="h-5 w-5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate t-strong text-stone-900">{item.title}</span>
                <span className="block truncate t-meta text-stone-500">{item.subtitle}</span>
                <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-stone-400">
                  <Calendar className="h-3 w-3 shrink-0" />
                  {item.meta}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block t-meta font-semibold text-stone-900">{item.amount}</span>
                <ArrowRight className="ml-auto mt-1 h-4 w-4 text-stone-400" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
