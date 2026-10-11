"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./NavLinks.module.css";

const LINKS = [
  { href: "/", label: "Board" },
  { href: "/inspector", label: "Inspector" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className={styles.nav}>
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={styles.link}
          aria-current={pathname === href ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
