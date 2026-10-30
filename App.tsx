import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthProvider';
import { useAuth } from '@/contexts/auth-context';
import { LoadingState } from '@/components/ui/LoadingState';
import { Button } from '@/components/ui/Button';
import { navigate, useLocation } from '@/lib/navigation';
import { dashboardPathFor } from '@/lib/routes';
import type { AccountRole } from '@/lib/types';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { AlertTriangle } from 'lucide-react';

const HomePage = lazy(() => import('@/pages/HomePage'));
const ExplorePage = lazy(() => import('@/pages/ExplorePage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const DonorDashboardPage = lazy(() => import('@/pages/DonorDashboardPage'));
const NgoDashboardPage = lazy(() => import('@/pages/NgoDashboardPage'));
const AdminDashboardPage = lazy(() => import('@/pages/AdminDashboardPage'));

function Redirect({ to }: { to: string }) {
  useEffect(() => {
    navigate(to);
  }, [to]);
  return null;
}

function Protected({ roles, children }: { roles?: AccountRole[]; children: ReactNode }) {
  const { session, profile, loading, signOut } = useAuth();
  if (loading) return <LoadingState label="Loading your workspace..." />;
  if (!session) return <Redirect to="/login" />;
  if (!profile) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
        <AlertTriangle className="h-10 w-10 text-warning-600" aria-hidden />
        <h1 className="text-xl font-bold text-neutral-900">We could not load your account</h1>
        <p className="text-sm leading-relaxed text-neutral-600">Check your connection and try again, or sign out and sign back in.</p>
        <Button variant="outline" onClick={() => void signOut()}>Sign out</Button>
      </div>
    );
  }
  if (roles && !roles.includes(profile.role)) return <Redirect to={dashboardPathFor(profile.role)} />;
  return <>{children}</>;
}

function Routes() {
  const { pathname } = useLocation();
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  const renderView = () => {
    switch (path) {
      case '/':
        return <SiteLayout><HomePage /></SiteLayout>;
      case '/explore':
        return <SiteLayout><ExplorePage /></SiteLayout>;
      case '/login':
        return <SiteLayout><LoginPage /></SiteLayout>;
      case '/register':
        return <SiteLayout><RegisterPage /></SiteLayout>;
      case '/notifications':
        return (
          <SiteLayout>
            <Protected>
              <NotificationsPage />
            </Protected>
          </SiteLayout>
        );
      case '/dashboard/donor':
        return (
          <Protected roles={['individual', 'business']}>
            <DonorDashboardPage />
          </Protected>
        );
      case '/dashboard/ngo':
        return (
          <Protected roles={['organization']}>
            <NgoDashboardPage />
          </Protected>
        );
      case '/admin':
        return (
          <Protected roles={['admin']}>
            <AdminDashboardPage />
          </Protected>
        );
      case '/dashboard':
        return (
          <Protected>
            <DashboardRedirect />
          </Protected>
        );
      default:
        return <Redirect to="/" />;
    }
  };

  return (
    <Suspense fallback={<LoadingState label="Loading page..." />}>
      {renderView()}
    </Suspense>
  );
}

function DashboardRedirect() {
  const { profile } = useAuth();
  return profile ? <Redirect to={dashboardPathFor(profile.role)} /> : null;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
