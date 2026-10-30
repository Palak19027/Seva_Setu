import { Activity, BadgeCheck, Bell, CalendarClock, CheckCircle2, Clock, PackageCheck, Trash2, Truck, UserPlus, XCircle, FileText } from 'lucide-react';
import { timeAgo } from '@/lib/format';
import type { AppNotification } from '@/lib/types';

const ICONS: Record<string, typeof Bell> = {
  new_request: Bell,
  request_accepted: CheckCircle2,
  request_rejected: XCircle,
  request_cancelled: XCircle,
  pickup_scheduled: CalendarClock,
  picked_up: PackageCheck,
  delivered: Truck,
  completed: BadgeCheck,
  donation_released: Clock,
  donation_expired: Clock,
  donation_cancelled: XCircle,
  verification_update: BadgeCheck,
  verification_request: FileText,
  new_registration: UserPlus,
  new_donation: Activity,
};

export function NotificationRow({
  item,
  onOpen,
  onDelete,
  compact = false,
}: {
  item: AppNotification;
  onOpen: (item: AppNotification) => void;
  onDelete?: (item: AppNotification) => void;
  compact?: boolean;
}) {
  const Icon = ICONS[item.type] ?? Bell;
  return (
    <li className={`group flex items-start gap-3 px-4 py-3.5 transition hover:bg-neutral-50 ${item.is_read ? '' : 'bg-secondary-50'}`}>
      <button type="button" onClick={() => onOpen(item)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.is_read ? 'bg-neutral-100 text-neutral-500' : 'bg-primary-600 text-white'}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm ${item.is_read ? 'font-semibold text-neutral-700' : 'font-bold text-neutral-900'}`}>{item.title}</span>
          {!compact && <span className="mt-0.5 block text-sm leading-relaxed text-neutral-500">{item.body}</span>}
          <span className="mt-1 block text-xs text-neutral-400">{timeAgo(item.created_at)}</span>
        </span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(item)}
          className="rounded-lg p-1.5 text-neutral-400 opacity-0 transition hover:bg-error-50 hover:text-error-600 focus:opacity-100 group-hover:opacity-100"
          aria-label="Delete notification"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
