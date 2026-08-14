/**
 * The short name of a venue — everything before the first comma or dash.
 *
 * Scraped venue strings are whatever the source calendar typed, and they mix
 * three things that aren't the same:
 *
 *   "Main Library - Latino/Hispanic Meeting Room A"   place + room
 *   "Goethe-Institut San Francisco, 657 Howard St"     place + address
 *   "SF Public Library, Main Library, Latino Room"     place + building + room
 *
 * As a LABEL that's just long. As a FILTER KEY it's worse: two events in
 * different rooms of the same library are two different venues, so filtering
 * by one silently hides the other. Cutting at the first separator makes both
 * problems go away at once, which is why the same function has to run on the
 * client (to draw the chip) and on the server (to match on it).
 *
 * ── The dash rule ────────────────────────────────────────────────────────────
 * Splits on a SPACED dash only. A bare "-" would cut "Goethe-Institut San
 * Francisco" down to "Goethe", and hyphenated place names are common enough
 * that this is not an edge case. Commas need no such care — nobody writes one
 * inside a name.
 *
 * Falls back to the original whenever the cut leaves too little to identify
 * anything, so a venue called "Q, The Bar" doesn't become "Q".
 */
export function venueLabel(venue: string | null | undefined): string | null {
  if (!venue) return null;
  const full = venue.trim();
  if (!full) return null;

  // Both separators considered; whichever comes first wins.
  const comma = full.indexOf(",");
  const dash = full.search(/\s[-–—]\s/);
  const candidates = [comma, dash].filter((i) => i > 0);
  if (candidates.length === 0) return full;

  const cut = full.slice(0, Math.min(...candidates)).trim();
  return cut.length >= 3 ? cut : full;
}
