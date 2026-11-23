import { useState } from 'react';
import { useActions, useAppState } from '../state/store';
import { Button, CopyButton, Empty, Modal, PageHeader, Tabs, useUI } from '../components/ui';
import { Icon } from '../components/Icon';
import { ClaudeAssistant } from '../components/ClaudeAssistant';
import { CLAUDE_URL } from '../lib/prompts';
import { WORKSPACE_LABELS } from '../lib/labels';
import { formatDateTime } from '../lib/dates';
import type { ClaudeSession } from '../lib/types';

export function ClaudeView() {
  const state = useAppState();
  const actions = useActions();
  const { confirm } = useUI();
  const [tab, setTab] = useState<'new' | 'history' | 'guide'>('new');
  const [viewing, setViewing] = useState<ClaudeSession | null>(null);
  const sessions = [...state.claude].reverse();

  return (
    <div className="page">
      <PageHeader
        eyebrow="Outils"
        title="Atelier Claude"
        description="Votre abonnement Claude Pro, sans API ni surcoût : l’application prépare un prompt complet avec le contexte de marque, vous le collez dans claude.ai, puis vous collez la réponse ici pour l’importer."
        actions={
          <a className="btn btn-secondary" href={CLAUDE_URL} target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={17} /> <span>Ouvrir claude.ai</span>
          </a>
        }
      />
      <Tabs
        label="Atelier Claude"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'new', label: 'Nouveau prompt' },
          { id: 'history', label: 'Historique', count: sessions.length },
          { id: 'guide', label: 'Mode d’emploi' },
        ]}
      />
      {tab === 'new' && (
        <section className="panel">
          <ClaudeAssistant />
        </section>
      )}
      {tab === 'history' &&
        (sessions.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Modèle</th><th>Espace</th><th>Importés</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{formatDateTime(s.createdAt)}</td>
                    <td>{s.title}</td>
                    <td>{WORKSPACE_LABELS[s.workspace]}</td>
                    <td>{s.importedCount}</td>
                    <td className="cell-actions">
                      <Button small variant="ghost" onClick={() => setViewing(s)}>Voir</Button>
                      <Button
                        small
                        variant="ghost"
                        icon="trash"
                        aria-label="Supprimer de l’historique"
                        onClick={async () => {
                          if (await confirm({ title: 'Supprimer de l’historique', message: 'Le prompt et la réponse seront supprimés de l’historique (les éléments importés sont conservés).', danger: true, confirmLabel: 'Supprimer' })) actions.deleteSession(s.id);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Aucun échange enregistré" icon="sparkles">Chaque réponse analysée est conservée ici (100 dernières).</Empty>
        ))}
      {tab === 'guide' && <Guide />}
      {viewing && (
        <Modal title={viewing.title} open wide onClose={() => setViewing(null)} footer={<Button onClick={() => setViewing(null)}>Fermer</Button>}>
          <div className="stack">
            <div className="row-between">
              <strong>Prompt</strong>
              <CopyButton small text={viewing.prompt} />
            </div>
            <div className="preview mono tall">{viewing.prompt}</div>
            <div className="row-between">
              <strong>Réponse</strong>
              <CopyButton small text={viewing.response} />
            </div>
            <div className="preview tall">{viewing.response || <span className="muted">Aucune réponse collée.</span>}</div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Guide() {
  return (
    <div className="guide">
      <section className="panel">
        <h2>Le principe</h2>
        <p>
          Claude Pro est un abonnement à l’interface claude.ai : il ne donne <strong>pas</strong> accès à l’API Claude, qui est facturée séparément. Cette application n’appelle donc aucune IA. Elle fait le travail fastidieux autour : contexte de marque, consignes de qualité, format de réponse, puis import des résultats dans vos campagnes, publications, mots-clés ou documents.
        </p>
      </section>
      <section className="panel">
        <h2>En 4 étapes</h2>
        <ol className="guide-steps">
          <li><strong>Préparer.</strong> Choisissez un modèle de prompt (ou créez le vôtre dans « Modèles »), remplissez les champs, rattachez éventuellement une campagne.</li>
          <li><strong>Copier.</strong> Copiez le prompt et collez-le dans une nouvelle conversation sur claude.ai. Astuce : créez un <em>Projet</em> Claude « The Vitrine » pour garder vos échanges groupés.</li>
          <li><strong>Récupérer.</strong> Sous la réponse de Claude, utilisez le bouton « Copier » (il copie toute la réponse, bloc JSON compris).</li>
          <li><strong>Importer.</strong> Collez la réponse, cliquez sur « Analyser », cochez ce que vous gardez. Les publications arrivent en brouillon : elles passent ensuite par la relecture et l’approbation.</li>
        </ol>
      </section>
      <section className="panel">
        <h2>Si l’import échoue</h2>
        <ul>
          <li>Vérifiez que vous avez collé la réponse <strong>entière</strong>, y compris le bloc qui commence par <code>```json</code>.</li>
          <li>Demandez à Claude : « Redonne uniquement le bloc JSON demandé, sans texte autour. »</li>
          <li>Pour une réponse libre, utilisez « Enregistrer la réponse comme une publication ».</li>
        </ul>
      </section>
      <section className="panel">
        <h2>Améliorer une publication existante</h2>
        <p>Dans chaque fiche de publication, l’onglet « Améliorer avec Claude » prépare un prompt de réécriture avec le texte actuel. La proposition remplace le texte dans l’éditeur ; l’ancienne version reste restaurable dans l’historique.</p>
      </section>
      <section className="panel">
        <h2>Confidentialité</h2>
        <p>Rien n’est envoyé par l’application : c’est vous qui choisissez ce que vous collez dans Claude. N’y collez pas de données personnelles de clients sans leur accord.</p>
      </section>
    </div>
  );
}
