import { HeartHandshake } from 'lucide-react';

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
        <HeartHandshake className="h-5 w-5" aria-hidden />
      </span>
      <span className={`text-lg font-bold tracking-tight ${light ? 'text-white' : 'text-primary-800'}`}>
        Seva<span className="text-accent-500">Setu</span>
      </span>
    </span>
  );
}
