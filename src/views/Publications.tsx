import { useState } from 'react';
import { useAppState } from '../state/store';
import { Button, PageHeader, Tabs } from '../components/ui';
import { DEFAULT_FILTER, FilterBar, NewPublicationButton, PublicationBoard, PublicationList, filterPublications, type PubFilter } from '../components/PublicationViews';
import { TemplatePickerButton } from '../components/TemplatePicker';
import { publicationsCSV } from '../lib/csv';
import { downloadFile } from '../lib/download';

export function PublicationsView() {
  const state = useAppState();
  const [filter, setFilter] = useState<PubFilter>(DEFAULT_FILTER);
  const [mode, setMode] = useState<'list' | 'board'>('list');
  const filtered = filterPublications(state.publications, filter);
  return (
    <div className="page">
      <PageHeader
        eyebrow="Pilotage"
        title="Publications"
        description="Tous les contenus, tous espaces confondus, avec recherche plein texte et filtres."
        actions={
          <>
            <Button icon="download" disabled={!filtered.length} onClick={() => downloadFile('vitrine-publications.csv', publicationsCSV(filtered, state.campaigns), 'text/csv;charset=utf-8')}>
              CSV
            </Button>
            <TemplatePickerButton />
            <NewPublicationButton workspace="social" />
          </>
        }
      />
      <Tabs label="Affichage" value={mode} onChange={setMode} items={[{ id: 'list', label: 'Liste', count: filtered.length }, { id: 'board', label: 'Tableau' }]} />
      <FilterBar value={filter} onChange={setFilter} hideStatus={mode === 'board'} />
      {mode === 'list' ? <PublicationList pubs={filtered} /> : <PublicationBoard pubs={filtered.filter((p) => p.status !== 'archive')} />}
    </div>
  );
}
