import { useMemo, useState } from 'react';
import { useAppState } from '../state/store';
import { useEditor } from './PublicationEditor';
import { Button, Field, Modal } from './ui';
import { extractPlaceholders, placeholderLabel, renderTemplate } from '../lib/templates';
import { CHANNEL_LABELS, FORMAT_LABELS } from '../lib/labels';
import type { WorkspaceId } from '../lib/types';

/** Creates a publication from an offline content template (no AI needed). */
export function TemplatePickerButton({ workspace, label = 'Depuis un modèle' }: { workspace?: WorkspaceId; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon="template" onClick={() => setOpen(true)}>{label}</Button>
      {open && <TemplatePicker workspace={workspace} onClose={() => setOpen(false)} />}
    </>
  );
}

function TemplatePicker({ workspace, onClose }: { workspace?: WorkspaceId; onClose: () => void }) {
  const state = useAppState();
  const { newPublication } = useEditor();
  const list = state.templates.filter((t) => t.kind === 'contenu');
  const sorted = workspace ? [...list.filter((t) => t.workspace === workspace), ...list.filter((t) => t.workspace !== workspace)] : list;
  const [id, setId] = useState(sorted[0]?.id ?? '');
  const tpl = list.find((t) => t.id === id);
  const [values, setValues] = useState<Record<string, string>>({});
  const fields = useMemo(() => (tpl ? extractPlaceholders(tpl.body) : []), [tpl]);
  const preview = tpl ? renderTemplate(tpl.body, values, state.brand) : '';

  return (
    <Modal
      title="Créer depuis un modèle"
      open
      wide
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            disabled={!tpl}
            onClick={() => {
              if (!tpl) return;
              onClose();
              newPublication({
                title: `${tpl.name}${values.sujet ? ` — ${values.sujet}` : ''}`,
                workspace: workspace ?? tpl.workspace,
                channel: tpl.channel ?? 'instagram',
                format: tpl.format ?? 'post',
                body: preview,
                cta: '',
                source: 'modele',
              });
            }}
          >
            Utiliser ce modèle
          </Button>
        </>
      }
    >
      {list.length === 0 ? (
        <p className="muted">Aucun modèle de contenu. Créez-en dans « Modèles ».</p>
      ) : (
        <div className="picker">
          <div className="picker-list" role="listbox" aria-label="Modèles de contenu">
            {sorted.map((t) => (
              <button key={t.id} type="button" role="option" aria-selected={t.id === id} className={t.id === id ? 'active' : ''} onClick={() => setId(t.id)}>
                <strong>{t.name}</strong>
                <span className="small muted">
                  {t.channel ? CHANNEL_LABELS[t.channel] : 'Tous canaux'} · {t.format ? FORMAT_LABELS[t.format] : 'Libre'}
                </span>
              </button>
            ))}
          </div>
          <div className="stack">
            {tpl?.description && <p className="small muted">{tpl.description}</p>}
            {fields.map((f) => (
              <Field key={f} label={placeholderLabel(f)}>
                <input className="input" value={values[f] ?? ''} onChange={(e) => setValues({ ...values, [f]: e.target.value })} />
              </Field>
            ))}
            <div className="preview tall">{preview}</div>
            <p className="small muted">Les modèles fonctionnent hors ligne, sans IA. Les crochets [ … ] signalent ce qu’il reste à compléter.</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
