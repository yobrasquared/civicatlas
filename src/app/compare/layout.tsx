import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compare two officials",
  description:
    "Side-by-side legislative records for any two members of Congress: vote agreement from official roll calls, where they split, policy focus, and recent bills.",
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
