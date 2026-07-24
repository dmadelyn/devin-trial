import type { Metadata } from "next";
import "./globals.css";
import { RoleProvider } from "@/lib/roleContext";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "KYC Review Queue",
  description: "Internal compliance tool for reviewing flagged KYC applications",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <RoleProvider>
          <Header />
          <main className="container">{children}</main>
        </RoleProvider>
      </body>
    </html>
  );
}
