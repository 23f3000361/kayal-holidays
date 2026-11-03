import Image from "next/image";
import { Logo } from "./header";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden bg-ink lg:block">
        <Image src="/photos/munnar-tea.jpg" alt="" fill sizes="50vw" className="object-cover opacity-90" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <p className="absolute bottom-10 left-10 max-w-sm font-display text-3xl leading-snug text-white">Every trip starts with a conversation.</p>
      </div>
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="font-display text-3xl text-ink">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </main>
  );
}
