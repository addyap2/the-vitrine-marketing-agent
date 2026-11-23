import { useState } from 'react';
import { useAppState } from '../state/store';
import { PageHeader, Tabs } from '../components/ui';
import { ClaudeAssistant } from '../components/ClaudeAssistant';
import { DEFAULT_FILTER, FilterBar, NewPublicationButton, PublicationBoard, PublicationList, filterPublications, type PubFilter } from '../components/PublicationViews';
import { TemplatePickerButton } from '../components/TemplatePicker';
import { WORKSPACE_DESCRIPTIONS } from '../lib/labels';
import type { Channel } from '../lib/types';

export const SOCIAL_CHANNELS: Channel[] = ['instagram', 'facebook', 'linkedin', 'google', 'tiktok', 'pinterest', 'youtube'];

export function SocialView() {
  const state = useAppState();
  const [tab, setTab] = useState<'board' | 'list' | 'claude'>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches ? 'list' : 'board',
  );
  const [filter, setFilter] = useState<PubFilter>(DEFAULT_FILTER);
  const social = state.publications.filter((p) => p.workspace === 'social' || (SOCIAL_CHANNELS.includes(p.channel) && p.workspace !== 'creative'));
  const filtered = filterPublications(social, filter);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Espace marketing"
        title="Réseaux sociaux"
        description={WORKSPACE_DESCRIPTIONS.social}
        actions={
          <>
            <TemplatePickerButton workspace="social" />
            <NewPublicationButton workspace="social" />
          </>
        }
      />
      <Tabs
        label="Affichage"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'board', label: 'Tableau' },
          { id: 'list', label: 'Liste', count: filtered.length },
          { id: 'claude', label: 'Rédiger avec Claude' },
        ]}
      />
      {tab !== 'claude' && <FilterBar value={filter} onChange={setFilter} hideStatus={tab === 'board'} />}
      {tab === 'board' && <PublicationBoard pubs={filtered.filter((p) => p.status !== 'archive')} />}
      {tab === 'list' && <PublicationList pubs={filtered} />}
      {tab === 'claude' && (
        <section className="panel">
          <ClaudeAssistant workspace="social" />
        </section>
      )}
      <p className="small muted footnote">
        Aucune publication automatique : copiez le texte prêt à publier depuis la fiche, publiez sur le réseau (ou programmez-le dans Meta Business Suite, gratuit), puis marquez la publication comme publiée.
      </p>
    </div>
  );
}
