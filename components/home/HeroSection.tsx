import { ArrowRight, HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Link } from '@/components/ui/Link';

const HERO_IMAGE =
  'https://images.pexels.com/photos/6647178/pexels-photo-6647178.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-secondary-100 via-neutral-50 to-neutral-50">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:px-8">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-primary-700 shadow-sm ring-1 ring-primary-100">
            <HeartHandshake className="h-4 w-4 text-accent-500" aria-hidden />
            A Bridge of Giving, A World of Caring.
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.15] tracking-tight text-neutral-800 sm:text-5xl lg:text-6xl">
            Small Acts of Giving, <span className="text-primary-600">Big Changes in Lives.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
            SevaSetu connects individuals and businesses with NGOs, orphanages, ashrams and old-age homes. Share
            clothes, books, food and essentials that still have value, and see them reach the people who need them.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/register">
              <Button size="lg" fullWidth className="sm:w-auto" icon={<ArrowRight className="h-5 w-5" />}>
                Start Donating
              </Button>
            </Link>
            <Link to="/explore">
              <Button variant="outline" size="lg" fullWidth className="sm:w-auto">
                Find Donations
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative animate-fade-in">
          <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-secondary-200/70 blur-2xl" aria-hidden />
          <img
            src={HERO_IMAGE}
            alt="Volunteers sharing food and essentials with the community"
            width={940}
            height={650}
            fetchPriority="high"
            decoding="async"
            className="h-[360px] w-full rounded-[2rem] object-cover shadow-lift sm:h-[460px]"
          />
          <div className="absolute -bottom-6 left-4 flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-lift ring-1 ring-neutral-100 sm:left-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <HeartHandshake className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-bold text-neutral-800">Verified partners only</p>
              <p className="text-xs text-neutral-500">Every receiving organization is reviewed by our team</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
