// Turn a pasted livestream URL into an embeddable iframe src. Returns null for
// anything we can't safely embed (the caller then just shows a link out).
// `host` is the current hostname (Twitch requires a `parent` param).

export interface StreamEmbed {
  type: "youtube" | "twitch";
  src: string;
}

export function streamEmbed(url: string | null | undefined, host?: string): StreamEmbed | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const h = u.hostname.replace(/^www\./, "");

  // YouTube
  if (h === "youtube.com" || h === "m.youtube.com") {
    const v = u.searchParams.get("v");
    if (v) return { type: "youtube", src: `https://www.youtube.com/embed/${v}` };
    // /live/<id> or /embed/<id>
    const m = u.pathname.match(/\/(?:live|embed)\/([\w-]+)/);
    if (m) return { type: "youtube", src: `https://www.youtube.com/embed/${m[1]}` };
  }
  if (h === "youtu.be") {
    const id = u.pathname.slice(1);
    if (id) return { type: "youtube", src: `https://www.youtube.com/embed/${id}` };
  }

  // Twitch — needs a parent param matching the embedding host.
  if (h === "twitch.tv") {
    const channel = u.pathname.split("/").filter(Boolean)[0];
    const parent = host || "localhost";
    if (channel) {
      return { type: "twitch", src: `https://player.twitch.tv/?channel=${channel}&parent=${parent}` };
    }
  }

  return null;
}
