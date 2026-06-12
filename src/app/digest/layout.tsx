import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your civic digest",
  description:
    "What the bills and representatives you follow have been doing — votes, sponsored legislation, and new laws. Follows are saved only on your device.",
};

export default function DigestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
