import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Twitter } from 'lucide-react';
import { Link } from '@/components/ui/Link';
import { Logo } from '@/components/ui/Logo';
import { SITE } from '@/lib/site';

const SOCIAL_ICONS = [Facebook, Instagram, Twitter, Linkedin];

export function Footer() {
  return (
    <footer id="contact" className="scroll-mt-24 bg-primary-900 text-primary-100">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="space-y-4">
          <Logo light />
          <p className="max-w-xs text-sm leading-relaxed text-primary-200">{SITE.tagline}</p>
          <div className="flex gap-2.5">
            {SITE.socials.map((social, index) => {
              const Icon = SOCIAL_ICONS[index];
              return (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:-translate-y-0.5 hover:bg-accent-400 hover:text-neutral-900"
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </a>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Explore</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/explore" className="transition hover:text-accent-300">Explore donations</Link></li>
            <li><Link to="/register" className="transition hover:text-accent-300">Become a donor</Link></li>
            <li><Link to="/register" className="transition hover:text-accent-300">Register your organization</Link></li>
            <li><Link to="/#how-it-works" className="transition hover:text-accent-300">How it works</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Contact</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex gap-3"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent-300" aria-hidden />{SITE.email}</li>
            <li className="flex gap-3"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-accent-300" aria-hidden />{SITE.phone}</li>
            <li className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-300" aria-hidden />{SITE.address}</li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Stay close</h3>
          <p className="mt-4 text-sm leading-relaxed text-primary-200">
            Get updates on new donation drives, verified partners and the stories of lives touched by your generosity.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-primary-300 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} SevaSetu. All rights reserved.</p>
          <p>Built with care for every giver and every receiver.</p>
        </div>
      </div>
    </footer>
  );
}
