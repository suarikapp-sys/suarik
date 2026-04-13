// ─── / (root) ────────────────────────────────────────────────────────────────
// Authenticated users → /dashboard
// Visitors           → Landing page (SEO-friendly, served at canonical URL)

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SitePage from "./site/page";

export { metadata } from "./site/metadata";

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  return <SitePage />;
}
