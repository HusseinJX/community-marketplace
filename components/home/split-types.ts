/**
 * The one shape the expanded-category split view understands.
 *
 * Shops and Events both expand into a list beside a map, and they were about
 * to become two copies of the same 300 lines differing only in which object
 * they read `lat` off. Everything downstream — the map, the pins, the mobile
 * sheet, the hover pairing — works on this, and each surface supplies an
 * adapter from its own row type.
 */
export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  /** Drawn inside the pin. One glyph; see the category readers per surface. */
  emoji: string;
  /** Native tooltip on the pin. The card carries the readable version. */
  title: string;
};
