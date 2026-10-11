"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./NavLinks.module.css";

const LINKS = [
  // Tickets and reports belong to the board, so it stays highlighted on them.
  { href: "/board", label: "Board", also: ["/drifts", "/report"] },
  { href: "/inspector", label: "Inspector", also: [] as string[] },
];

const isActive = (pathname: string, href: string, also: string[]) =>
  [href, ...also].some((base) => pathname === base || pathname.startsWith(`${base}/`));

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className={styles.nav}>
      {LINKS.map(({ href, label, also }) => (
        <Link
          key={href}
          href={href}
          className={styles.link}
          aria-current={isActive(pathname, href, also) ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
