import { redirect } from "next/navigation";

// / → redireciona para o dashboard
export default function RootPage() {
  redirect("/dashboard");
}
