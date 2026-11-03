"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createPostAction } from "./actions";
import type { ActionResult } from "@/app/admin/actions";
import { Spinner, buttonClass, inputClass, cx } from "@/components/ui";

export function NewPostForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createPostAction, null);
  return (
    <form action={action} className="flex flex-wrap items-start gap-2">
      <div>
        <input name="title" required aria-label="New post title" placeholder="Working title of a new post" className={cx(inputClass, "w-72")} />
        {state && !state.ok && <p role="alert" className="mt-1 text-sm text-danger">{state.error}</p>}
      </div>
      <button className={buttonClass("primary")} disabled={pending}>{pending ? <Spinner /> : <Plus size={16} />} New post</button>
    </form>
  );
}
