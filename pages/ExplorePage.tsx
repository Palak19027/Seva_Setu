import { useMemo } from 'react';
import { Link } from '@/components/ui/Link';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { DonationBrowser } from '@/components/donations/DonationBrowser';
import { useAuth } from '@/contexts/auth-context';

export default function ExplorePage() {
  const { session, profile, organization } = useAuth();
  const initialCategory = useMemo(() => new URLSearchParams(window.location.search).get('category') ?? '', []);
  const isVerifiedOrg = profile?.role === 'organization' && organization?.verification_status === 'verified';

  let requestNotice = null;
  if (!session) {
    requestNotice = (
      <Alert tone="info">
        <span className="flex flex-wrap items-center gap-3">
          Log in as a verified receiving organization to request donations.
          <Link to="/login"><Button size="sm" variant="outline">Log in</Button></Link>
        </span>
      </Alert>
    );
  } else if (profile?.role === 'organization' && !isVerifiedOrg) {
    requestNotice = (
      <Alert tone="warning">
        Your organization is not verified yet, so you cannot request donations. You can check the verification status on your dashboard.
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-wider text-primary-600">Explore donations</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-neutral-800 sm:text-4xl">Find something that can make a difference</h1>
        <p className="mt-3 text-neutral-600">Browse what donors have posted near you. Pickup addresses are shared only with verified organizations that request an item.</p>
      </div>
      <div className="mt-10">
        <DonationBrowser
          orgId={isVerifiedOrg ? profile?.id : undefined}
          canRequest={isVerifiedOrg}
          initialCategory={initialCategory}
          requestNotice={requestNotice}
        />
      </div>
    </div>
  );
}
