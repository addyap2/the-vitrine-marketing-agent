import { useMemo, useState } from 'react';
import { useActions, useAppState } from '../state/store';
import { Button, Empty, Field, Modal, PageHeader, Tabs, useUI } from '../components/ui';
import { ClaudeAssistant } from '../components/ClaudeAssistant';
import { CHANNEL_LABELS, METRIC_LABELS, WORKSPACE_DESCRIPTIONS } from '../lib/labels';
import { CHANNELS, METRIC_KEYS, type Channel, type MetricKey, type PerformanceEntry } from '../lib/types';
import { addDays, formatShort, today } from '../lib/dates';
import { byMonth, dataDigest, filterEntries, formatNumber, formatPct, groupBy, rates, sumEntries, topPublications } from '../lib/metrics';
import { importPerformanceCSV, performanceCSV } from '../lib/csv';
import { downloadFile, readFileText } from '../lib/download';

type Period = '30' | '90' | 'month' | 'lastmonth' | 'year' | 'all';

function periodRange(p: Period): { from: string | null; to: string | null; label: string } {
  const t = today();
  const [y, m] = t.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  switch (p) {
    case '30':
      return { from: addDays(t, -29), to: t, label: '30 derniers jours' };
    case '90':
      return { from: addDays(t, -89), to: t, label: '90 derniers jours' };
    case 'month':
      return { from: first, to: t, label: 'mois en cours' };
    case 'lastmonth': {
      const lmEnd = addDays(first, -1);
      return { from: `${lmEnd.slice(0, 7)}-01`, to: lmEnd, label: 'mois dernier' };
    }
    case 'year':
      return { from: `${y}-01-01`, to: t, label: `année ${y}` };
    default:
      return { from: null, to: null, label: 'toute la période' };
  }
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function BarChart({ data, metric }: { data: { month: string; value: number }[]; metric: MetricKey }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 100 / data.length;
  return (
    <figure className="chart">
      <svg viewBox="0 0 100 50" preserveAspectRatio="none" role="img" aria-label={`${METRIC_LABELS[metric]} par mois`}>
        {data.map((d, i) => {
          const h = (d.value / max) * 44;
          return <rect key={d.month} x={i * w + w * 0.18} y={46 - h} width={w * 0.64} height={Math.max(h, 0.4)} rx={0.8} className="bar" />;
        })}
        <line x1="0" x2="100" y1="46" y2="46" className="axis" />
      </svg>
      <div className="chart-labels">
        {data.map((d) => (
          <span key={d.month} style={{ width: `${w}%` }}>
            <strong>{formatNumber(d.value)}</strong>
            <span>{MONTHS[Number(d.month.slice(5)) - 1]} {d.month.slice(2, 4)}</span>
          </span>
        ))}
      </div>
    </figure>
  );
}

const blankEntry = (): Omit<PerformanceEntry, 'id' | 'createdAt'> => ({
  date: today(),
  channel: 'instagram',
  publicationId: null,
  campaignId: null,
  impressions: 0,
  reach: 0,
  interactions: 0,
  clicks: 0,
  profileVisits: 0,
  followersGained: 0,
  enquiries: 0,
  notes: '',
});

export function AnalyticsView() {
  const state = useAppState();
  const actions = useActions();
  const { toast, confirm } = useUI();
  const [tab, setTab] = useState<'overview' | 'entries' | 'claude'>('overview');
  const [period, setPeriod] = useState<Period>('90');
  const [channel, setChannel] = useState<Channel | 'tous'>('tous');
  const [campaignId, setCampaignId] = useState('tous');
  const [metric, setMetric] = useState<MetricKey>('interactions');
  const [editing, setEditing] = useState<(Omit<PerformanceEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) | null>(null);
  const [importing, setImporting] = useState(false);

  const range = periodRange(period);
  const entries = useMemo(
    () => filterEntries(state.performance, { from: range.from, to: range.to, channel, campaignId }),
    [state.performance, range.from, range.to, channel, campaignId],
  );
  const totals = sumEntries(entries);
  const r = rates(totals);
  const months = byMonth(entries).map((m) => ({ month: m.month, value: m.totals[metric] }));
  const channels = [...groupBy(entries, (e) => e.channel).entries()].sort((a, b) => b[1].impressions - a[1].impressions);
  const top = topPublications(entries, state.publications);
  const digest = dataDigest(entries, state.campaigns);

  const saveEntry = () => {
    if (!editing) return;
    if (!editing.date) return toast('Indiquez une date.', 'error');
    if (METRIC_KEYS.some((k) => !Number.isFinite(editing[k]) || (k !== 'followersGained' && editing[k] < 0))) return toast('Les valeurs doivent être des nombres positifs.', 'error');
    if (editing.id && editing.createdAt) actions.updatePerformance(editing as PerformanceEntry);
    else actions.addPerformance([editing]);
    toast('Statistiques enregistrées');
    setEditing(null);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Espace marketing"
        title="Analyses"
        description={WORKSPACE_DESCRIPTIONS.analytics}
        actions={
          <>
            <Button icon="upload" onClick={() => setImporting(true)}>Importer un CSV</Button>
            <Button variant="primary" icon="plus" onClick={() => setEditing(blankEntry())}>Saisir des chiffres</Button>
          </>
        }
      />
      <div className="filters">
        <select className="input" value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Période">
          <option value="30">30 derniers jours</option>
          <option value="90">90 derniers jours</option>
          <option value="month">Mois en cours</option>
          <option value="lastmonth">Mois dernier</option>
          <option value="year">Année en cours</option>
          <option value="all">Toute la période</option>
        </select>
        <select className="input" value={channel} onChange={(e) => setChannel(e.target.value as Channel | 'tous')} aria-label="Canal">
          <option value="tous">Tous les canaux</option>
          {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
        </select>
        <select className="input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} aria-label="Campagne">
          <option value="tous">Toutes les campagnes</option>
          {state.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <Tabs
        label="Sections analyses"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: 'Vue d’ensemble' },
          { id: 'entries', label: 'Relevés', count: entries.length },
          { id: 'claude', label: 'Analyser avec Claude' },
        ]}
      />

      {tab === 'overview' &&
        (entries.length ? (
          <>
            <div className="stats stats-6">
              <div className="stat"><span className="stat-value">{formatNumber(totals.impressions)}</span><span className="stat-label">impressions</span></div>
              <div className="stat"><span className="stat-value">{formatNumber(totals.interactions)}</span><span className="stat-label">interactions</span></div>
              <div className="stat"><span className="stat-value">{formatPct(r.engagement)}</span><span className="stat-label">taux d’engagement</span></div>
              <div className="stat"><span className="stat-value">{formatNumber(totals.clicks)}</span><span className="stat-label">clics ({formatPct(r.ctr)})</span></div>
              <div className="stat"><span className="stat-value">{formatNumber(totals.enquiries)}</span><span className="stat-label">demandes</span></div>
              <div className="stat"><span className="stat-value">{formatNumber(totals.followersGained)}</span><span className="stat-label">nouveaux abonnés</span></div>
            </div>
            <section className="panel">
              <div className="panel-head">
                <h2>Évolution mensuelle</h2>
                <select className="input input-inline" value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)} aria-label="Indicateur du graphique">
                  {METRIC_KEYS.map((k) => <option key={k} value={k}>{METRIC_LABELS[k]}</option>)}
                </select>
              </div>
              <BarChart data={months} metric={metric} />
            </section>
            <div className="two-col">
              <section className="panel">
                <h2>Par canal</h2>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>Canal</th><th>Impressions</th><th>Engagement</th><th>Clics</th><th>Demandes</th></tr>
                    </thead>
                    <tbody>
                      {channels.map(([c, t]) => (
                        <tr key={c}>
                          <td>{CHANNEL_LABELS[c]}</td>
                          <td>{formatNumber(t.impressions)}</td>
                          <td>{formatPct(rates(t).engagement)}</td>
                          <td>{formatNumber(t.clicks)}</td>
                          <td>{formatNumber(t.enquiries)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel">
                <h2>Meilleures publications</h2>
                {top.length ? (
                  <ol className="top-list">
                    {top.map((x) => (
                      <li key={x.pub!.id}>
                        <strong className="clamp">{x.pub!.title}</strong>
                        <span className="small muted">{formatNumber(x.totals.interactions)} interactions · {formatPct(x.rate)}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="small muted">Associez vos relevés à des publications pour voir lesquelles fonctionnent le mieux.</p>
                )}
              </section>
            </div>
          </>
        ) : (
          <Empty title="Aucune statistique sur cette période" icon="chart" action={<Button variant="primary" icon="plus" onClick={() => setEditing(blankEntry())}>Saisir des chiffres</Button>}>
            Recopiez les chiffres de Meta Business Suite, LinkedIn ou Google Search Console, ou importez leur export CSV. Aucune connexion aux réseaux n’est nécessaire.
          </Empty>
        ))}

      {tab === 'entries' && (
        <>
          {entries.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th><th>Canal</th><th>Publication</th><th>Impr.</th><th>Inter.</th><th>Clics</th><th>Dem.</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {[...entries].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                    <tr key={e.id}>
                      <td>{formatShort(e.date)}</td>
                      <td>{CHANNEL_LABELS[e.channel]}</td>
                      <td className="clamp">{state.publications.find((p) => p.id === e.publicationId)?.title ?? <span className="muted">—</span>}</td>
                      <td>{formatNumber(e.impressions)}</td>
                      <td>{formatNumber(e.interactions)}</td>
                      <td>{formatNumber(e.clicks)}</td>
                      <td>{formatNumber(e.enquiries)}</td>
                      <td className="cell-actions">
                        <Button small variant="ghost" icon="edit" aria-label="Modifier le relevé" onClick={() => setEditing(e)} />
                        <Button
                          small
                          variant="ghost"
                          icon="trash"
                          aria-label="Supprimer le relevé"
                          onClick={async () => {
                            if (await confirm({ title: 'Supprimer le relevé', message: 'Ce relevé sera supprimé.', danger: true, confirmLabel: 'Supprimer' })) actions.deletePerformance(e.id);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Aucun relevé" icon="chart" />
          )}
          <div className="toolbar">
            <span />
            <Button small icon="download" disabled={!entries.length} onClick={() => downloadFile('vitrine-statistiques.csv', performanceCSV(entries, state.publications, state.campaigns), 'text/csv;charset=utf-8')}>
              Exporter en CSV
            </Button>
          </div>
        </>
      )}

      {tab === 'claude' && (
        <section className="panel">
          <p className="small muted">Les chiffres filtrés ci-dessus ({range.label}) sont déjà insérés dans le prompt.</p>
          <ClaudeAssistant key={digest} workspace="analytics" defaultTemplateId="p-analytics-review" presetValues={{ données: digest, période: range.label }} />
        </section>
      )}

      {editing && (
        <Modal title={editing.id ? 'Modifier le relevé' : 'Saisir des statistiques'} open onClose={() => setEditing(null)} footer={<><Button onClick={() => setEditing(null)}>Annuler</Button><Button variant="primary" onClick={saveEntry}>Enregistrer</Button></>}>
          <div className="stack">
            <div className="row2">
              <Field label="Date">
                <input className="input" type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
              </Field>
              <Field label="Canal">
                <select className="input" value={editing.channel} onChange={(e) => setEditing({ ...editing, channel: e.target.value as Channel })}>
                  {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
                </select>
              </Field>
            </div>
            <div className="row2">
              <Field label="Publication (facultatif)">
                <select
                  className="input"
                  value={editing.publicationId ?? ''}
                  onChange={(e) => {
                    const p = state.publications.find((x) => x.id === e.target.value);
                    setEditing({ ...editing, publicationId: p?.id ?? null, campaignId: p?.campaignId ?? editing.campaignId, channel: p?.channel ?? editing.channel });
                  }}
                >
                  <option value="">Aucune (chiffres globaux du compte)</option>
                  {state.publications.filter((p) => p.status === 'publie').map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </Field>
              <Field label="Campagne (facultatif)">
                <select className="input" value={editing.campaignId ?? ''} onChange={(e) => setEditing({ ...editing, campaignId: e.target.value || null })}>
                  <option value="">Aucune</option>
                  {state.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="metrics-grid">
              {METRIC_KEYS.map((k) => (
                <Field key={k} label={METRIC_LABELS[k]}>
                  <input className="input" type="number" inputMode="numeric" min={k === 'followersGained' ? undefined : 0} value={editing[k]} onChange={(e) => setEditing({ ...editing, [k]: Number(e.target.value) })} />
                </Field>
              ))}
            </div>
            <Field label="Notes">
              <input className="input" value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </Field>
          </div>
        </Modal>
      )}
      {importing && <CsvImport onClose={() => setImporting(false)} />}
    </div>
  );
}

function CsvImport({ onClose }: { onClose: () => void }) {
  const actions = useActions();
  const { toast } = useUI();
  const [text, setText] = useState('');
  const [channel, setChannel] = useState<Channel>('instagram');
  const result = text.trim() ? importPerformanceCSV(text, channel) : null;
  return (
    <Modal
      title="Importer des statistiques (CSV)"
      open
      wide
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            disabled={!result?.entries.length}
            onClick={() => {
              if (!result) return;
              actions.addPerformance(result.entries);
              toast(`${result.entries.length} relevé${result.entries.length > 1 ? 's' : ''} importé${result.entries.length > 1 ? 's' : ''}`);
              onClose();
            }}
          >
            Importer {result?.entries.length ?? 0} ligne{(result?.entries.length ?? 0) > 1 ? 's' : ''}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="small">
          Exportez vos statistiques depuis Meta Business Suite, LinkedIn ou un tableur (une ligne par jour ou par publication). Colonnes reconnues : date, canal/plateforme, vues/impressions, couverture, interactions (ou j’aime + commentaires + partages + enregistrements), clics, visites du profil, abonnés, demandes.
        </p>
        <div className="row2">
          <Field label="Fichier CSV">
            <input
              className="input"
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  setText(await readFileText(f, 5_000_000));
                } catch (err) {
                  toast((err as Error).message, 'error');
                }
              }}
            />
          </Field>
          <Field label="Canal si la colonne est absente">
            <select className="input" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
            </select>
          </Field>
        </div>
        <Field label="…ou collez le contenu">
          <textarea className="input mono" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Date;Plateforme;Vues;Interactions;Clics\n01/11/2026;Instagram;850;42;6'} />
        </Field>
        {result && (
          <div className="import-box">
            <strong>{result.entries.length} ligne{result.entries.length > 1 ? 's' : ''} prête{result.entries.length > 1 ? 's' : ''}</strong>
            {result.mapped.length > 0 && <p className="small muted">Colonnes reconnues : {result.mapped.map((m) => (m in METRIC_LABELS ? METRIC_LABELS[m as MetricKey] : m)).join(', ')}</p>}
            {result.warnings.slice(0, 5).map((w, i) => (
              <p key={i} className="small danger">{w}</p>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
