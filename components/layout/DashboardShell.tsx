import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LogOut } from 'lucide-react';
import { Link } from '@/components/ui/Link';
import { Logo } from '@/components/ui/Logo';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useAuth } from '@/contexts/auth-context';

export interface DashboardNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function DashboardShell({
  title,
  subtitle,
  navItems,
  activeKey,
  onSelect,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  navItems: DashboardNavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" aria-label="SevaSetu home"><Logo /></Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <NotificationBell />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold text-neutral-900">{profile?.full_name}</p>
              <p className="text-xs text-neutral-500">{profile?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-xl p-2.5 text-neutral-600 transition hover:bg-neutral-100 hover:text-error-600"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-60 shrink-0 lg:block">
          <nav className="sticky top-24 space-y-1.5 rounded-2xl border border-neutral-200 bg-white p-3 shadow-card" aria-label="Dashboard sections">
            {navItems.map((item) => (
              <NavButton key={item.key} item={item} active={item.key === activeKey} onSelect={onSelect} />
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">{title}</h1>
              <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
            </div>
            {action}
          </div>

          <nav className="mb-5 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden" aria-label="Dashboard sections">
            {navItems.map((item) => (
              <div key={item.key} className="shrink-0">
                <NavButton item={item} active={item.key === activeKey} onSelect={onSelect} compact />
              </div>
            ))}
          </nav>

          <div className="animate-fade-up">{children}</div>
        </div>
      </div>
    </div>
  );
}

function NavButton({
  item,
  active,
  onSelect,
  compact = false,
}: {
  item: DashboardNavItem;
  active: boolean;
  onSelect: (key: string) => void;
  compact?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.key)}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-xl text-sm font-semibold transition duration-200 ${
        compact ? 'px-3.5 py-2' : 'w-full px-3.5 py-2.5'
      } ${
        active
          ? 'bg-primary-600 text-white shadow-sm'
          : 'text-neutral-600 hover:bg-secondary-100 hover:text-primary-700'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1 whitespace-nowrap text-left">{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${active ? 'bg-white/20 text-white' : 'bg-accent-100 text-accent-700'}`}>
          {item.badge}
        </span>
      )}
    </button>
  );
}
