import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import buttons from "@/components/ui/buttons.module.css";

export default function NotFound() {
  return (
    <>
      <PageHeader title="Not found" />
      <EmptyState
        title="We couldn't find that page"
        action={
          <Link href="/board" className={buttons.primary}>
            Back to the board
          </Link>
        }
      >
        <p>The drift, route or report may have been removed, or the link is mistyped.</p>
      </EmptyState>
    </>
  );
}
