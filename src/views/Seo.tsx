import { useState } from 'react';
import { useActions, useAppState } from '../state/store';
import { Button, CopyButton, Empty, Field, Modal, PageHeader, Progress, Tabs, useUI } from '../components/ui';
import { ClaudeAssistant } from '../components/ClaudeAssistant';
import { NewPublicationButton, PublicationList } from '../components/PublicationViews';
import { TemplatePickerButton } from '../components/TemplatePicker';
import { INTENT_LABELS, KEYWORD_STATUS_LABELS, WORKSPACE_DESCRIPTIONS } from '../lib/labels';
import { KEYWORD_INTENTS, type Keyword, type KeywordIntent } from '../lib/types';
import { GEO_CHECKLIST, checklistProgress, descriptionCheck, displayUrl, faqJsonLd, localBusinessJsonLd, titleCheck, truncateSerp, type LengthCheck } from '../lib/seo';
import { formatShort, today } from '../lib/dates';
import { toCSV } from '../lib/csv';
import { downloadFile } from '../lib/download';

type Tab = 'keywords' | 'serp' | 'geo' | 'schema' | 'content' | 'claude';

export function SeoView() {
  const state = useAppState();
  const [tab, setTab] = useState<Tab>('keywords');
  const progress = checklistProgress(state.seo.checks);
  const seoPubs = state.publications.filter((p) => p.workspace === 'seo' || p.channel === 'blog' || p.channel === 'google');
  return (
    <div className="page">
      <PageHeader eyebrow="Espace marketing" title="SEO & GEO" description={WORKSPACE_DESCRIPTIONS.seo} />
      <Tabs
        label="Outils SEO"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'keywords', label: 'Mots-clés', count: state.seo.keywords.length },
          { id: 'serp', label: 'Aperçu Google' },
          { id: 'geo', label: `Checklist ${progress.done}/${progress.total}` },
          { id: 'schema', label: 'Données structurées' },
          { id: 'content', label: 'Contenus', count: seoPubs.filter((p) => p.status !== 'archive').length },
          { id: 'claude', label: 'Avec Claude' },
        ]}
      />
      {tab === 'keywords' && <Keywords />}
      {tab === 'serp' && <SerpPreview />}
      {tab === 'geo' && <GeoChecklist />}
      {tab === 'schema' && <StructuredData />}
      {tab === 'content' && (
        <>
          <div className="toolbar">
            <span className="small muted">Articles de blog, pages et actualités de la fiche Google.</span>
            <div className="inline-actions">
              <TemplatePickerButton workspace="seo" />
              <NewPublicationButton workspace="seo" label="Nouvel article" defaults={{ channel: 'blog', format: 'article' }} />
            </div>
          </div>
          <PublicationList pubs={seoPubs.filter((p) => p.status !== 'archive')} />
        </>
      )}
      {tab === 'claude' && (
        <section className="panel">
          <ClaudeAssistant workspace="seo" />
        </section>
      )}
    </div>
  );
}

