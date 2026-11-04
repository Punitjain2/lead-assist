import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Company A | Homes in Ahmedabad",
  description: "Two RERA-registered residential projects in Ahmedabad. Chat with us and book a site visit."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
