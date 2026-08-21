"use client";

import { Globe, Mail, Phone, Store, Ticket, UtensilsCrossed } from "lucide-react";
import { BrandIcon, brandColor, type BrandName } from "@/components/brand/BrandIcons";
import { platformById, type LinkPlatform } from "@/lib/links";

// One brand glyph, whatever its source. Every real mark comes from
// components/brand/BrandIcons; the only lucide icon is the globe for Website,
// which isn't a brand. (LinkedIn lives in BrandIcons too — Simple Icons
// withdrew it on trademark grounds, so it's written out there by hand.)
//
// Every caller draws icons through this, so nothing has to know where a given
// mark came from.
//
// `platform` may be the catalogue entry OR just its id. A SERVER component must
// pass the id: a LinkPlatform carries `href()` and `validate()`, and functions
// can't cross the server/client boundary — passing the whole object throws
// "Functions cannot be passed directly to Client Components" and drops the page
// into client rendering.
export function PlatformIcon({
  platform,
  className = "h-5 w-5",
  brand = false,
}: {
  platform: LinkPlatform | string;
  className?: string;
  /**
   * Draw the mark in the brand's own colour, for a glyph on WHITE. Off by
   * default because the usual home for a mark here is a brand-coloured tile
   * (`plat.tile`), where the glyph is white and colouring it would erase it.
   */
  brand?: boolean;
}) {
  const plat = typeof platform === "string" ? platformById(platform) : platform;
  if (!plat) return <Globe className={className} />;
  const color = brand ? brandColor(plat.icon) : undefined;
  const style = color ? { color } : undefined;
  const lucide = {
    "lucide-globe": Globe,
    "lucide-store": Store,
    "lucide-utensils": UtensilsCrossed,
    "lucide-phone": Phone,
    "lucide-mail": Mail,
    "lucide-ticket": Ticket,
  } as const;
  if (plat.icon in lucide) {
    const Glyph = lucide[plat.icon as keyof typeof lucide];
    return <Glyph className={className} style={style} />;
  }
  return <BrandIcon name={plat.icon as BrandName} className={className} style={style} />;
}
