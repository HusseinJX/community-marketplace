// "Take me there" — one place that decides which maps app a destination opens in.
//
// Every surface that shows a location (a business profile, an event's When &
// where, a live broadcast) needs the same answer, and getting it wrong is
// invisible until someone is standing outside trying to drive somewhere.

export interface Destination {
  lat?: number | null;
  lng?: number | null;
  /** Street address, when we have one. */
  address?: string | null;
  /** What to call the pin once the maps app opens. */
  label?: string | null;
}

/**
 * iPhone/iPad get Apple Maps, everyone else gets Google Maps.
 *
 * Deliberately NOT "Mac gets Apple Maps": on a desktop the expectation is a
 * map in the browser tab you are already in, not the Maps app taking over the
 * screen. iPadOS reports itself as a Mac, so it is caught by the touch test.
 *
 * SSR returns false — Google Maps is the safe default, since it opens
 * correctly on every platform including iOS.
 */
export function prefersAppleMaps(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ masquerades as Macintosh; a touch point count gives it away.
  return /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Google Maps directions. Works on every platform, including iOS. */
export function googleDirectionsUrl(d: Destination): string | null {
  const t = target(d);
  if (!t) return null;
  const params = new URLSearchParams({ api: "1" });
  params.set("destination", t.destination);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Apple Maps directions, for devices that have it. */
export function appleDirectionsUrl(d: Destination): string | null {
  const t = target(d);
  if (!t) return null;
  const params = new URLSearchParams();
  // daddr is the DESTINATION; Apple fills in "from here" itself. Sending it as
  // `q` would drop someone on a pin with no route.
  params.set("daddr", t.destination);
  if (t.name) params.set("q", t.name);
  return `https://maps.apple.com/?${params.toString()}`;
}

/**
 * Coordinates win over the address when we have them.
 *
 * An address is a string someone typed and a geocoder has to guess at again at
 * the other end — "Suite 200, 123 Main" can land on the wrong block. The pin we
 * already drew on our own map came from a real fix, so send that and keep the
 * address for the label. Returns null when there is nothing to send; callers
 * hide the control rather than opening an empty map.
 */
function target(d: Destination): { destination: string; name: string } | null {
  const hasCoords = typeof d.lat === "number" && typeof d.lng === "number";
  const address = d.address?.trim() || null;
  const name = d.label?.trim() || address || "";
  if (!hasCoords && !address && !name) return null;
  const destination = hasCoords ? `${d.lat},${d.lng}` : (address ?? name);
  return { destination, name };
}
