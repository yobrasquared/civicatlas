"use client";

import { toggleFollow, useFollows, type Follows } from "../lib/follows";

export default function FollowButton({
  kind,
  id,
  label,
  size = "md",
}: {
  kind: keyof Follows;
  id: string;
  /** what is being followed, e.g. "this bill" / "Rep. Lieu" */
  label: string;
  size?: "sm" | "md";
}) {
  const follows = useFollows();
  const active = follows[kind].includes(id);
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFollow(kind, id);
      }}
      title={active ? `Unfollow ${label}` : `Follow ${label} — saved only on this device`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl font-semibold transition-all ${
        size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3.5 py-2 text-[12px]"
      } ${
        active
          ? "bg-gradient-to-r from-[#2dd4bf] to-[#5eead4] text-[#052e2b]"
          : "bg-[rgba(45,212,191,0.08)] text-[#5eead4] ring-1 ring-[rgba(45,212,191,0.3)] hover:bg-[rgba(45,212,191,0.15)]"
      }`}
    >
      {active ? "★ Following" : "☆ Follow"}
    </button>
  );
}
