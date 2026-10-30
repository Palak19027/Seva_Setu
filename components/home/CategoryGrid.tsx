import { ArrowRight } from 'lucide-react';
import { CATEGORY_ICONS } from '@/components/donations/category-icons';
import { Link } from '@/components/ui/Link';
import { CATEGORIES } from '@/lib/constants';

export function CategoryGrid() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-bold uppercase tracking-wider text-primary-600">Donate what you can</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-neutral-800 sm:text-4xl">
          Every useful item finds a purpose
        </h2>
        <p className="mt-4 text-neutral-600">From a warm blanket to a shelf of books, nothing useful needs to go to waste.</p>
      </div>
      <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category.value];
          return (
            <Link
              key={category.value}
              to={`/explore?category=${category.value}`}
              className="group flex flex-col items-start gap-4 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-lift"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-100 text-primary-600 transition group-hover:bg-primary-600 group-hover:text-white">
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <span className="flex w-full items-center justify-between text-sm font-bold text-neutral-800">
                {category.label}
                <ArrowRight className="h-4 w-4 -translate-x-1 text-primary-600 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
