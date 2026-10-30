import { CalendarClock, CheckCircle2, ClipboardList, Handshake, UserPlus } from 'lucide-react';

const STEPS = [
  { title: 'Register', text: 'Sign up as a donor or a verified receiving organization.', icon: UserPlus },
  { title: 'Post a Donation', text: 'Describe the items, add photos and say when they can be collected.', icon: ClipboardList },
  { title: 'NGO Accepts', text: 'A verified organization requests the donation and you approve it.', icon: Handshake },
  { title: 'Pickup and Delivery', text: 'A pickup is scheduled, collected and delivered with confirmations.', icon: CalendarClock },
  { title: 'Successful Donation', text: 'The donation is closed and its impact is recorded on the platform.', icon: CheckCircle2 },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-primary-600">How it works</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-neutral-800 sm:text-4xl">From your home to someone in need</h2>
        </div>
        <ol className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative rounded-2xl border border-neutral-200/80 bg-neutral-50 p-6 transition duration-300 hover:-translate-y-1 hover:shadow-card">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white">
                  <step.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-sm font-bold text-accent-500">0{index + 1}</span>
              </div>
              <h3 className="mt-5 text-base font-bold text-neutral-800">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
