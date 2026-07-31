import { redirect } from "next/navigation";

// Ideas moved into Journal (Journal → Ideas tab). Keep the old route working —
// bookmarks, ⌘K search hits, and the dashboard "Note" action land in the right
// place. The `ideas` table and all captured notes are unchanged.
export default function IdeasRedirect() {
  redirect("/journal?tab=ideas");
}
