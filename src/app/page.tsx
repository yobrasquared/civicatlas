"use client";

import dynamic from "next/dynamic";

const Atlas = dynamic(() => import("../components/Atlas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-[#060a13]">
      <div className="text-center">
        <div className="text-2xl font-semibold tracking-tight">
          Civic<span className="brand-gradient">Atlas</span>
        </div>
        <div className="mt-2 text-sm text-[#8fa1bb]">Loading the map of your government…</div>
      </div>
    </div>
  ),
});

export default function Home() {
  return <Atlas />;
}
