import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { CAMPAIGN_COLORS, emptyState } from '../lib/defaults';
import { nowISO } from '../lib/dates';
import { uid } from '../lib/id';
import { createSnapshot, saveState } from '../lib/storage';
import { mergeStates } from '../lib/backup';
import { applyEdit, applyTransition, type TransitionInput } from '../lib/workflow';
import type {
  AppState,
  Brand,
  Campaign,
  ClaudeSession,
  Goal,
  Keyword,
  PerformanceEntry,
  Publication,
  PubStatus,
  StrategyNote,
  Template,
} from '../lib/types';

export interface StoreStatus {
  saveError: string | null;
}

export interface Store {
  getState: () => AppState;
  getStatus: () => StoreStatus;
  subscribe: (fn: () => void) => () => void;
  update: (fn: (s: AppState) => AppState, opts?: { silent?: boolean }) => void;
}

export function createStore(initial: AppState, persist = saveState): Store {
  let state = initial;
  let status: StoreStatus = { saveError: null };
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    getStatus: () => status,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    update(fn, opts) {
      const next = fn(state);
      if (next === state) return;
      state = opts?.silent ? next : { ...next, meta: { ...next.meta, lastChangeAt: nowISO() } };
      // The change stays in memory even if the browser refuses to store it, so typing is never lost;
      // a banner then asks for a JSON export.
      const res = persist(state);
      status = { saveError: res.ok ? (res.error ?? null) : (res.error ?? 'Enregistrement impossible.') };
      listeners.forEach((l) => l());
    },
  };
}

export type NewPublication = Partial<Omit<Publication, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'versions'>> & { title: string };

export function makePublication(input: NewPublication, at = nowISO()): Publication {
  return {
    workspace: 'social',
    channel: 'instagram',
    format: 'post',
    campaignId: null,
    status: 'brouillon',
    scheduledDate: null,
    scheduledTime: null,
    hook: '',
    body: '',
    cta: '',
    hashtags: '',
    visualBrief: '',
    notes: '',
    publishedAt: null,
    publishedUrl: '',
    tags: [],
    source: 'manuel',
    ...input,
    title: input.title.trim().slice(0, 500) || 'Sans titre',
    id: uid('p-'),
    history: [{ at, action: 'creation', comment: input.source === 'claude' ? 'Créé depuis une réponse de Claude' : undefined }],
    versions: [],
    createdAt: at,
    updatedAt: at,
  };
}

