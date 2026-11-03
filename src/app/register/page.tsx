import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/site/auth-shell";
import { RegisterForm } from "../login/login-form";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default function RegisterPage() {
  return (
    <AuthShell title="Create an account" subtitle="Enquiries you send while signed in, and the quotes we send back, will appear in your account.">
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="text-accent hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
