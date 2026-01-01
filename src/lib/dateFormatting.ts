import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

/**
 * Safely format a date string or Date object
 * @param dateValue - ISO string, timestamp, or Date object
 * @param formatStr - date-fns format string
 * @param fallback - text to show if date is invalid
 * @returns Formatted date string or fallback
 */
export function safeFormatDate(
  dateValue: string | number | Date | null | undefined,
  formatStr: string = 'd MMM yyyy HH:mm',
  fallback: string = 'N/A'
): string {
  if (!dateValue) return fallback;

  try {
    const date = new Date(dateValue);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return fallback;
    }
    return format(date, formatStr, { locale: nl });
  } catch (error) {
    console.warn(`Failed to format date: ${dateValue}`, error);
    return fallback;
  }
}

/**
 * Common date formats used throughout the app
 */
export const dateFormats = {
  shortDateTime: 'd MMM HH:mm',
  fullDateTime: 'd MMM yyyy HH:mm',
  fullDateTimeWithOm: "d MMMM yyyy 'om' HH:mm",
  dateOnly: 'd MMM yyyy',
  fullDate: 'd MMMM yyyy',
  fullDateOnly: 'PPP',
  fullDateWithTime: 'PPP p',
};
