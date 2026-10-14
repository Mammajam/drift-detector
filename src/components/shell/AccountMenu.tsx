import Link from "next/link";
import { signOut } from "@/app/actions";
import { getSession, signInEnabled } from "@/server/auth";
import styles from "./AccountMenu.module.css";

export async function AccountMenu() {
  const session = await getSession();

  if (!session) {
    return signInEnabled() ? (
      <div className={styles.account}>
        <Link href="/login" className={styles.link}>
          Sign in
        </Link>
        <Link href="/signup" className={styles.link}>
          Sign up
        </Link>
      </div>
    ) : null;
  }

  return (
    <div className={styles.account}>
      <span className={styles.name}>
        <span className="sr-only">Signed in as </span>
        {session.name}
      </span>
      {/* Locally everything is open, so there is no session to end. */}
      {session.name !== "Local dev" ? (
        <form action={signOut}>
          <button type="submit" className={styles.link}>
            Sign out
          </button>
        </form>
      ) : null}
    </div>
  );
}
