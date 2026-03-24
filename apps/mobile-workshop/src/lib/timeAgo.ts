import type { TFunction } from 'i18next';

export function timeAgo(dateStr: string, t: TFunction): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 1) return t('vehicleDetail.timeAgo.now');
  if (diffMins < 60) return t('vehicleDetail.timeAgo.minutes', { count: diffMins });
  if (diffHours < 24) return t('vehicleDetail.timeAgo.hours', { count: diffHours });
  if (diffDays < 7) return t('vehicleDetail.timeAgo.days', { count: diffDays });
  return t('vehicleDetail.timeAgo.weeks', { count: diffWeeks });
}
