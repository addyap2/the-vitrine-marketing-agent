import { useState } from 'react';
import { useActions, useAppState } from '../state/store';
import { useEditor } from '../components/PublicationEditor';
import { Button, CampaignBadge, Empty, Field, Modal, PageHeader, Progress, StatusBadge, useUI } from '../components/ui';
import { ClaudeAssistant } from '../components/ClaudeAssistant';
import { PublicationList } from '../components/PublicationViews';
import { CAMPAIGN_STATUS_LABELS, CHANNEL_LABELS, STATUS_LABELS } from '../lib/labels';
import { CAMPAIGN_STATUSES, CHANNELS, PUB_STATUSES, type Campaign, type CampaignStatus } from '../lib/types';
import { CAMPAIGN_COLORS } from '../lib/defaults';
import { formatShort } from '../lib/dates';
import { formatNumber, formatPct, rates, sumEntries } from '../lib/metrics';
import { campaignsCSV } from '../lib/csv';
import { downloadFile, slug } from '../lib/download';
import { composeForPosting } from '../lib/qa';
import { href, navigate } from '../router';

type Draft = Partial<Campaign> & { name: string };

export function CampaignForm({ initial, onClose }: { initial: Draft; onClose: () => void }) {
  const actions = useActions();
  const { toast } = useUI();
  const [c, setC] = useState<Draft>(initial);
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setC((x) => ({ ...x, [k]: v }));
  const save = () => {
    if (!c.name.trim()) return toast('Donnez un nom à la campagne.', 'error');
    if (c.startDate && c.endDate && c.endDate < c.startDate) return toast('La date de fin précède la date de début.', 'error');
    const id = actions.saveCampaign({ ...c, name: c.name.trim() });
    toast(initial.id ? 'Campagne enregistrée' : 'Campagne créée');
    onClose();
    if (!initial.id) navigate(`campagnes/${id}`);
  };
  return (
    <Modal title={initial.id ? 'Modifier la campagne' : 'Nouvelle campagne'} open wide onClose={onClose} footer={<><Button onClick={onClose}>Annuler</Button><Button variant="primary" onClick={save}>Enregistrer</Button></>}>
      <div className="stack">
        <div className="row2">
          <Field label="Nom">
            <input className="input" value={c.name} onChange={(e) => set('name', e.target.value)} autoFocus placeholder="Ex. Refonte de printemps — artisans du Var" />
          </Field>
          <Field label="Statut">
            <select className="input" value={c.status ?? 'idee'} onChange={(e) => set('status', e.target.value as CampaignStatus)}>
              {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{CAMPAIGN_STATUS_LABELS[s]}</option>)}
            </select>
          </Field>
        </div>
        <div className="row3">
          <Field label="Début">
            <input className="input" type="date" value={c.startDate ?? ''} onChange={(e) => set('startDate', e.target.value || null)} />
          </Field>
          <Field label="Fin">
            <input className="input" type="date" value={c.endDate ?? ''} onChange={(e) => set('endDate', e.target.value || null)} />
          </Field>
          <Field label="Couleur">
            <div className="color-row" role="radiogroup" aria-label="Couleur de la campagne">
              {CAMPAIGN_COLORS.map((col) => (
                <button key={col} type="button" role="radio" aria-checked={c.color === col} aria-label={col} className={`color-dot${c.color === col ? ' active' : ''}`} style={{ background: col }} onClick={() => set('color', col)} />
              ))}
            </div>
          </Field>
        </div>
        <Field label="Objectif">
          <input className="input" value={c.objective ?? ''} onChange={(e) => set('objective', e.target.value)} placeholder="Ex. obtenir 8 demandes de devis de refonte" />
        </Field>
        <div className="row2">
          <Field label="Cible">
            <input className="input" value={c.audience ?? ''} onChange={(e) => set('audience', e.target.value)} />
          </Field>
          <Field label="Indicateur visé">
            <input className="input" value={c.kpiTarget ?? ''} onChange={(e) => set('kpiTarget', e.target.value)} placeholder="Ex. 8 demandes, 2 % de clics" />
          </Field>
        </div>
        <Field label="Message clé">
          <input className="input" value={c.keyMessage ?? ''} onChange={(e) => set('keyMessage', e.target.value)} />
        </Field>
        <fieldset className="checks">
          <legend className="field-label">Canaux</legend>
          <div className="chip-select">
            {CHANNELS.map((ch) => {
              const on = c.channels?.includes(ch);
              return (
                <button key={ch} type="button" aria-pressed={on} className={`chip-toggle${on ? ' active' : ''}`} onClick={() => set('channels', on ? (c.channels ?? []).filter((x) => x !== ch) : [...(c.channels ?? []), ch])}>
                  {CHANNEL_LABELS[ch]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Field label="Notes">
          <textarea className="input" rows={3} value={c.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function CampaignsView() {
  const state = useAppState();
  const [status, setStatus] = useState<CampaignStatus | 'tous'>('tous');
  const [form, setForm] = useState<Draft | null>(null);
  const list = state.campaigns.filter((c) => status === 'tous' || c.status === status).sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
  return (
    <div className="page">
      <PageHeader
        eyebrow="Pilotage"
        title="Campagnes"
        description="Regroupez publications, objectifs et statistiques autour d’un objectif commercial."
        actions={
          <>
            <Button icon="download" disabled={!state.campaigns.length} onClick={() => downloadFile('vitrine-campagnes.csv', campaignsCSV(state.campaigns, state.publications), 'text/csv;charset=utf-8')}>CSV</Button>
            <Button variant="primary" icon="plus" onClick={() => setForm({ name: '', status: 'planifiee', channels: ['instagram', 'facebook'] })}>Nouvelle campagne</Button>
          </>
        }
      />
      <div className="toolbar">
        <select className="input input-inline" value={status} onChange={(e) => setStatus(e.target.value as CampaignStatus | 'tous')} aria-label="Filtrer par statut">
          <option value="tous">Tous les statuts</option>
          {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{CAMPAIGN_STATUS_LABELS[s]}</option>)}
        </select>
      </div>
      {list.length ? (
        <div className="campaign-grid">
          {list.map((c) => {
            const pubs = state.publications.filter((p) => p.campaignId === c.id && p.status !== 'archive');
            const published = pubs.filter((p) => p.status === 'publie').length;
            const waiting = pubs.filter((p) => p.status === 'relecture').length;
            return (
              <a key={c.id} href={href(`campagnes/${c.id}`)} className="campaign-card" style={{ borderTopColor: c.color }}>
                <div className="row-between">
                  <CampaignBadge status={c.status} />
                  <span className="small muted">{c.startDate ? formatShort(c.startDate) : '—'} → {c.endDate ? formatShort(c.endDate) : '—'}</span>
                </div>
                <h3>{c.name}</h3>
                {c.objective && <p className="small clamp-2">{c.objective}</p>}
                <div className="small muted">{c.channels.map((x) => CHANNEL_LABELS[x]).join(' · ') || 'Aucun canal'}</div>
                <Progress value={pubs.length ? published / pubs.length : 0} label={`Avancement de ${c.name}`} />
                <div className="small">
                  {published}/{pubs.length} publiées{waiting > 0 && <span className="warn"> · {waiting} à valider</span>}
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <Empty title="Aucune campagne" icon="megaphone" action={<Button variant="primary" icon="plus" onClick={() => setForm({ name: '', status: 'planifiee', channels: ['instagram', 'facebook'] })}>Créer une campagne</Button>}>
          Une campagne donne un cap : un objectif, une cible, une période et les publications qui la servent.
        </Empty>
      )}
      {form && <CampaignForm initial={form} onClose={() => setForm(null)} />}
    </div>
  );
}

export function CampaignDetail({ id }: { id: string }) {
  const state = useAppState();
  const actions = useActions();
  const { confirm, toast } = useUI();
  const { newPublication } = useEditor();
  const [form, setForm] = useState<Draft | null>(null);
  const [showClaude, setShowClaude] = useState(false);
  const c = state.campaigns.find((x) => x.id === id);
  if (!c) return <Empty title="Campagne introuvable" icon="alert" action={<a className="btn btn-secondary" href={href('campagnes')}>Retour aux campagnes</a>} />;
  const pubs = state.publications.filter((p) => p.campaignId === c.id);
  const totals = sumEntries(state.performance.filter((e) => e.campaignId === c.id));
  const r = rates(totals);

  const exportBrief = () => {
    const lines = [
      `# ${c.name}`,
      '',
      `- Statut : ${CAMPAIGN_STATUS_LABELS[c.status]}`,
      `- Période : ${c.startDate ?? '?'} → ${c.endDate ?? '?'}`,
      c.objective && `- Objectif : ${c.objective}`,
      c.audience && `- Cible : ${c.audience}`,
      c.keyMessage && `- Message clé : ${c.keyMessage}`,
      c.kpiTarget && `- Indicateur visé : ${c.kpiTarget}`,
      `- Canaux : ${c.channels.map((x) => CHANNEL_LABELS[x]).join(', ')}`,
      c.notes && `\n${c.notes}`,
      '',
      `## Publications (${pubs.length})`,
      ...pubs
        .sort((a, b) => (a.scheduledDate ?? '9').localeCompare(b.scheduledDate ?? '9'))
        .flatMap((p) => ['', `### ${p.scheduledDate ?? 'Non planifiée'} — ${p.title}`, `${CHANNEL_LABELS[p.channel]} · ${STATUS_LABELS[p.status]}`, '', composeForPosting(p), p.visualBrief && `\n> Visuel : ${p.visualBrief.replace(/\n/g, '\n> ')}`]),
    ];
    downloadFile(`campagne-${slug(c.name)}.md`, lines.filter((l): l is string => typeof l === 'string').join('\n'), 'text/markdown;charset=utf-8');
  };

  return (
    <div className="page">
      <a className="link back" href={href('campagnes')}>← Campagnes</a>
      <PageHeader
        eyebrow={CAMPAIGN_STATUS_LABELS[c.status]}
        title={c.name}
        description={c.objective || undefined}
        actions={
          <>
            <Button icon="download" onClick={exportBrief}>Brief (.md)</Button>
            <Button icon="edit" onClick={() => setForm(c)}>Modifier</Button>
            <Button
              variant="ghost"
              icon="trash"
              aria-label="Supprimer la campagne"
              onClick={async () => {
                if (await confirm({ title: 'Supprimer la campagne', message: `« ${c.name} » sera supprimée. Les publications associées seront conservées, sans campagne.`, danger: true, confirmLabel: 'Supprimer' })) {
                  actions.deleteCampaign(c.id);
                  toast('Campagne supprimée');
                  navigate('campagnes');
                }
              }}
            />
          </>
        }
      />
      <div className="detail-grid">
        <section className="panel">
          <dl className="facts">
            <div><dt>Période</dt><dd>{c.startDate ? formatShort(c.startDate) : '—'} → {c.endDate ? formatShort(c.endDate) : '—'}</dd></div>
            <div><dt>Cible</dt><dd>{c.audience || '—'}</dd></div>
            <div><dt>Message clé</dt><dd>{c.keyMessage || '—'}</dd></div>
            <div><dt>Indicateur visé</dt><dd>{c.kpiTarget || '—'}</dd></div>
            <div><dt>Canaux</dt><dd>{c.channels.map((x) => CHANNEL_LABELS[x]).join(', ') || '—'}</dd></div>
          </dl>
          {c.notes && <p className="small pre">{c.notes}</p>}
        </section>
        <section className="panel">
          <h2>Résultats saisis</h2>
          {totals.entries ? (
            <dl className="facts">
              <div><dt>Impressions</dt><dd>{formatNumber(totals.impressions)}</dd></div>
              <div><dt>Interactions</dt><dd>{formatNumber(totals.interactions)} ({formatPct(r.engagement)})</dd></div>
              <div><dt>Clics</dt><dd>{formatNumber(totals.clicks)}</dd></div>
              <div><dt>Demandes</dt><dd>{formatNumber(totals.enquiries)}</dd></div>
            </dl>
          ) : (
            <p className="small muted">Aucune statistique rattachée. Saisissez-les dans <a className="link" href={href('analyses')}>Analyses</a>.</p>
          )}
          <div className="status-counts">
            {PUB_STATUSES.filter((s) => pubs.some((p) => p.status === s)).map((s) => (
              <span key={s}>
                <StatusBadge status={s} /> {pubs.filter((p) => p.status === s).length}
              </span>
            ))}
          </div>
        </section>
      </div>
      <div className="toolbar">
        <h2>Publications</h2>
        <div className="inline-actions">
          <Button icon="sparkles" onClick={() => setShowClaude((v) => !v)}>{showClaude ? 'Masquer Claude' : 'Idées avec Claude'}</Button>
          <Button variant="primary" icon="plus" onClick={() => newPublication({ workspace: 'social', campaignId: c.id, channel: c.channels[0] ?? 'instagram' })}>Ajouter</Button>
        </div>
      </div>
      {showClaude && (
        <section className="panel">
          <ClaudeAssistant compact defaultTemplateId="p-strategy-ideas" defaultCampaignId={c.id} presetValues={{ canaux: c.channels.map((x) => CHANNEL_LABELS[x]).join(', '), nombre: '8' }} />
        </section>
      )}
      <PublicationList pubs={pubs} empty={<Empty title="Aucune publication dans cette campagne" icon="list" />} />
      {form && <CampaignForm initial={form} onClose={() => setForm(null)} />}
    </div>
  );
}