function Sparkline({ positions }: { positions: Keyword['positions'] }) {
  if (positions.length < 2) return null;
  const last = positions.slice(-12);
  const max = Math.max(...last.map((p) => p.position), 10);
  const pts = last.map((p, i) => `${(i / (last.length - 1)) * 60},${(p.position / max) * 20}`).join(' ');
  return (
    <svg className="sparkline" width="60" height="22" viewBox="-1 -1 62 22" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Keywords() {
  const state = useAppState();
  const actions = useActions();
  const { toast, confirm } = useUI();
  const [kw, setKw] = useState('');
  const [intent, setIntent] = useState<KeywordIntent>('locale');
  const [editing, setEditing] = useState<Keyword | null>(null);
  const [pos, setPos] = useState({ date: today(), position: '' });
  const list = [...state.seo.keywords].sort((a, b) => a.priority - b.priority || a.keyword.localeCompare(b.keyword));

  const exportCsv = () =>
    downloadFile(
      'vitrine-mots-cles.csv',
      toCSV(
        ['Mot-clé', 'Intention', 'Priorité', 'Statut', 'Page cible', 'Dernière position', 'Date', 'Notes'],
        list.map((k) => {
          const last = k.positions.at(-1);
          return [k.keyword, INTENT_LABELS[k.intent], k.priority, KEYWORD_STATUS_LABELS[k.status], k.targetUrl, last?.position ?? '', last?.date ?? '', k.notes];
        }),
      ),
      'text/csv;charset=utf-8',
    );

  return (
    <>
      <form
        className="inline-form panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (!kw.trim()) return;
          actions.addKeywords([{ keyword: kw, intent, targetUrl: '', priority: 2, notes: '' }]);
          setKw('');
          toast('Mot-clé ajouté');
        }}
      >
        <input className="input" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="Ajouter un mot-clé, ex. création site internet Fréjus" aria-label="Nouveau mot-clé" />
        <select className="input input-inline" value={intent} onChange={(e) => setIntent(e.target.value as KeywordIntent)} aria-label="Intention">
          {KEYWORD_INTENTS.map((i) => <option key={i} value={i}>{INTENT_LABELS[i]}</option>)}
        </select>
        <Button variant="primary" icon="plus" type="submit">Ajouter</Button>
      </form>
      {list.length ? (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mot-clé</th>
                  <th>Intention</th>
                  <th>Priorité</th>
                  <th>Statut</th>
                  <th>Position</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((k) => {
                  const last = k.positions.at(-1);
                  const prev = k.positions.at(-2);
                  const delta = last && prev ? prev.position - last.position : 0;
                  return (
                    <tr key={k.id}>
                      <td>
                        <strong>{k.keyword}</strong>
                        {k.targetUrl && <div className="small muted clamp">{k.targetUrl}</div>}
                      </td>
                      <td>{INTENT_LABELS[k.intent]}</td>
                      <td>
                        <span className={`prio prio-${k.priority}`}>P{k.priority}</span>
                      </td>
                      <td>{KEYWORD_STATUS_LABELS[k.status]}</td>
                      <td>
                        {last ? (
                          <span className="pos">
                            <strong>{last.position}</strong>
                            {delta !== 0 && <span className={delta > 0 ? 'up' : 'down'}>{delta > 0 ? `▲${delta}` : `▼${-delta}`}</span>}
                            <Sparkline positions={k.positions} />
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="cell-actions">
                        <Button small variant="ghost" icon="edit" aria-label={`Modifier ${k.keyword}`} onClick={() => setEditing(k)} />
                        <Button
                          small
                          variant="ghost"
                          icon="trash"
                          aria-label={`Supprimer ${k.keyword}`}
                          onClick={async () => {
                            if (await confirm({ title: 'Supprimer le mot-clé', message: `« ${k.keyword} » et son historique seront supprimés.`, danger: true, confirmLabel: 'Supprimer' })) actions.deleteKeyword(k.id);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="toolbar">
            <p className="small muted">Relevez les positions gratuitement dans Google Search Console (Performances › Requêtes) ou par une recherche en navigation privée.</p>
            <Button small icon="download" onClick={exportCsv}>Exporter en CSV</Button>
          </div>
        </>
      ) : (
        <Empty title="Aucun mot-clé suivi" icon="search">Ajoutez vos requêtes cibles ou demandez une liste à Claude (onglet « Avec Claude »).</Empty>
      )}
      {editing && (
        <Modal
          title={editing.keyword}
          open
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button onClick={() => setEditing(null)}>Annuler</Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (!editing.keyword.trim()) return toast('Le mot-clé est vide.', 'error');
                  actions.saveKeyword(editing);
                  toast('Mot-clé enregistré');
                  setEditing(null);
                }}
              >
                Enregistrer
              </Button>
            </>
          }
        >
          <div className="stack">
            <Field label="Mot-clé">
              <input className="input" value={editing.keyword} onChange={(e) => setEditing({ ...editing, keyword: e.target.value })} />
            </Field>
            <div className="row3">
              <Field label="Intention">
                <select className="input" value={editing.intent} onChange={(e) => setEditing({ ...editing, intent: e.target.value as KeywordIntent })}>
                  {KEYWORD_INTENTS.map((i) => <option key={i} value={i}>{INTENT_LABELS[i]}</option>)}
                </select>
              </Field>
              <Field label="Priorité">
                <select className="input" value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) as 1 | 2 | 3 })}>
                  <option value={1}>1 — haute</option>
                  <option value={2}>2 — moyenne</option>
                  <option value={3}>3 — basse</option>
                </select>
              </Field>
              <Field label="Statut">
                <select className="input" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as Keyword['status'] })}>
                  {Object.entries(KEYWORD_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Page cible">
              <input className="input" value={editing.targetUrl} onChange={(e) => setEditing({ ...editing, targetUrl: e.target.value })} placeholder="/creation-site-internet/" />
            </Field>
            <Field label="Notes">
              <textarea className="input" rows={3} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </Field>
            <fieldset className="checks">
              <legend className="field-label">Relevé de position</legend>
              <div className="inline-form">
                <input className="input" type="date" value={pos.date} onChange={(e) => setPos({ ...pos, date: e.target.value })} aria-label="Date du relevé" />
                <input className="input" type="number" min={1} max={1000} value={pos.position} onChange={(e) => setPos({ ...pos, position: e.target.value })} placeholder="Position" aria-label="Position" />
                <Button
                  onClick={() => {
                    const n = Number(pos.position);
                    if (!pos.date || !Number.isInteger(n) || n < 1 || n > 1000) return toast('Position entre 1 et 1000 et date requises.', 'error');
                    actions.addPosition(editing.id, pos.date, n);
                    setEditing({ ...editing, positions: [...editing.positions.filter((p) => p.date !== pos.date), { date: pos.date, position: n }].sort((a, b) => a.date.localeCompare(b.date)) });
                    setPos({ ...pos, position: '' });
                  }}
                >
                  Ajouter
                </Button>
              </div>
              {editing.positions.length > 0 && (
                <ul className="positions">
                  {[...editing.positions].reverse().map((p) => (
                    <li key={p.date}>
                      {formatShort(p.date)} : <strong>{p.position}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          </div>
        </Modal>
      )}
    </>
  );
}

function LengthHint({ c }: { c: LengthCheck }) {
  return (
    <span className={`len len-${c.level}`}>
      {c.length} caractères · idéal {c.min}–{c.max}
      {c.level === 'court' ? ' · trop court' : c.level === 'long' ? ' · sera tronqué' : ' · bien'}
    </span>
  );
}

function SerpPreview() {
  const state = useAppState();
  const articles = state.publications.filter((p) => p.format === 'article' || p.format === 'page');
  const [title, setTitle] = useState('Création de site internet à Fréjus | The Vitrine');
  const [desc, setDesc] = useState('Sites rapides et soignés pour artisans, commerçants et associations du Var. Parlons de votre projet et recevez une proposition claire.');
  const [url, setUrl] = useState(`${state.brand.website.replace(/\/$/, '')}/creation-site-internet-frejus-saint-raphael/`);
  return (
    <div className="two-col">
      <section className="panel stack">
        {articles.length > 0 && (
          <Field label="Charger depuis un article" hint="Utilise l’accroche comme title et l’appel à l’action comme meta description (convention des briefs Claude).">
            <select
              className="input"
              defaultValue=""
              onChange={(e) => {
                const a = articles.find((x) => x.id === e.target.value);
                if (a) {
                  setTitle(a.hook || a.title);
                  setDesc(a.cta);
                }
              }}
            >
              <option value="" disabled>Choisir…</option>
              {articles.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </Field>
        )}
        <Field label="Balise title" hint={<LengthHint c={titleCheck(title)} />}>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Meta description" hint={<LengthHint c={descriptionCheck(desc)} />}>
          <textarea className="input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <Field label="Adresse de la page">
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
      </section>
      <section className="panel">
        <h2>Aperçu approximatif</h2>
        <div className="serp">
          <div className="serp-site">
            <span className="serp-favicon" aria-hidden="true">V</span>
            <span>
              <span className="serp-name">{state.brand.name}</span>
              <span className="serp-url">{displayUrl(url)}</span>
            </span>
          </div>
          <div className="serp-title">{truncateSerp(title, 60)}</div>
          <div className="serp-desc">{truncateSerp(desc, 155)}</div>
        </div>
        <p className="small muted">Google réécrit parfois ces textes et tronque selon la largeur en pixels : ces limites sont indicatives.</p>
        <CopyButton text={`<title>${title}</title>\n<meta name="description" content="${desc.replace(/"/g, '&quot;')}">`} label="Copier les balises HTML" />
      </section>
    </div>
  );
}

function GeoChecklist() {
  const state = useAppState();
  const actions = useActions();
  const progress = checklistProgress(state.seo.checks);
  return (
    <>
      <section className="panel">
        <div className="row-between">
          <strong>Progression</strong>
          <span>
            {progress.done} / {progress.total}
          </span>
        </div>
        <Progress value={progress.done / progress.total} label="Progression de la checklist SEO et GEO" />
        <p className="small muted">GEO : être compris et cité par les moteurs de réponse (Google AI Overviews, ChatGPT, Perplexity, Gemini). Toutes ces actions sont gratuites.</p>
      </section>
      <div className="check-groups">
        {GEO_CHECKLIST.map((g) => (
          <section key={g.title} className="panel">
            <h2>{g.title}</h2>
            <ul className="geo-list">
              {g.items.map((i) => (
                <li key={i.id}>
                  <label className="checkbox">
                    <input type="checkbox" checked={!!state.seo.checks[i.id]} onChange={() => actions.toggleCheck(i.id)} />
                    <span>
                      <strong>{i.label}</strong>
                      <span className="small muted">{i.help}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function StructuredData() {
  const { brand } = useAppState();
  const [pairs, setPairs] = useState([
    { q: 'Combien de temps faut-il pour créer un site internet ?', a: '' },
    { q: 'Intervenez-vous en dehors du Var ?', a: '' },
  ]);
  const [info, setInfo] = useState({ phone: '', street: '', postalCode: '', city: 'Fréjus', areas: 'Fréjus, Saint-Raphaël, Var, Alpes-Maritimes' });
  return (
    <div className="two-col">
      <section className="panel stack">
        <h2>FAQ (FAQPage)</h2>
        {pairs.map((p, i) => (
          <div key={i} className="faq-pair">
            <Field label={`Question ${i + 1}`}>
              <input className="input" value={p.q} onChange={(e) => setPairs(pairs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
            </Field>
            <Field label="Réponse">
              <textarea className="input" rows={2} value={p.a} onChange={(e) => setPairs(pairs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
            </Field>
            <Button small variant="ghost" icon="trash" onClick={() => setPairs(pairs.filter((_, j) => j !== i))}>Retirer</Button>
          </div>
        ))}
        <Button small icon="plus" onClick={() => setPairs([...pairs, { q: '', a: '' }])}>Ajouter une question</Button>
        <div className="preview mono">{faqJsonLd(pairs)}</div>
        <CopyButton text={faqJsonLd(pairs)} label="Copier le code" variant="primary" />
      </section>
      <section className="panel stack">
        <h2>Entreprise locale (ProfessionalService)</h2>
        <p className="small muted">Nom, site, description et services viennent du profil de marque. Ne renseignez que des informations exactes et identiques à la fiche Google.</p>
        <div className="row2">
          <Field label="Téléphone">
            <input className="input" value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} />
          </Field>
          <Field label="Ville">
            <input className="input" value={info.city} onChange={(e) => setInfo({ ...info, city: e.target.value })} />
          </Field>
        </div>
        <div className="row2">
          <Field label="Adresse">
            <input className="input" value={info.street} onChange={(e) => setInfo({ ...info, street: e.target.value })} />
          </Field>
          <Field label="Code postal">
            <input className="input" value={info.postalCode} onChange={(e) => setInfo({ ...info, postalCode: e.target.value })} />
          </Field>
        </div>
        <Field label="Zones desservies (séparées par des virgules)">
          <input className="input" value={info.areas} onChange={(e) => setInfo({ ...info, areas: e.target.value })} />
        </Field>
        <div className="preview mono">{localBusinessJsonLd(brand, info)}</div>
        <CopyButton text={localBusinessJsonLd(brand, info)} label="Copier le code" variant="primary" />
        <p className="small muted">À coller dans le &lt;head&gt; de la page, puis à vérifier avec le test des résultats enrichis de Google (gratuit).</p>
      </section>
    </div>
  );
}
