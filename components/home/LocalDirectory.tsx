"use client";

import { useEffect, useMemo, useState } from "react";
import { listMembers } from "@/lib/api";
import type { Member } from "@/lib/types";
import { DEMO_MEMBERS } from "@/lib/demo-members";
import { MemberCard } from "@/components/MemberCard";
import { groupMembers } from "@/lib/browse-groups";

// Lean directory for the single home page: grouped rails of who's local.
// No search / category tabs / map / facets — just find who's local and tap.
export function LocalDirectory() {
  const [members, setMembers] = useState<Member[]>(() => DEMO_MEMBERS);

  useEffect(() => {
    let cancelled = false;
    listMembers({ limit: 100 })
      .then((r) => { if (!cancelled && r.members?.length) setMembers(r.members); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => members.filter((m) => m.profile?.name), [members]);
  const groups = useMemo(() => groupMembers(visible), [visible]);

  return (
    <section className="mx-auto max-w-6xl border-t border-stone-100 px-4 pb-20 pt-8 md:px-8">
      <h2 className="mb-5 text-xl font-semibold tracking-tight text-stone-900">Who&apos;s local</h2>

      {visible.length === 0 ? (
        <p className="text-sm text-stone-400">No one local to show yet.</p>
      ) : (
        <div className="space-y-10">
          {groups.map(({ group, members: gm }) => (
            <Rail key={group.key} label={group.label} emoji={group.emoji} members={gm} />
          ))}
        </div>
      )}
    </section>
  );
}

function Rail({ label, emoji, members }: { label: string; emoji: string; members: Member[] }) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight text-stone-900">
        <span className="text-xl leading-none">{emoji}</span>
        {label}
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">{members.length}</span>
      </h3>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:-mx-8 md:px-8">
        {members.map((m) => (
          <div key={m.id} className="w-60 shrink-0 sm:w-64">
            <MemberCard member={m} />
          </div>
        ))}
      </div>
    </div>
  );
}
