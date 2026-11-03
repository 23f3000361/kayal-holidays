import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { AuthShell } from "@/components/site/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(user.role === "traveller" ? "/account" : "/admin");

  return (
    <AuthShell title="Sign in" subtitle="Travellers see their enquiries and quotes. Staff manage packages and the inbox.">
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm text-muted">
        Travelling with us? <Link href="/register" className="text-accent hover:underline">Create an account</Link>
      </p>
    </AuthShell>
  );
}
