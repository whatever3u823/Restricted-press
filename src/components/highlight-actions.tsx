"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteHighlights } from "@/app/actions";

export function RemoveHighlight({ id }: { id: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="link"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await deleteHighlights([id]);
          router.refresh();
        })
      }
    >
      Remove
    </button>
  );
}
