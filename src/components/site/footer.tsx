import Link from "next/link";
import { Logo } from "./header";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-sand/60">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted">Private holidays in Kerala and South India, planned by consultants who live here.</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-medium text-ink">Travel</p>
          <Link className="block text-muted hover:text-ink" href="/packages">All packages</Link>
          <Link className="block text-muted hover:text-ink" href="/destinations/kerala">Kerala</Link>
          <Link className="block text-muted hover:text-ink" href="/destinations/tamil-nadu">Tamil Nadu</Link>
          <Link className="block text-muted hover:text-ink" href="/destinations/karnataka">Karnataka</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-medium text-ink">Talk to us</p>
          <Link className="block text-muted hover:text-ink" href="/enquire">Send an enquiry</Link>
          <p className="text-muted">Replies within one working hour, Mon–Sat, 9 am–7 pm IST</p>
          <p className="text-muted">Kochi, Kerala</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-medium text-ink">About prices</p>
          <p className="text-muted">Prices are per person on twin sharing, in Indian rupees, plus 5% GST.</p>
          <Link className="block text-muted hover:text-ink" href="/privacy">Privacy notice</Link>
          <Link className="block text-muted hover:text-ink" href="/credits">Photo credits</Link>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="container-page py-5 text-xs text-faint">© {new Date().getFullYear()} Kayal Holidays (demo build for Company A). Payments and messages are simulated.</p>
      </div>
    </footer>
  );
}
