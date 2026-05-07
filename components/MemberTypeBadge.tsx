import type { MemberType } from "@/lib/types";

const STYLES: Record<MemberType, string> = {
  vendor: "bg-blue-100 text-blue-800 ring-blue-200",
  artist: "bg-purple-100 text-purple-800 ring-purple-200",
  organizer: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  shopper: "bg-orange-100 text-orange-800 ring-orange-200",
  influencer: "bg-pink-100 text-pink-800 ring-pink-200",
};

const LABEL: Record<MemberType, string> = {
  vendor: "Vendor",
  artist: "Artist",
  organizer: "Organizer",
  shopper: "Shopper",
  influencer: "Influencer",
};

export function MemberTypeBadge({ type, size = "sm" }: { type?: string; size?: "sm" | "md" }) {
  if (!type) return null;
  const key = type.toLowerCase() as MemberType;
  const style = STYLES[key] ?? "bg-stone-100 text-stone-800 ring-stone-200";
  const label = LABEL[key] ?? type;
  const sizeClass = size === "md" ? "text-sm px-3 py-1" : "text-xs px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center rounded-full ring-1 ring-inset font-medium ${style} ${sizeClass}`}
    >
      {label}
    </span>
  );
}
