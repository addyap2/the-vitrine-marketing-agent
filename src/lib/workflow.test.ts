import { describe, expect, it } from 'vitest';
import { makePublication } from '../state/store';
import { applyEdit, applyTransition, canTransition, isOverdue, WorkflowError } from './workflow';

const draft = () => makePublication({ title: 'Test', body: 'Un texte suffisamment long pour être relu.' });

describe('workflow', () => {
  it('follows the happy path to published', () => {
    let p = draft();
    p = applyTransition(p, 'relecture');
    p = applyTransition(p, 'approuve');
    p = applyTransition(p, 'programme', { scheduledDate: '2026-12-01', scheduledTime: '09:30' });
    expect(p.scheduledTime).toBe('09:30');
    p = applyTransition(p, 'publie', { publishedUrl: ' https://instagram.com/p/x ' });
    expect(p.status).toBe('publie');
    expect(p.publishedAt).toBe('2026-12-01');
    expect(p.publishedUrl).toBe('https://instagram.com/p/x');
    expect(p.history.filter((h) => h.action === 'statut')).toHaveLength(4);
  });

  it('refuses invalid jumps', () => {
    expect(canTransition('brouillon', 'publie')).toBe(false);
    expect(() => applyTransition(draft(), 'publie')).toThrow(WorkflowError);
  });

  it('requires a comment to request changes', () => {
    const p = applyTransition(draft(), 'relecture');
    expect(() => applyTransition(p, 'corrections')).toThrow(/corrigé/);
    const c = applyTransition(p, 'corrections', { comment: 'Raccourcir' });
    expect(c.history.at(-1)?.comment).toBe('Raccourcir');
  });

  it('requires a date to schedule', () => {
    const p = applyTransition(applyTransition(draft(), 'relecture'), 'approuve');
    expect(() => applyTransition(p, 'programme')).toThrow(/date/);
  });

  it('refuses to send empty content to review', () => {
    expect(() => applyTransition(makePublication({ title: 'Vide' }), 'relecture')).toThrow(/vide/);
  });

  it('sends approved content back to review when the wording changes', () => {
    const approved = applyTransition(applyTransition(draft(), 'relecture'), 'approuve');
    const edited = applyEdit(approved, { ...approved, body: 'Nouveau texte' });
    expect(edited.status).toBe('relecture');
    expect(edited.versions[0].body).toBe(approved.body);
    const retitled = applyEdit(approved, { ...approved, title: 'Autre titre' });
    expect(retitled.status).toBe('approuve');
  });

  it('flags overdue items', () => {
    const p = { ...draft(), scheduledDate: '2026-01-01' };
    expect(isOverdue(p, '2026-02-01')).toBe(true);
    expect(isOverdue({ ...p, status: 'publie' }, '2026-02-01')).toBe(false);
  });
});

describe('stale edits', () => {
  it('never lets a plain edit change status or drop history', () => {
    const scheduled = applyTransition(applyTransition(applyTransition(draft(), 'relecture'), 'approuve'), 'programme', { scheduledDate: '2026-12-01' });
    const stale = { ...scheduled, status: 'brouillon' as const, history: [] };
    const saved = applyEdit(scheduled, { ...stale, title: 'Nouveau titre' });
    expect(saved.status).toBe('programme');
    expect(saved.history).toHaveLength(scheduled.history.length);
    expect(saved.title).toBe('Nouveau titre');
  });
});
