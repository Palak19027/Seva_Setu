import { useEffect, useState } from 'react';
import { Award, Star, Trophy, Utensils } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatCard } from '@/components/ui/StatCard';
import { BADGE_META, LEVEL_META } from '@/lib/constants';
import { fetchDonorProfile } from '@/lib/api/impact';
import { errorMessage, formatCount, formatDate } from '@/lib/format';
import type { DonorLevel, DonorProfileData } from '@/lib/types';

const LEVEL_CLASSES: Record<DonorLevel, string> = {
  Bronze: 'bg-warning-100 text-warning-800',
  Silver: 'bg-neutral-200 text-neutral-800',
  Gold: 'bg-accent-100 text-accent-800',
};

const RATING_LABELS: { key: 'food_quality' | 'timely_pickup' | 'overall_experience'; label: string }[] = [
  { key: 'food_quality', label: 'Food quality' },
  { key: 'timely_pickup', label: 'Timely pickup' },
  { key: 'overall_experience', label: 'Overall experience' },
];

export function DonorRewardsSection() {
  const [profile, setProfile] = useState<DonorProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchDonorProfile()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err, 'Your rewards could not be loaded.'));
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!profile) return <LoadingState label="Loading your rewards..." />;

  const level = LEVEL_META[profile.level];
  const averageRating = profile.average_rating !== null ? `${profile.average_rating.toFixed(1)} / 5` : 'No ratings yet';

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">Donor profile</p>
            <h2 className="mt-1 text-2xl font-bold text-neutral-900">{profile.name}</h2>
            <p className="mt-1 text-sm text-neutral-600">{profile.address ? `${profile.address}, ` : ''}{profile.city}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${LEVEL_CLASSES[profile.level]}`}>
            <Trophy className="h-4 w-4" aria-hidden /> {level.label} donor
          </span>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<Utensils className="h-5 w-5" />} label="Meals contributed" value={profile.meals_contributed} />
          <StatCard icon={<Award className="h-5 w-5" />} label="Donation points" value={profile.points} tone="accent" />
          <StatCard icon={<Star className="h-5 w-5" />} label="Completed donations" value={profile.completed_donations} />
          <StatCard icon={<Trophy className="h-5 w-5" />} label="Social impact score" value={profile.social_impact_score} />
        </div>
        <p className="mt-4 text-sm text-neutral-600">
          Total donations posted: <span className="font-semibold text-neutral-800">{formatCount(profile.total_donations)}</span>
          {' · '}Average NGO rating: <span className="font-semibold text-neutral-800">{averageRating}</span>
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-card">
          <h3 className="text-lg font-bold text-neutral-800">Achievement badges</h3>
          {profile.badges.length === 0 ? (
            <EmptyState
              icon={<Award className="h-6 w-6" aria-hidden />}
              title="No badges yet"
              description="Complete your first donation to earn the Verified Social Impact Partner badge."
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {profile.badges.map((badge) => (
                <li key={badge.key} className="rounded-xl border border-secondary-200 bg-secondary-50/60 p-4">
                  <p className="font-bold text-neutral-800">{BADGE_META[badge.key].label}</p>
                  <p className="mt-1 text-sm text-neutral-600">{BADGE_META[badge.key].description}</p>
                  <p className="mt-2 text-xs text-neutral-500">Awarded {formatDate(badge.awarded_at)}</p>
                </li>
              ))}
            </ul>
          )}

          <h3 className="pt-2 text-lg font-bold text-neutral-800">Appreciation certificates</h3>
          {profile.certificates.length === 0 ? (
            <p className="text-sm text-neutral-600">Certificates are issued at donation milestones.</p>
          ) : (
            <ul className="space-y-2">
              {profile.certificates.map((certificate) => (
                <li key={certificate.milestone} className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-sm">
                  <span className="font-semibold text-neutral-800">{certificate.milestone} completed donations</span>
                  <span className="text-neutral-500">Issued {formatDate(certificate.issued_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-card">
          <h3 className="text-lg font-bold text-neutral-800">NGO feedback</h3>
          {profile.feedback.length === 0 ? (
            <EmptyState
              icon={<Star className="h-6 w-6" aria-hidden />}
              title="No feedback yet"
              description="NGOs can rate a donation after it is delivered. Only ratings they choose to give appear here."
            />
          ) : (
            <ul className="space-y-4">
              {profile.feedback.map((item, index) => (
                <li key={`${item.donation_title}-${index}`} className="rounded-xl border border-neutral-200 p-4">
                  <p className="font-semibold text-neutral-800">{item.org_name}</p>
                  <p className="text-xs text-neutral-500">{item.donation_title} · {formatDate(item.created_at)}</p>
                  <dl className="mt-3 flex flex-wrap gap-2 text-xs">
                    {RATING_LABELS.map(({ key, label }) => {
                      const value = key === 'food_quality' ? item.food_quality : key === 'timely_pickup' ? item.timely_pickup : item.overall_experience;
                      if (value === null) return null;
                      return (
                        <div key={key} className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">
                          <dt className="inline">{label}: </dt>
                          <dd className="inline font-bold">{value} / 5</dd>
                        </div>
                      );
                    })}
                  </dl>
                  {item.written_appreciation && (
                    <p className="mt-3 text-sm leading-relaxed text-neutral-700">&ldquo;{item.written_appreciation}&rdquo;</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
