// Feature flags for surfaces that are built but intentionally parked. Nothing
// here deletes code — flip a flag to true to bring the feature back.
//
// Both of these were turned OFF for the App Store resubmission:
//  - worldCup: Apple 5.2.1 flagged the World Cup / FIFA content as trademarked
//    third-party IP we don't have authorization for. All the city guides, live
//    surfaces, demo data and routes stay in the tree behind this flag.
//  - shorts: the reels/video feed is a later feature; the /shorts page and its
//    nav entry are hidden until it's ready.
export const FEATURES = {
  worldCup: false,
  shorts: false,
} as const;
