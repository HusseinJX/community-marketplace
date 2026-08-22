import { redirect } from "next/navigation";

// /claim/<memberId> is printed on NFC cards, encoded in QR codes, and returned
// by the Canvass app as `claimUrl` — so the URL has to keep working forever.
// What it points AT is now the ordinary join flow.
//
// It used to be a page of its own: its own sign-in, its own verification, its
// own idea of what proves ownership. That is how it ended up offering "paste
// your Google Maps URL or Place ID" — a link printed on the listing itself,
// which proves nothing about who you are — while the real flow next door had
// always required a code texted to the business's own number. Two
// implementations of one thing, and the weaker one was the one on the card.
//
// So there is one flow now. `?claim=` enters it at the same `who` step a fresh
// join reaches after picking its listing out of Google: your name, your role,
// sign in — then the same code, sent to the same number, checked the same way,
// followed by the same links → catalogue → payouts → interview.
export default async function ClaimRedirect({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  redirect(`/join?claim=${encodeURIComponent(memberId)}`);
}
