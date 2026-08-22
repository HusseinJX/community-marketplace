import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

/**
 * One row in a hub page (Shop, Profile) — and the same row the dashboard used
 * to list everything with.
 *
 * The dashboard is four buttons now; what used to sit under them lives behind
 * whichever of the four it belongs to. This is the shape those lists share, in
 * one place, so a tile on the Shop page and a tile on the Profile page can't
 * drift apart.
 */
export function HubTile({
  href,
  Icon,
  label,
  desc,
}: {
  href: string;
  Icon: LucideIcon;
  label: string;
  desc?: string;
}) {
  return (
    <Link href={href} className="card-soft card-hover flex items-center justify-between p-4">
      <span className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-indigo-500" />
        <span>
          <span className="block text-sm font-semibold text-stone-900">{label}</span>
          {desc && <span className="block text-xs text-stone-500">{desc}</span>}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 text-stone-400" />
    </Link>
  );
}
