import type { AccountRole } from '@/lib/types';

export function dashboardPathFor(role: AccountRole): string {
  if (role === 'admin') return '/admin';
  if (role === 'organization') return '/dashboard/ngo';
  return '/dashboard/donor';
}
