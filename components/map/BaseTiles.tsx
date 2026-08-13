"use client";

import { TileLayer } from "react-leaflet";

// THE basemap. Every Leaflet map in the app renders this and nothing else.
//
// There used to be seven maps and two answers: /browse and Live drew Mapbox
// streets-v12, while the member profile, the event page, /whatson, the events
// map and the vendor location picker drew raw OpenStreetMap. So the same city
// looked like two different products depending on which screen you were on,
// and the five OSM ones were the "ugly maps" — grey-green, heavy road casings,
// dense labels fighting the pins. One component, so that cannot happen again.
//
// Style: mapbox/light-v11. A directory map's content is the PINS; the basemap
// is context and should recede. streets-v12 renders coloured roads, green
// parks and a POI label on every corner, all of which compete with a red dot
// for attention. light-v11 is muted greys and soft water with restrained
// labels, so the pins are the loudest thing on the screen.
//
// @2x tiles at tileSize 512 / zoomOffset -1: that combination is what makes
// labels crisp on a phone. Drop either and Leaflet renders the retina tile at
// the wrong scale, which reads as a blurry map.
const STYLE = "light-v11";

// Falls back to OpenStreetMap when no token is configured. Not a nicety — a
// missing token would otherwise render every map as a grey void, and a map
// that looks dated beats a map that looks broken.
export function BaseTiles() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    return (
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
    );
  }

  return (
    <TileLayer
      attribution='&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
      url={`https://api.mapbox.com/styles/v1/mapbox/${STYLE}/tiles/{z}/{x}/{y}@2x?access_token=${token}`}
      tileSize={512}
      zoomOffset={-1}
    />
  );
}