function actions(store: Store) {
  const up = store.update;
  const now = nowISO;
  const addPublications = (list: NewPublication[]): string[] => {
    const pubs = list.map((p) => makePublication(p));
    up((s) => ({ ...s, publications: [...s.publications, ...pubs] }));
    return pubs.map((p) => p.id);
  };
  const addPublication = (p: NewPublication): string => addPublications([p])[0];
  return {
    // Publications
    addPublications,
    addPublication,
    savePublication(next: Publication) {
      up((s) => ({
        ...s,
        publications: s.publications.map((p) => (p.id === next.id ? applyEdit(p, next) : p)),
      }));
    },
    patchPublication(id: string, patch: Partial<Publication>) {
      up((s) => ({
        ...s,
        publications: s.publications.map((p) => (p.id === id ? applyEdit(p, { ...p, ...patch }) : p)),
      }));
    },
    transition(id: string, to: PubStatus, input?: TransitionInput) {
      // Throws WorkflowError before touching state if the move is not allowed.
      const pub = store.getState().publications.find((p) => p.id === id);
      if (!pub) return;
      const next = applyTransition(pub, to, input);
      up((s) => ({ ...s, publications: s.publications.map((p) => (p.id === id ? next : p)) }));
    },
    comment(id: string, comment: string) {
      if (!comment.trim()) return;
      up((s) => ({
        ...s,
        publications: s.publications.map((p) =>
          p.id === id ? { ...p, history: [...p.history, { at: now(), action: 'commentaire', comment: comment.trim() }] } : p,
        ),
      }));
    },
    reschedule(id: string, date: string | null) {
      up((s) => ({
        ...s,
        publications: s.publications.map((p) => (p.id === id ? { ...p, scheduledDate: date, updatedAt: now() } : p)),
      }));
    },
    duplicatePublication(id: string): string | null {
      const src = store.getState().publications.find((p) => p.id === id);
      if (!src) return null;
      const { id: _id, createdAt: _c, updatedAt: _u, history: _h, versions: _v, ...rest } = src;
      return addPublication({ ...rest, title: `${src.title} (copie)`, status: 'brouillon', publishedAt: null, publishedUrl: '', scheduledDate: null });
    },
    deletePublication(id: string) {
      up((s) => ({
        ...s,
        publications: s.publications.filter((p) => p.id !== id),
        performance: s.performance.map((e) => (e.publicationId === id ? { ...e, publicationId: null } : e)),
      }));
    },

    // Campaigns
    saveCampaign(c: Partial<Campaign> & { name: string }): string {
      const id = c.id ?? uid('c-');
      up((s) => {
        const existing = s.campaigns.find((x) => x.id === id);
        const base: Campaign = existing ?? {
          id,
          name: '',
          objective: '',
          audience: '',
          keyMessage: '',
          channels: [],
          startDate: null,
          endDate: null,
          status: 'idee',
          kpiTarget: '',
          notes: '',
          color: CAMPAIGN_COLORS[s.campaigns.length % CAMPAIGN_COLORS.length],
          createdAt: now(),
          updatedAt: now(),
        };
        const next = { ...base, ...c, id, updatedAt: now() };
        return { ...s, campaigns: existing ? s.campaigns.map((x) => (x.id === id ? next : x)) : [...s.campaigns, next] };
      });
      return id;
    },
    /** Publications are kept and detached from the deleted campaign. */
    deleteCampaign(id: string) {
      up((s) => ({
        ...s,
        campaigns: s.campaigns.filter((c) => c.id !== id),
        publications: s.publications.map((p) => (p.campaignId === id ? { ...p, campaignId: null, updatedAt: now() } : p)),
        performance: s.performance.map((e) => (e.campaignId === id ? { ...e, campaignId: null } : e)),
        strategy: { ...s.strategy, goals: s.strategy.goals.map((g) => (g.campaignId === id ? { ...g, campaignId: null } : g)) },
      }));
    },

    // Templates
    saveTemplate(t: Partial<Template> & Pick<Template, 'name' | 'kind' | 'workspace' | 'body'>): string {
      const id = t.id ?? uid('t-');
      up((s) => {
        const existing = s.templates.find((x) => x.id === id);
        const next: Template = {
          description: '',
          channel: null,
          format: null,
          output: 'texte',
          builtin: false,
          createdAt: now(),
          ...existing,
          ...t,
          id,
          updatedAt: now(),
        };
        return { ...s, templates: existing ? s.templates.map((x) => (x.id === id ? next : x)) : [...s.templates, next] };
      });
      return id;
    },
    deleteTemplate(id: string) {
      up((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) }));
    },

    // Performance
    addPerformance(list: Omit<PerformanceEntry, 'id' | 'createdAt'>[]) {
      const at = now();
      up((s) => ({ ...s, performance: [...s.performance, ...list.map((e) => ({ ...e, id: uid('m-'), createdAt: at }))] }));
    },
    updatePerformance(entry: PerformanceEntry) {
      up((s) => ({ ...s, performance: s.performance.map((e) => (e.id === entry.id ? entry : e)) }));
    },
    deletePerformance(id: string) {
      up((s) => ({ ...s, performance: s.performance.filter((e) => e.id !== id) }));
    },

    // Strategy
    saveNote(n: Partial<StrategyNote> & Pick<StrategyNote, 'title' | 'kind' | 'content'>): string {
      const id = n.id ?? uid('n-');
      up((s) => {
        const existing = s.strategy.notes.find((x) => x.id === id);
        const next: StrategyNote = { createdAt: now(), ...existing, ...n, id, updatedAt: now() };
        const notes = existing ? s.strategy.notes.map((x) => (x.id === id ? next : x)) : [next, ...s.strategy.notes];
        return { ...s, strategy: { ...s.strategy, notes } };
      });
      return id;
    },
    deleteNote(id: string) {
      up((s) => ({ ...s, strategy: { ...s.strategy, notes: s.strategy.notes.filter((n) => n.id !== id) } }));
    },
    saveGoal(g: Omit<Goal, 'id'> & { id?: string }) {
      const id = g.id ?? uid('g-');
      up((s) => {
        const exists = s.strategy.goals.some((x) => x.id === id);
        const goals = exists ? s.strategy.goals.map((x) => (x.id === id ? { ...g, id } : x)) : [...s.strategy.goals, { ...g, id }];
        return { ...s, strategy: { ...s.strategy, goals } };
      });
    },
    deleteGoal(id: string) {
      up((s) => ({ ...s, strategy: { ...s.strategy, goals: s.strategy.goals.filter((g) => g.id !== id) } }));
    },

    // SEO
    addKeywords(list: Omit<Keyword, 'id' | 'createdAt' | 'updatedAt' | 'positions' | 'status'>[]) {
      const at = now();
      up((s) => {
        const existing = new Set(s.seo.keywords.map((k) => k.keyword.toLowerCase()));
        const fresh = list
          .filter((k) => k.keyword.trim() && !existing.has(k.keyword.trim().toLowerCase()))
          .map((k): Keyword => ({ ...k, keyword: k.keyword.trim(), id: uid('k-'), status: 'a-traiter', positions: [], createdAt: at, updatedAt: at }));
        return { ...s, seo: { ...s.seo, keywords: [...s.seo.keywords, ...fresh] } };
      });
    },
    saveKeyword(k: Keyword) {
      up((s) => ({ ...s, seo: { ...s.seo, keywords: s.seo.keywords.map((x) => (x.id === k.id ? { ...k, updatedAt: now() } : x)) } }));
    },
    addPosition(id: string, date: string, position: number) {
      up((s) => ({
        ...s,
        seo: {
          ...s.seo,
          keywords: s.seo.keywords.map((k) =>
            k.id === id
              ? { ...k, positions: [...k.positions.filter((p) => p.date !== date), { date, position }].sort((a, b) => a.date.localeCompare(b.date)), updatedAt: now() }
              : k,
          ),
        },
      }));
    },
    deleteKeyword(id: string) {
      up((s) => ({ ...s, seo: { ...s.seo, keywords: s.seo.keywords.filter((k) => k.id !== id) } }));
    },
    toggleCheck(id: string) {
      up((s) => ({ ...s, seo: { ...s.seo, checks: { ...s.seo.checks, [id]: !s.seo.checks[id] } } }));
    },

    // Brand
    saveBrand(brand: Brand) {
      up((s) => ({ ...s, brand }));
    },

    // Claude sessions (history of prompts/answers, newest last, max 100)
    saveSession(session: Omit<ClaudeSession, 'id' | 'createdAt'> & { id?: string }): string {
      const id = session.id ?? uid('s-');
      up((s) => {
        const existing = s.claude.find((x) => x.id === id);
        const next: ClaudeSession = { createdAt: now(), ...existing, ...session, id };
        const claude = existing ? s.claude.map((x) => (x.id === id ? next : x)) : [...s.claude, next];
        return { ...s, claude: claude.slice(-100) };
      });
      return id;
    },
    deleteSession(id: string) {
      up((s) => ({ ...s, claude: s.claude.filter((x) => x.id !== id) }));
    },

    // Data
    replaceState(next: AppState, reason = 'Avant import') {
      createSnapshot(store.getState(), reason);
      up(() => next);
    },
    mergeState(incoming: AppState) {
      createSnapshot(store.getState(), 'Avant fusion');
      up((s) => mergeStates(s, incoming));
    },
    markBackup() {
      up((s) => ({ ...s, meta: { ...s.meta, lastBackupAt: now() } }), { silent: true });
    },
    reset() {
      createSnapshot(store.getState(), 'Avant réinitialisation');
      up(() => emptyState());
    },
  };
}

export type Actions = ReturnType<typeof actions>;

const Ctx = createContext<{ store: Store; actions: Actions } | null>(null);

export function StoreProvider({ store, children }: { store: Store; children: ReactNode }) {
  const value = useMemo(() => ({ store, actions: actions(store) }), [store]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useCtx() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('StoreProvider manquant');
  return ctx;
}

export function useAppState(): AppState {
  const { store } = useCtx();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useStoreStatus(): StoreStatus {
  const { store } = useCtx();
  return useSyncExternalStore(store.subscribe, store.getStatus, store.getStatus);
}

export function useActions(): Actions {
  return useCtx().actions;
}

export function useStoreApi(): Store {
  return useCtx().store;
}
