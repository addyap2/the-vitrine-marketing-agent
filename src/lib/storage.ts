import { STORAGE_KEY, emptyState } from './defaults';
import { migrateV2, withBuiltins } from './backup';
import { validateState } from './schema';
import type { AppState } from './types';

export const SNAPSHOT_KEY = 'vitrine-marketing:snapshots';
const LEGACY_DRAFTS = 'vitrine-drafts-v1';
const LEGACY_CAMPAIGNS = 'vitrine-campaigns-v1';
const MAX_SNAPSHOTS = 3;
const MAX_SNAPSHOT_CHARS = 1_000_000;
/** Most browsers allow about 5 million characters per site in localStorage. */
export const STORAGE_BUDGET_CHARS = 5_000_000;

export interface LoadResult {
  state: AppState;
  notice: string | null;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export interface Snapshot {
  at: string;
  reason: string;
  data: string;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageAvailable(): boolean {
  try {
    const k = '__vitrine_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function loadState(): LoadResult {
  const raw = safeGet(STORAGE_KEY);
  if (raw) {
    try {
      return { state: withBuiltins(validateState(JSON.parse(raw))), notice: null };
    } catch (e) {
      // Keep the unreadable copy so nothing is silently destroyed.
      try {
        localStorage.setItem(`vitrine-marketing:illisible-${Date.now()}`, raw);
      } catch {
        /* storage full: nothing more we can do */
      }
      const snap = listSnapshots()[0];
      if (snap) {
        try {
          return {
            state: withBuiltins(validateState(JSON.parse(snap.data))),
            notice: `Les données enregistrées étaient illisibles (${(e as Error).message}). Le point de restauration du ${new Date(snap.at).toLocaleString('fr-FR')} a été rechargé.`,
          };
        } catch {
          /* fall through */
        }
      }
      return {
        state: emptyState(),
        notice: `Les données enregistrées étaient illisibles et ont été mises de côté (${(e as Error).message}). Restaurez une sauvegarde JSON depuis « Données ».`,
      };
    }
  }
  const legacyDrafts = safeGet(LEGACY_DRAFTS);
  const legacyCampaigns = safeGet(LEGACY_CAMPAIGNS);
  if (legacyDrafts || legacyCampaigns) {
    try {
      const drafts = legacyDrafts ? JSON.parse(legacyDrafts) : [];
      const campaigns = legacyCampaigns ? JSON.parse(legacyCampaigns) : [];
      const state = migrateV2(Array.isArray(drafts) ? drafts : [], Array.isArray(campaigns) ? campaigns : []);
      return { state, notice: 'Vos brouillons et campagnes de l’ancienne version ont été importés.' };
    } catch {
      /* ignore and start fresh */
    }
  }
  return { state: emptyState(), notice: null };
}

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014)
  );
}

export function saveState(state: AppState): SaveResult {
  const json = JSON.stringify(state);
  try {
    localStorage.setItem(STORAGE_KEY, json);
    return { ok: true };
  } catch (e) {
    if (isQuotaError(e)) {
      // Free space by dropping restore points, then retry once.
      try {
        localStorage.removeItem(SNAPSHOT_KEY);
        localStorage.setItem(STORAGE_KEY, json);
        return { ok: true, error: 'Stockage presque plein : les points de restauration automatiques ont été supprimés. Exportez une sauvegarde.' };
      } catch {
        return { ok: false, error: 'Stockage du navigateur plein : la dernière modification n’a pas pu être enregistrée. Exportez une sauvegarde JSON puis supprimez des éléments anciens.' };
      }
    }
    return { ok: false, error: 'Le navigateur refuse l’enregistrement local (navigation privée ou stockage désactivé). Exportez une sauvegarde JSON pour ne rien perdre.' };
  }
}

export function listSnapshots(): Snapshot[] {
  const raw = safeGet(SNAPSHOT_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list)
      ? list.filter((s): s is Snapshot => s && typeof s.at === 'string' && typeof s.data === 'string')
      : [];
  } catch {
    return [];
  }
}

/** Stores a restore point (newest first). Silently skipped if too large or storage is full. */
export function createSnapshot(state: AppState, reason: string): boolean {
  const data = JSON.stringify(state);
  if (data.length > MAX_SNAPSHOT_CHARS) return false;
  const list = [{ at: new Date().toISOString(), reason, data }, ...listSnapshots()].slice(0, MAX_SNAPSHOTS);
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** One automatic restore point per day, taken the first time the app opens that day. */
export function dailySnapshot(state: AppState): void {
  const latest = listSnapshots()[0];
  const day = new Date().toISOString().slice(0, 10);
  if (latest && latest.at.slice(0, 10) === day) return;
  if (!state.meta.lastChangeAt) return;
  createSnapshot(state, 'Point quotidien automatique');
}

export function storageUsage(): { used: number; budget: number; ratio: number } {
  let used = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('vitrine')) used += k.length + (localStorage.getItem(k)?.length ?? 0);
    }
  } catch {
    /* ignore */
  }
  return { used, budget: STORAGE_BUDGET_CHARS, ratio: Math.min(1, used / STORAGE_BUDGET_CHARS) };
}
