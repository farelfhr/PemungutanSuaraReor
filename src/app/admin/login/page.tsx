import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { LoginClient } from "./LoginClient";

export default async function AdminLoginPage() {
  const admin = await getAdminSession();
  if (admin) redirect("/admin");
  return <LoginClient />;
}
