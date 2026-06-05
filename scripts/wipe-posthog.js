// Bulk-delete every person (and their events) in a PostHog project.
// Use this to clean up test data before launch.
//
// Requires:
//   POSTHOG_PERSONAL_API_KEY=phx_...      (Personal API key with `person:write` scope)
//   POSTHOG_PROJECT_ID=12345              (numeric project id from the PostHog URL)
//   POSTHOG_HOST=https://us.i.posthog.com (optional; defaults to US cloud)
//
// Run: node --env-file=.env.local scripts/wipe-posthog.js
//      (or export the vars in your shell first)

const HOST = process.env.POSTHOG_HOST || "https://us.i.posthog.com";
const KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID;

if (!KEY || !PROJECT_ID) {
  console.error("Missing POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function listPersonIds() {
  const ids = [];
  let url = `${HOST}/api/projects/${PROJECT_ID}/persons/?limit=100`;
  let page = 0;
  while (url) {
    page++;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`List persons failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    for (const p of data.results || []) ids.push(p.id);
    process.stdout.write(`  page ${page}: +${data.results?.length ?? 0} (total ${ids.length})\r`);
    url = data.next;
  }
  console.log(`\n  done listing: ${ids.length} persons`);
  return ids;
}

async function bulkDelete(ids) {
  // Endpoint accepts up to ~1000 ids per call — chunk to be safe.
  const CHUNK = 500;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const res = await fetch(
      `${HOST}/api/projects/${PROJECT_ID}/persons/bulk_delete/`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ ids: slice, delete_events: true }),
      }
    );
    if (!res.ok) {
      throw new Error(`Bulk delete failed: ${res.status} ${await res.text()}`);
    }
    console.log(`  deleted batch ${i / CHUNK + 1} (${slice.length} persons)`);
  }
}

(async () => {
  console.log(`Listing persons in project ${PROJECT_ID} on ${HOST} …`);
  const ids = await listPersonIds();
  if (!ids.length) {
    console.log("Nothing to delete.");
    return;
  }
  console.log(`Deleting ${ids.length} persons (and their events) …`);
  await bulkDelete(ids);
  console.log("Done. Event deletion runs async on PostHog's side — give it ~5-10 min to fully disappear.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
