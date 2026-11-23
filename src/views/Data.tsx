import { useRef, useState } from 'react';
import { useActions, useAppState } from '../state/store';
import { Button, Field, Modal, PageHeader, Progress, useUI } from '../components/ui';
import { Icon } from '../components/Icon';
import { backupFilename, makeBackup, parseBackup, summarize, type ParsedBackup } from '../lib/backup';
import { listSnapshots, storageUsage, type Snapshot } from '../lib/storage';
import { validateState } from '../lib/schema';
import { campaignsCSV, performanceCSV, publicationsCSV } from '../lib/csv';
import { buildICS } from '../lib/ics';
import { downloadFile, readFileText } from '../lib/download';
import { formatDateTime } from '../lib/dates';

const SUMMARY_LABELS: Record<keyof ReturnType<typeof summarize>, string> = {
  campaigns: 'campagnes',
  publications: 'publications',
  templates: 'modèles personnels',
  performance: 'relevés de statistiques',
  keywords: 'mots-clés',
  notes: 'documents stratégiques',
};

export function DataView() {
  const state = useAppState();
  const actions = useActions();
  const { toast, confirm } = useUI();
  const fileRef = useRef<HTMLInputElement>(null);
  const [incoming, setIncoming] = useState<(ParsedBackup & { name: string }) | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => listSnapshots());
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState('');
  const usage = storageUsage();
  const summary = summarize(state);

  const exportJson = () => {
    const now = new Date();
    downloadFile(backupFilename(now), JSON.stringify(makeBackup(state, now.toISOString()), null, 2), 'application/json');
    actions.markBackup();
    toast('Sauvegarde téléchargée. Rangez-la dans un dossier synchronisé (Drive, iCloud…).');
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await readFileText(file);
      setIncoming({ ...parseBackup(text), name: file.name });
    } catch (e) {
      toast(`Import refusé : ${(e as Error).message}`, 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const restoreSnapshot = async (s: Snapshot) => {
    if (!(await confirm({ title: 'Restaurer ce point', message: `Les données actuelles seront remplacées par celles du ${formatDateTime(s.at)}. Un point de restauration de l’état actuel est créé avant.`, confirmLabel: 'Restaurer' }))) return;
    try {
      actions.replaceState(validateState(JSON.parse(s.data)), 'Avant restauration');
      setSnapshots(listSnapshots());
      toast('Point de restauration rechargé');
    } catch (e) {
      toast(`Restauration impossible : ${(e as Error).message}`, 'error');
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Outils"
        title="Données & sauvegardes"
        description="Tout est stocké dans ce navigateur, sur cet appareil. Pas de compte, pas de serveur, pas de base de données : la sauvegarde JSON est votre filet de sécurité et votre moyen de passer d’un appareil à l’autre."
      />
      <div className="two-col">
        <section className="panel stack">
          <h2>Sauvegarde</h2>
          <dl className="facts">
            <div><dt>Dernière sauvegarde</dt><dd>{state.meta.lastBackupAt ? formatDateTime(state.meta.lastBackupAt) : 'jamais'}</dd></div>
            <div><dt>Dernière modification</dt><dd>{state.meta.lastChangeAt ? formatDateTime(state.meta.lastChangeAt) : '—'}</dd></div>
          </dl>
          <ul className="summary-list">
            {Object.entries(summary).map(([k, v]) => (
              <li key={k}><strong>{v}</strong> {SUMMARY_LABELS[k as keyof typeof summary]}</li>
            ))}
          </ul>
          <div className="inline-actions wrap">
            <Button variant="primary" icon="download" onClick={exportJson}>Exporter la sauvegarde (.json)</Button>
            <Button icon="upload" onClick={() => fileRef.current?.click()}>Importer une sauvegarde</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} aria-label="Fichier de sauvegarde" />
          </div>
          <p className="small muted">Les sauvegardes de l’ancienne version (format v2 de ChatGPT) sont reconnues et converties.</p>
        </section>

        <section className="panel stack">
          <h2>Stockage du navigateur</h2>
          <Progress value={usage.ratio} label="Espace de stockage utilisé" />
          <p className="small">
            {(usage.used / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Mo utilisés sur environ 5 Mo disponibles.
            {usage.ratio > 0.7 && <strong className="warn"> Pensez à archiver ou supprimer d’anciens éléments.</strong>}
          </p>
          <h3>Points de restauration automatiques</h3>
          <p className="small muted">Un point par jour d’utilisation, plus avant chaque import ou réinitialisation (3 derniers conservés, dans ce navigateur uniquement).</p>
          {snapshots.length ? (
            <ul className="snapshots">
              {snapshots.map((s) => (
                <li key={s.at}>
                  <span>
                    <strong>{formatDateTime(s.at)}</strong>
                    <span className="small muted">{s.reason}</span>
                  </span>
                  <Button small icon="history" onClick={() => restoreSnapshot(s)}>Restaurer</Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">Aucun point pour l’instant.</p>
          )}
        </section>
      </div>

      <section className="panel">
        <h2>Exports</h2>
        <div className="export-grid">
          <Button icon="download" disabled={!state.publications.length} onClick={() => downloadFile('vitrine-publications.csv', publicationsCSV(state.publications, state.campaigns), 'text/csv;charset=utf-8')}>Publications (CSV)</Button>
          <Button icon="download" disabled={!state.campaigns.length} onClick={() => downloadFile('vitrine-campagnes.csv', campaignsCSV(state.campaigns, state.publications), 'text/csv;charset=utf-8')}>Campagnes (CSV)</Button>
          <Button icon="download" disabled={!state.performance.length} onClick={() => downloadFile('vitrine-statistiques.csv', performanceCSV(state.performance, state.publications, state.campaigns), 'text/csv;charset=utf-8')}>Statistiques (CSV)</Button>
          <Button icon="calendar" disabled={!state.publications.some((p) => p.scheduledDate)} onClick={() => downloadFile('vitrine-publications.ics', buildICS(state.publications, state.campaigns), 'text/calendar;charset=utf-8')}>Calendrier (.ics)</Button>
        </div>
        <p className="small muted">Les CSV s’ouvrent directement dans Excel, Numbers ou Google Sheets (séparateur point-virgule, UTF-8).</p>
      </section>

      <section className="panel">
        <h2>Confidentialité et limites</h2>
        <ul className="plain-list">
          <li><Icon name="info" size={15} /> Les données ne sont ni chiffrées ni synchronisées : un autre navigateur ou appareil ne les voit pas. Utilisez export puis import pour les transférer.</li>
          <li><Icon name="info" size={15} /> Vider les données du site, utiliser la navigation privée ou désinstaller le navigateur efface tout : exportez régulièrement.</li>
          <li><Icon name="info" size={15} /> N’enregistrez ni mots de passe ni données sensibles de clients.</li>
          <li><Icon name="info" size={15} /> L’application ne publie rien sur les réseaux sociaux et n’envoie rien à une IA.</li>
        </ul>
      </section>

      <section className="panel danger-zone">
        <h2>Réinitialiser</h2>
        <p className="small">Efface toutes les données de ce navigateur (un point de restauration est créé avant).</p>
        <Button variant="danger" icon="trash" onClick={() => setResetOpen(true)}>Tout effacer…</Button>
      </section>

      {incoming && (
        <Modal
          title="Importer une sauvegarde"
          open
          onClose={() => setIncoming(null)}
          footer={
            <>
              <Button onClick={() => setIncoming(null)}>Annuler</Button>
              <Button
                onClick={() => {
                  try {
                    actions.mergeState(incoming.state);
                    toast('Sauvegarde fusionnée');
                    setIncoming(null);
                    setSnapshots(listSnapshots());
                  } catch (e) {
                    toast(`Fusion impossible : ${(e as Error).message}`, 'error');
                  }
                }}
              >
                Fusionner
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  actions.replaceState(incoming.state);
                  toast('Sauvegarde restaurée');
                  setIncoming(null);
                  setSnapshots(listSnapshots());
                }}
              >
                Remplacer tout
              </Button>
            </>
          }
        >
          <div className="stack">
            <p>
              <strong>{incoming.name}</strong>
              {incoming.exportedAt && <> — exportée le {formatDateTime(incoming.exportedAt)}</>}
              {incoming.migratedFrom && <> — convertie depuis l’ancien format</>}
            </p>
            <ul className="summary-list">
              {Object.entries(summarize(incoming.state)).map(([k, v]) => (
                <li key={k}><strong>{v}</strong> {SUMMARY_LABELS[k as keyof typeof summary]}</li>
              ))}
            </ul>
            <p className="small"><strong>Remplacer</strong> : les données actuelles sont remplacées par la sauvegarde. <strong>Fusionner</strong> : les éléments sont combinés, la version la plus récente de chaque élément l’emporte ; votre profil de marque actuel est conservé.</p>
            <p className="small muted">Un point de restauration de l’état actuel est créé avant l’opération.</p>
          </div>
        </Modal>
      )}

      {resetOpen && (
        <Modal
          title="Tout effacer"
          open
          onClose={() => setResetOpen(false)}
          footer={
            <>
              <Button onClick={() => setResetOpen(false)}>Annuler</Button>
              <Button
                variant="danger"
                disabled={resetText.trim().toUpperCase() !== 'EFFACER'}
                onClick={() => {
                  actions.reset();
                  setResetOpen(false);
                  setResetText('');
                  setSnapshots(listSnapshots());
                  toast('Données effacées. Un point de restauration a été créé.');
                }}
              >
                Effacer définitivement
              </Button>
            </>
          }
        >
          <div className="stack">
            <p>Campagnes, publications, statistiques, mots-clés et documents seront effacés de ce navigateur.</p>
            <Field label="Tapez EFFACER pour confirmer">
              <input className="input" value={resetText} onChange={(e) => setResetText(e.target.value)} autoFocus />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
