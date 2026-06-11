"use client";

import { useState } from "react";
import Link from "next/link";
import type { Bill, Member } from "../lib/types";
import { STATUS_META, STEPS, TOPIC_LABELS, fmtDate, stepIndex } from "../lib/status";
import { STATE_NAMES } from "../lib/states";

export function StatusBadge({ bill, size = "sm" }: { bill: Bill; size?: "sm" | "md" }) {
  const meta = STATUS_META[bill.status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
        size === "sm" ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"
      }`}
      style={{ color: meta.color, background: meta.dim, border: `1px solid ${meta.color}33` }}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${bill.status === "law" ? "pulse-dot" : ""}`}
        style={{ background: meta.color }}
      />
      {meta.label}
    </span>
  );
}

export function PartyChip({ party }: { party: string | null }) {
  if (!party) return null;
  const letter = party[0]?.toUpperCase() ?? "?";
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[9px] font-bold text-[#8fa1bb] ring-1 ring-[rgba(148,163,184,0.3)]">
      {letter}
    </span>
  );
}

export function BillRow({ bill, compact = false }: { bill: Bill; compact?: boolean }) {
  return (
    <Link
      href={`/bill/${bill.id}`}
      className="group block rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-[rgba(148,163,184,0.2)] hover:bg-[rgba(148,163,184,0.05)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold tracking-wide text-[#7dd3fc]">{bill.number}</span>
        <StatusBadge bill={bill} />
      </div>
      <div className={`mt-1 text-[13px] leading-snug text-[#dbe5f1] ${compact ? "line-clamp-1" : "line-clamp-2"}`}>
        {bill.title}
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#8fa1bb]">
        {bill.sponsor && (
          <span className="inline-flex items-center gap-1.5">
            <PartyChip party={bill.sponsor.party} />
            {bill.sponsor.name} ({bill.sponsor.state})
          </span>
        )}
        <span className="ml-auto shrink-0">{fmtDate(bill.status_date)}</span>
      </div>
    </Link>
  );
}

export function Avatar({ member, size = 44 }: { member: Member; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#312e81] font-semibold text-[#bcd3ee]"
        style={{ width: size, height: size, fontSize: size * 0.34 }}
      >
        {member.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={member.photo}
      alt={member.name}
      onError={() => setBroken(true)}
      className="shrink-0 rounded-xl object-cover ring-1 ring-[rgba(148,163,184,0.25)]"
      style={{ width: size, height: size }}
    />
  );
}

export function RepCard({ member, billCount }: { member: Member; billCount: number }) {
  return (
    <Link
      href={`/official/${member.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-[rgba(148,163,184,0.12)] bg-[rgba(148,163,184,0.04)] p-3 transition-all hover:border-[rgba(94,234,212,0.35)] hover:bg-[rgba(45,212,191,0.06)]"
    >
      <Avatar member={member} size={48} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-[#e6edf7]">{member.name}</span>
          <PartyChip party={member.party} />
        </div>
        <div className="mt-0.5 truncate text-[11px] text-[#8fa1bb]">
          {member.title} · {STATE_NAMES[member.state] ?? member.state}
          {member.chamber === "House" && member.district != null && member.district > 0 ? ` District ${member.district}` : ""}
        </div>
        <div className="mt-0.5 text-[11px] text-[#5eead4]">
          {billCount} bill{billCount === 1 ? "" : "s"} sponsored in recent window
        </div>
      </div>
      <span className="text-[#475569] transition-transform group-hover:translate-x-0.5 group-hover:text-[#5eead4]">→</span>
    </Link>
  );
}

export function Stepper({ bill }: { bill: Bill }) {
  const idx = stepIndex(bill.status);
  const offTrack = idx === -1;
  const meta = STATUS_META[bill.status];
  return (
    <div>
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const done = !offTrack && i <= idx;
          const current = !offTrack && i === idx;
          return (
            <div key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${current ? "pulse-dot" : ""}`}
                  style={{
                    background: done ? "linear-gradient(135deg,#2dd4bf,#818cf8)" : "rgba(148,163,184,0.12)",
                    color: done ? "#06251f" : "#64748b",
                    border: done ? "none" : "1px solid rgba(148,163,184,0.25)",
                  }}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span className={`mt-1.5 w-16 text-center text-[9px] leading-tight ${done ? "text-[#a7f3d0]" : "text-[#64748b]"}`}>
                  {step}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="mx-1 mb-5 h-px flex-1"
                  style={{ background: !offTrack && i < idx ? "#2dd4bf" : "rgba(148,163,184,0.2)" }}
                />
              )}
            </div>
          );
        })}
      </div>
      {offTrack && (
        <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ color: meta.color, background: meta.dim }}>
          This bill is off the standard track: <strong>{meta.label}</strong> — {bill.status_raw}
        </div>
      )}
    </div>
  );
}

export function TopicTags({ topics }: { topics: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {topics.filter((t) => t !== "other").map((t) => (
        <span key={t} className="rounded-full bg-[rgba(129,140,248,0.12)] px-2 py-0.5 text-[10px] text-[#a5b4fc] ring-1 ring-[rgba(129,140,248,0.25)]">
          {TOPIC_LABELS[t] ?? t}
        </span>
      ))}
    </div>
  );
}

export function SourceChip({ label, kind, href }: { label: string; kind: "official" | "aggregator" | "ai"; href?: string }) {
  const colors = {
    official: { c: "#34d399", bg: "rgba(52,211,153,0.1)" },
    aggregator: { c: "#7dd3fc", bg: "rgba(125,211,252,0.1)" },
    ai: { c: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  }[kind];
  const inner = (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium"
      style={{ color: colors.c, background: colors.bg, border: `1px solid ${colors.c}33` }}
    >
      {kind === "official" ? "🏛" : kind === "aggregator" ? "🔗" : "✨"} {label}
      {href && <span className="opacity-60">↗</span>}
    </span>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-80">
      {inner}
    </a>
  ) : (
    inner
  );
}
