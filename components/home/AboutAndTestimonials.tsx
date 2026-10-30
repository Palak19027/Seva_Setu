import { Quote, ShieldCheck, Sparkles } from 'lucide-react';
import { SITE } from '@/lib/site';

const ABOUT_IMAGE =
  'https://images.pexels.com/photos/6994855/pexels-photo-6994855.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

const TESTIMONIALS = [
  {
    quote: 'We used to store surplus clothes for months. Now they reach families within a week, and our volunteers know exactly when pickup happens.',
    name: 'Meera Iyer',
    role: 'Owner, Saffron Kitchen Restaurant',
  },
  {
    quote: 'As a small orphanage, verification gave our donors confidence. The requests and confirmations keep everything transparent.',
    name: 'Brother Thomas',
    role: 'Director, Hope Children Home',
  },
  {
    quote: 'Donating books from my shelf felt meaningless until I saw the children receiving them. SevaSetu made it simple.',
    name: 'Arjun Mehta',
    role: 'Individual donor',
  },
];

export function AboutSection() {
  return (
    <section id="about" className="scroll-mt-24 bg-neutral-50 py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <img
          src={ABOUT_IMAGE}
          alt="Volunteers organizing donations for people in need"
          width={940}
          height={650}
          loading="lazy"
          decoding="async"
          className="h-[340px] w-full rounded-3xl object-cover shadow-card sm:h-[420px]"
        />
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-primary-600">About SevaSetu</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-neutral-800 sm:text-4xl">{SITE.tagline}</h2>
          <p className="mt-5 leading-relaxed text-neutral-600">
            SevaSetu is a bridge between people who have more than they need and organizations that care for those who have less.
            Every receiving organization is verified by our admin team before it can accept a donation, and food is never
            redistributed after its safe pickup deadline.
          </p>
          <ul className="mt-8 space-y-4">
            <li className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-100 text-primary-600"><ShieldCheck className="h-5 w-5" aria-hidden /></span>
              <div>
                <p className="font-bold text-neutral-800">Verified receivers</p>
                <p className="text-sm text-neutral-600">Documents are checked before organizations can accept donations.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600"><Sparkles className="h-5 w-5" aria-hidden /></span>
              <div>
                <p className="font-bold text-neutral-800">Every stage tracked</p>
                <p className="text-sm text-neutral-600">Donors and receivers see each status change from posting to completion.</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function TestimonialsSection() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-primary-600">Testimonials</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-neutral-800 sm:text-4xl">Voices from our community</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((item) => (
            <figure key={item.name} className="flex flex-col rounded-2xl border border-neutral-200/80 bg-neutral-50 p-7 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift">
              <Quote className="h-8 w-8 text-accent-400" aria-hidden />
              <blockquote className="mt-4 flex-1 leading-relaxed text-neutral-700">&ldquo;{item.quote}&rdquo;</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
                  {item.name.split(' ').map((part) => part[0]).join('')}
                </span>
                <span>
                  <span className="block text-sm font-bold text-neutral-800">{item.name}</span>
                  <span className="block text-xs text-neutral-500">{item.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
