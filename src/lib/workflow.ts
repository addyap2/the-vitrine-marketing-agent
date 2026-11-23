import { nowISO, today } from './dates';
import { STATUS_LABELS } from './labels';
import type { Publication, PubStatus } from './types';

/**
 * Approval workflow. "Programmé" means planned in the calendar: the app never
 * posts anything itself. Publishing is done by a human, then confirmed here.
 */
export interface Transition {
  to: PubStatus;
  label: string;
  /** A comment is mandatory (e.g. requesting changes). */
  needsComment?: boolean;
  /** A scheduled date is mandatory. */
  needsDate?: boolean;
  tone: 'primary' | 'neutral' | 'danger';
}

export const TRANSITIONS: Record<PubStatus, Transition[]> = {
  idee: [
    { to: 'brouillon', label: 'Commencer la rédaction', tone: 'primary' },
    { to: 'archive', label: 'Archiver', tone: 'neutral' },
  ],
  brouillon: [
    { to: 'relecture', label: 'Envoyer en relecture', tone: 'primary' },
    { to: 'idee', label: 'Repasser en idée', tone: 'neutral' },
    { to: 'archive', label: 'Archiver', tone: 'neutral' },
  ],
  relecture: [
    { to: 'approuve', label: 'Approuver', tone: 'primary' },
    { to: 'corrections', label: 'Demander des corrections', needsComment: true, tone: 'danger' },
    { to: 'brouillon', label: 'Retirer de la relecture', tone: 'neutral' },
  ],
  corrections: [
    { to: 'relecture', label: 'Renvoyer en relecture', tone: 'primary' },
    { to: 'brouillon', label: 'Repasser en brouillon', tone: 'neutral' },
  ],
  approuve: [
    { to: 'programme', label: 'Programmer', needsDate: true, tone: 'primary' },
    { to: 'publie', label: 'Marquer comme publié', tone: 'neutral' },
    { to: 'brouillon', label: 'Rouvrir pour modification', tone: 'neutral' },
  ],
  programme: [
    { to: 'publie', label: 'Marquer comme publié', tone: 'primary' },
    { to: 'approuve', label: 'Déprogrammer', tone: 'neutral' },
  ],
  publie: [
    { to: 'archive', label: 'Archiver', tone: 'neutral' },
    { to: 'programme', label: 'Annuler « publié »', tone: 'neutral' },
  ],
  archive: [{ to: 'brouillon', label: 'Restaurer en brouillon', tone: 'neutral' }],
};

export function canTransition(from: PubStatus, to: PubStatus): boolean {
  return TRANSITIONS[from].some((t) => t.to === to);
}

export interface TransitionInput {
  comment?: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  publishedUrl?: string;
  publishedAt?: string;
}

export class WorkflowError extends Error {}

export function applyTransition(pub: Publication, to: PubStatus, input: TransitionInput = {}, at = nowISO()): Publication {
  const t = TRANSITIONS[pub.status].find((x) => x.to === to);
  if (!t) throw new WorkflowError(`Passage de « ${STATUS_LABELS[pub.status]} » à « ${STATUS_LABELS[to]} » impossible.`);
  const comment = input.comment?.trim();
  if (t.needsComment && !comment) throw new WorkflowError('Indiquez ce qui doit être corrigé.');
  const next: Publication = { ...pub, status: to, updatedAt: at };
  if (input.scheduledDate !== undefined) next.scheduledDate = input.scheduledDate;
  if (input.scheduledTime !== undefined) next.scheduledTime = input.scheduledTime;
  if (t.needsDate && !next.scheduledDate) throw new WorkflowError('Choisissez une date de publication.');
  if (to === 'approuve' || to === 'relecture') {
    if (!pub.body.trim() && !pub.hook.trim() && !pub.visualBrief.trim()) {
      throw new WorkflowError('Le contenu est vide : rédigez la publication avant de la faire valider.');
    }
  }
  if (to === 'publie') {
    next.publishedAt = input.publishedAt || next.scheduledDate || today();
    if (input.publishedUrl !== undefined) next.publishedUrl = input.publishedUrl.trim();
  }
  if (pub.status === 'publie' && to !== 'publie' && to !== 'archive') {
    next.publishedAt = null;
  }
  next.history = [...pub.history, { at, action: 'statut', from: pub.status, to, ...(comment ? { comment } : {}) }];
  return next;
}

const CONTENT_FIELDS = ['hook', 'body', 'cta', 'hashtags'] as const;

export function contentChanged(a: Publication, b: Publication): boolean {
  return CONTENT_FIELDS.some((f) => a[f] !== b[f]);
}

/**
 * Saves an edit. Changing the wording of an approved or scheduled publication
 * sends it back to review, so nothing unreviewed goes out. Keeps the previous
 * wording as a version (max 20).
 */
export function applyEdit(before: Publication, after: Publication, at = nowISO()): Publication {
  const changed = contentChanged(before, after);
  // Status, history and versions only change through the workflow, never through a plain edit
  // (protects against saving a stale copy of the publication).
  let next: Publication = {
    ...after,
    id: before.id,
    status: before.status,
    history: before.history,
    versions: before.versions,
    createdAt: before.createdAt,
    updatedAt: at,
  };
  if (changed && before.body + before.hook + before.cta + before.hashtags) {
    next.versions = [
      { at: before.updatedAt, hook: before.hook, body: before.body, cta: before.cta, hashtags: before.hashtags },
      ...before.versions,
    ].slice(0, 20);
  }
  if (changed && (before.status === 'approuve' || before.status === 'programme')) {
    next = {
      ...next,
      status: 'relecture',
      history: [
        ...before.history,
        { at, action: 'statut', from: before.status, to: 'relecture', comment: 'Texte modifié après approbation : nouvelle relecture nécessaire.' },
      ],
    };
  } else if (changed) {
    next.history = [...before.history, { at, action: 'modification' as const }].slice(-500);
  }
  return next;
}

export const BOARD_COLUMNS: PubStatus[] = ['idee', 'brouillon', 'relecture', 'corrections', 'approuve', 'programme', 'publie'];

export function isOverdue(pub: Publication, ref = today()): boolean {
  return !!pub.scheduledDate && pub.scheduledDate < ref && !['publie', 'archive'].includes(pub.status);
}
