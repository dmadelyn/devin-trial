"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole } from "@/lib/roleContext";

export default function Header() {
  const { role, actorName, setRole } = useRole();
  const pathname = usePathname();

  return (
    <header className="header">
      <div className="header-inner">
        <span className="brand">KYC Review Queue</span>
        <nav className="nav">
          <Link href="/" className={pathname === "/" ? "active" : ""}>
            Queue
          </Link>
          <Link href="/audit" className={pathname === "/audit" ? "active" : ""}>
            Audit Log
          </Link>
        </nav>
        <div className="role-toggle">
          <span className="actor">{actorName}</span>
          <div className="seg" role="group" aria-label="Active role">
            <button
              className={role === "reviewer" ? "on" : ""}
              onClick={() => setRole("reviewer")}
            >
              Reviewer
            </button>
            <button
              className={role === "viewer" ? "on" : ""}
              onClick={() => setRole("viewer")}
            >
              Viewer
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
