import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Link } from '@/components/ui/Link';
import { Logo } from '@/components/ui/Logo';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useAuth } from '@/contexts/auth-context';
import { dashboardPathFor } from '@/lib/routes';
import { useLocation } from '@/lib/navigation';

const PUBLIC_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'About Us', to: '/#about' },
  { label: 'Explore Donations', to: '/explore' },
  { label: 'How It Works', to: '/#how-it-works' },
  { label: 'Contact', to: '/#contact' },
];

export function Navbar() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur transition-all duration-300 ${
        scrolled ? 'border-neutral-200 bg-white/95 shadow-sm' : 'border-transparent bg-white/85'
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8" aria-label="Main">
        <Link to="/" className="shrink-0" aria-label="SevaSetu home">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {PUBLIC_LINKS.map((link) => (
            <li key={link.label}>
              <Link
                to={link.to}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-600 transition hover:bg-secondary-100 hover:text-primary-700"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 lg:flex">
          {profile ? (
            <>
              <NotificationBell />
              <Link to={dashboardPathFor(profile.role)}>
                <Button variant="secondary" size="sm">Dashboard</Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => void signOut()}>Sign out</Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">Login</Button>
              </Link>
              <Link to="/register">
                <Button size="sm">Register</Button>
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="rounded-xl p-2 text-neutral-700 transition hover:bg-neutral-100 lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-neutral-200 bg-white px-4 pb-5 pt-3 shadow-lg animate-fade-in lg:hidden">
          <ul className="flex flex-col gap-1">
            {PUBLIC_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  to={link.to}
                  className="block rounded-xl px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-secondary-100 hover:text-primary-700"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {profile ? (
              <>
                <Link to={dashboardPathFor(profile.role)}>
                  <Button variant="secondary" fullWidth>Dashboard</Button>
                </Link>
                <Button variant="outline" fullWidth onClick={() => void signOut()}>Sign out</Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="outline" fullWidth>Login</Button>
                </Link>
                <Link to="/register">
                  <Button fullWidth>Register</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
