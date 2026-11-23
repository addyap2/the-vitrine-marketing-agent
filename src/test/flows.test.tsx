import { describe, expect, it } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createStore, makePublication, StoreProvider, type Store } from '../state/store';
import { UIProvider } from '../components/ui';
import { EditorProvider } from '../components/PublicationEditor';
import { ClaudeAssistant } from '../components/ClaudeAssistant';
import { ApprovalView } from '../views/Approval';
import { DataView } from '../views/Data';
import { App } from '../App';
import { emptyState } from '../lib/defaults';
import { applyTransition } from '../lib/workflow';
import type { AppState } from '../lib/types';

function setup(ui: ReactNode, state: AppState = emptyState()) {
  const store = createStore(state, () => ({ ok: true }));
  const user = userEvent.setup();
  render(
    <StoreProvider store={store}>
      <UIProvider>
        <EditorProvider>{ui}</EditorProvider>
      </UIProvider>
    </StoreProvider>,
  );
  return { store, user };
}

const CLAUDE_ANSWER = `Résumé.
\`\`\`json
[{"titre":"Post A","canal":"instagram","format":"post","date":"2026-12-01","heure":"09:00","accroche":"Une accroche assez longue","texte":"Texte A","cta":"Contactez-nous","hashtags":"#a","brief_visuel":"","notes":""},
 {"titre":"Post B","canal":"facebook","format":"post","date":null,"heure":null,"accroche":"","texte":"Texte B","cta":"","hashtags":"","brief_visuel":"","notes":""}]
\`\`\``;

describe('application shell', () => {
  it('renders the dashboard and every workspace route without crashing', async () => {
    setup(<App notice={null} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeInTheDocument();
    for (const [hash, title] of [
      ['strategie', 'Stratégie'],
      ['reseaux', 'Réseaux sociaux'],
      ['creation', 'Création'],
      ['calendrier', 'Calendrier éditorial'],
      ['seo', 'SEO & GEO'],
      ['analyses', 'Analyses'],
      ['campagnes', 'Campagnes'],
      ['publications', 'Publications'],
      ['validation', 'Validation'],
      ['modeles', 'Modèles réutilisables'],
      ['claude', 'Atelier Claude'],
      ['marque', 'Profil de marque'],
      ['donnees', 'Données & sauvegardes'],
    ]) {
      window.location.hash = `#/${hash}`;
      expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    }
    window.location.hash = '';
  });
});

describe('Claude Pro copy/paste workflow', () => {
  it('builds a prompt, parses the pasted answer and imports publications as drafts', async () => {
    const { store, user } = setup(<ClaudeAssistant workspace="social" />);
    await user.click(screen.getByRole('button', { name: /Préparer le prompt/ }));
    const prompt = screen.getByLabelText('Prompt pour Claude') as HTMLTextAreaElement;
    expect(prompt.value).toContain('thevitrine.fr');
    expect(prompt.value).toContain('```json');
    await user.click(screen.getByRole('button', { name: /J’ai la réponse/ }));
    const box = screen.getByPlaceholderText(/Collez ici la réponse complète/);
    await user.click(box);
    await user.paste(CLAUDE_ANSWER);
    await user.click(screen.getByRole('button', { name: /Analyser la réponse/ }));
    expect(screen.getByText('2 contenus détectés')).toBeInTheDocument();
    // Untick the second item, import only the first.
    await user.click(screen.getAllByRole('checkbox')[1]);
    await user.click(screen.getByRole('button', { name: /Importer 1 publication/ }));
    const pubs = store.getState().publications;
    expect(pubs).toHaveLength(1);
    expect(pubs[0]).toMatchObject({ title: 'Post A', status: 'brouillon', source: 'claude', scheduledDate: '2026-12-01', scheduledTime: '09:00' });
    expect(store.getState().claude).toHaveLength(1);
    expect(store.getState().claude[0].importedCount).toBe(1);
  });
});

describe('approval queue', () => {
  function withReview(): AppState {
    const s = emptyState();
    const p = applyTransition(makePublication({ title: 'À valider', body: 'Un texte pour la relecture, avec un appel : contactez-nous.', hook: 'Une accroche assez longue' }), 'relecture');
    s.publications.push(p);
    return s;
  }

  it('approves a publication', async () => {
    const { store, user } = setup(<ApprovalView />, withReview());
    await user.click(screen.getByRole('button', { name: 'Approuver' }));
    expect(store.getState().publications[0].status).toBe('approuve');
  });

  it('requires a comment to request changes', async () => {
    const { store, user } = setup(<ApprovalView />, withReview());
    await user.click(screen.getByRole('button', { name: 'Demander des corrections' }));
    const send = screen.getByRole('button', { name: 'Envoyer' });
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText('Corrections demandées'), 'Raccourcir la fin');
    await user.click(send);
    const p = store.getState().publications[0];
    expect(p.status).toBe('corrections');
    expect(p.history.at(-1)?.comment).toBe('Raccourcir la fin');
  });
});

describe('backup restore', () => {
  it('imports an old ChatGPT v2 backup file and replaces the data after confirmation', async () => {
    const { store, user } = setup(<DataView />);
    const v2 = JSON.stringify({
      version: 2,
      drafts: [{ id: 'd1', title: 'Ancien brouillon', agent: 'social', content: 'Bonjour', status: 'Brouillon', date: '', created: '2026-01-01T00:00:00Z' }],
      campaigns: [],
    });
    const file = new File([v2], 'ancienne.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Fichier de sauvegarde'), file);
    const dialog = await screen.findByRole('dialog', { name: 'Importer une sauvegarde' });
    expect(within(dialog).getByText(/convertie depuis l’ancien format/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Remplacer tout' }));
    await waitFor(() => expect(store.getState().publications).toHaveLength(1));
    expect(store.getState().publications[0].title).toBe('Ancien brouillon');
  });

  it('rejects an invalid file with a clear message', async () => {
    const { store, user } = setup(<DataView />);
    await user.upload(screen.getByLabelText('Fichier de sauvegarde'), new File(['{oops'], 'x.json', { type: 'application/json' }));
    expect(await screen.findByText(/Import refusé : Ce fichier n’est pas un JSON valide/)).toBeInTheDocument();
    expect(store.getState().publications).toHaveLength(0);
  });
});

describe('storage failures', () => {
  it('keeps changes in memory and reports the error when the browser refuses to save', () => {
    const store: Store = createStore(emptyState(), () => ({ ok: false, error: 'Stockage plein' }));
    store.update((s) => ({ ...s, publications: [makePublication({ title: 'Gardée' })] }));
    expect(store.getState().publications).toHaveLength(1);
    expect(store.getStatus().saveError).toBe('Stockage plein');
  });
});
