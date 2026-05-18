import type { MemberType } from "@/lib/types";

const STYLES: Record<MemberType, string> = {
  vendor: "bg-blue-100 text-blue-700",
  artist: "bg-violet-100 text-violet-700",
  organizer: "bg-emerald-100 text-emerald-700",
  shopper: "bg-orange-100 text-orange-700",
  influencer: "bg-pink-100 text-pink-700",
};

const LABEL: Record<MemberType, string> = {
  vendor: "Vendor",
  artist: "Artist",
  organizer: "Community",
  shopper: "Shopper",
  influencer: "Influencer",
};

export function MemberTypeBadge({ type }: { type?: string }) {
  if (!type) return null;
  const key = type.toLowerCase() as MemberType;
  const style = STYLES[key] ?? "bg-stone-100 text-stone-700";
  const label = LABEL[key] ?? type;

  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
