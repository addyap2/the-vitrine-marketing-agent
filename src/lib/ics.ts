import { addDays } from './dates';
import { CHANNEL_LABELS, FORMAT_LABELS, STATUS_LABELS } from './labels';
import type { Campaign, Publication } from './types';

/** iCalendar export so planned publications show up as reminders in Google Calendar, Apple Calendar or Outlook. */

export function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds lines longer than 75 octets (RFC 5545 §3.1). */
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    if (size + len > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += len;
  }
  out.push(current);
  return out.join('\r\n ');
}

const compact = (d: string) => d.replace(/-/g, '');

function stamp(d = new Date()): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildICS(pubs: Publication[], campaigns: Campaign[], now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Vitrine//Marketing Agent//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:The Vitrine — publications',
  ];
  for (const p of pubs) {
    if (!p.scheduledDate || p.status === 'archive') continue;
    const campaign = campaigns.find((c) => c.id === p.campaignId);
    const desc = [
      `${CHANNEL_LABELS[p.channel]} · ${FORMAT_LABELS[p.format]} · ${STATUS_LABELS[p.status]}`,
      campaign ? `Campagne : ${campaign.name}` : '',
      '',
      p.hook,
      p.body.slice(0, 1500),
      p.cta,
      p.hashtags,
      '',
      'Rappel : publication manuelle. L’application ne publie rien automatiquement.',
    ]
      .filter((x, i, a) => x || (i > 0 && a[i - 1]))
      .join('\n');
    lines.push('BEGIN:VEVENT', `UID:${p.id}@vitrine-marketing`, `DTSTAMP:${stamp(now)}`);
    if (p.scheduledTime) {
      const start = `${compact(p.scheduledDate)}T${p.scheduledTime.replace(':', '')}00`;
      const [h, m] = p.scheduledTime.split(':').map(Number);
      const endMinutes = h * 60 + m + 30;
      const endDate = endMinutes >= 1440 ? addDays(p.scheduledDate, 1) : p.scheduledDate;
      const em = endMinutes % 1440;
      const end = `${compact(endDate)}T${String(Math.floor(em / 60)).padStart(2, '0')}${String(em % 60).padStart(2, '0')}00`;
      lines.push(`DTSTART;TZID=Europe/Paris:${start}`, `DTEND;TZID=Europe/Paris:${end}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(p.scheduledDate)}`, `DTEND;VALUE=DATE:${compact(addDays(p.scheduledDate, 1))}`);
    }
    lines.push(
      `SUMMARY:${icsEscape(`[${CHANNEL_LABELS[p.channel]}] ${p.title}`)}`,
      `DESCRIPTION:${icsEscape(desc)}`,
      `STATUS:${p.status === 'publie' ? 'CONFIRMED' : 'TENTATIVE'}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(`À publier : ${p.title}`)}`,
      p.scheduledTime ? 'TRIGGER:-PT30M' : 'TRIGGER:PT9H',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
