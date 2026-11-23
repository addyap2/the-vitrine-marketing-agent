import { useEffect, useMemo, useState } from 'react';
import { useActions, useAppState } from '../state/store';
import { useEditor } from '../components/PublicationEditor';
import { Button, Empty, PageHeader, StatusBadge, Tabs, useUI } from '../components/ui';
import { Icon } from '../components/Icon';
import { ClaudeAssistant } from '../components/ClaudeAssistant';
import { DEFAULT_FILTER, FilterBar, filterPublications, sortPublications, type PubFilter } from '../components/PublicationViews';
import { CHANNEL_LABELS, WORKSPACE_DESCRIPTIONS } from '../lib/labels';
import { WEEKDAYS_SHORT, formatLong, formatMonth, monthGrid, today } from '../lib/dates';
import { buildICS } from '../lib/ics';
import { downloadFile } from '../lib/download';
import { isOverdue } from '../lib/workflow';
import type { Publication } from '../lib/types';

function useNarrow(query = '(max-width: 760px)') {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const fn = () => setNarrow(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [query]);
  return narrow;
}

export function CalendarView() {
  const state = useAppState();
  const actions = useActions();
  const { openPublication, newPublication } = useEditor();
  const { toast } = useUI();
  const narrow = useNarrow();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [mode, setMode] = useState<'month' | 'agenda' | 'claude'>(narrow ? 'agenda' : 'month');
  const [filter, setFilter] = useState<PubFilter>(DEFAULT_FILTER);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  const t = today();

  const filtered = useMemo(() => filterPublications(state.publications, filter), [state.publications, filter]);
  const grid = monthGrid(ym.y, ym.m);
  const monthKey = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`;
  const byDay = useMemo(() => {
    const map = new Map<string, Publication[]>();
    for (const p of sortPublications(filtered)) {
      if (!p.scheduledDate) continue;
      map.set(p.scheduledDate, [...(map.get(p.scheduledDate) ?? []), p]);
    }
    return map;
  }, [filtered]);
  const unscheduled = filtered.filter((p) => !p.scheduledDate && !['publie', 'archive'].includes(p.status));
  const monthItems = [...byDay.entries()].filter(([d]) => d.startsWith(monthKey)).sort(([a], [b]) => a.localeCompare(b));
  const color = (p: Publication) => state.campaigns.find((c) => c.id === p.campaignId)?.color;

  const shift = (delta: number) => setYm(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const drop = (day: string | null) => {
    setOverDay(null);
    if (!dragId) return;
    actions.reschedule(dragId, day);
    toast(day ? `Déplacée au ${formatLong(day)}` : 'Retirée du calendrier');
    setDragId(null);
  };

  const exportIcs = () => {
    const items = filtered.filter((p) => p.scheduledDate && p.status !== 'archive');
    if (!items.length) return toast('Aucune publication datée à exporter.', 'error');
    downloadFile('vitrine-publications.ics', buildICS(items, state.campaigns), 'text/calendar;charset=utf-8');
    toast(`${items.length} rappel${items.length > 1 ? 's' : ''} exporté${items.length > 1 ? 's' : ''} : ouvrez le fichier .ics pour l’ajouter à votre agenda.`);
  };

  const chip = (p: Publication) => (
    <button
      key={p.id}
      type="button"
      className={`cal-item status-dot-${p.status}${isOverdue(p, t) ? ' overdue' : ''}`}
      style={{ borderLeftColor: color(p) ?? 'var(--line-strong)' }}
      draggable
      onDragStart={(e) => {
        setDragId(p.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => setDragId(null)}
      onClick={(e) => {
        e.stopPropagation();
        openPublication(p.id);
      }}
      title={`${p.title} — ${CHANNEL_LABELS[p.channel]}`}
    >
      {p.scheduledTime && <span className="cal-time">{p.scheduledTime}</span>}
      <span className="clamp">{p.title}</span>
    </button>
  );

  return (
    <div className="page">
      <PageHeader
        eyebrow="Espace marketing"
        title="Calendrier éditorial"
        description={WORKSPACE_DESCRIPTIONS.calendar}
        actions={
          <>
            <Button icon="download" onClick={exportIcs}>Exporter vers mon agenda (.ics)</Button>
            <Button icon="print" onClick={() => window.print()} className="hide-mobile">Imprimer</Button>
            <Button variant="primary" icon="plus" onClick={() => newPublication({ workspace: 'calendar', scheduledDate: t })}>Planifier</Button>
          </>
        }
      />
      <Tabs
        label="Vue"
        value={mode}
        onChange={setMode}
        items={[
          { id: 'month', label: 'Mois' },
          { id: 'agenda', label: 'Agenda' },
          { id: 'claude', label: 'Planifier avec Claude' },
        ]}
      />
      {mode === 'claude' ? (
        <section className="panel">
          <ClaudeAssistant workspace="calendar" />
        </section>
      ) : (
        <>
          <FilterBar value={filter} onChange={setFilter} />
          <div className="cal-nav">
            <Button variant="ghost" icon="left" aria-label="Mois précédent" onClick={() => shift(-1)} />
            <h2 aria-live="polite">{formatMonth(ym.y, ym.m)}</h2>
            <Button variant="ghost" icon="right" aria-label="Mois suivant" onClick={() => shift(1)} />
            <Button small onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })}>Aujourd’hui</Button>
          </div>

          {mode === 'month' && (
            <div className="cal-layout">
              <div className="cal-scroll">
                <div className="month-grid" role="grid" aria-label={formatMonth(ym.y, ym.m)}>
                  {WEEKDAYS_SHORT.map((d) => (
                    <div key={d} className="month-head" role="columnheader">{d}</div>
                  ))}
                  {grid.map((day) => {
                    const items = byDay.get(day) ?? [];
                    const outside = !day.startsWith(monthKey);
                    return (
                      <div
                        key={day}
                        role="gridcell"
                        className={`month-cell${outside ? ' outside' : ''}${day === t ? ' today' : ''}${overDay === day ? ' drop-over' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setOverDay(day);
                        }}
                        onDragLeave={() => setOverDay(null)}
                        onDrop={() => drop(day)}
                        onDoubleClick={() => newPublication({ workspace: 'calendar', scheduledDate: day })}
                      >
                        <div className="cell-head">
                          <span className="day-num">{Number(day.slice(8))}</span>
                          <button type="button" className="cell-add" aria-label={`Planifier le ${formatLong(day)}`} onClick={() => newPublication({ workspace: 'calendar', scheduledDate: day })}>
                            <Icon name="plus" size={13} />
                          </button>
                        </div>
                        <div className="cell-items">
                          {items.slice(0, 4).map(chip)}
                          {items.length > 4 && <span className="small muted">+{items.length - 4}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <aside
                className={`unscheduled${overDay === 'none' ? ' drop-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverDay('none');
                }}
                onDragLeave={() => setOverDay(null)}
                onDrop={() => drop(null)}
              >
                <h3>À planifier <span className="muted small">({unscheduled.length})</span></h3>
                <p className="small muted">Glissez une publication sur un jour.</p>
                <div className="stack-xs">{unscheduled.slice(0, 30).map(chip)}</div>
              </aside>
            </div>
          )}

          {mode === 'agenda' && (
            <div className="agenda">
              {monthItems.length ? (
                monthItems.map(([day, items]) => (
                  <section key={day} className={`agenda-day${day === t ? ' today' : ''}`}>
                    <h3>{formatLong(day)}</h3>
                    {items.map((p) => (
                      <button key={p.id} type="button" className="agenda-item" onClick={() => openPublication(p.id)} style={{ borderLeftColor: color(p) ?? 'var(--line-strong)' }}>
                        <span className="agenda-time">{p.scheduledTime ?? '—'}</span>
                        <span className="agenda-main">
                          <strong>{p.title}</strong>
                          <span className="small muted">{CHANNEL_LABELS[p.channel]}</span>
                        </span>
                        <StatusBadge status={p.status} />
                      </button>
                    ))}
                  </section>
                ))
              ) : (
                <Empty title="Rien de planifié ce mois-ci" icon="calendar">Planifiez une publication ou demandez un calendrier à Claude.</Empty>
              )}
              {unscheduled.length > 0 && (
                <section className="agenda-day">
                  <h3>À planifier ({unscheduled.length})</h3>
                  {unscheduled.slice(0, 20).map((p) => (
                    <button key={p.id} type="button" className="agenda-item" onClick={() => openPublication(p.id)}>
                      <span className="agenda-time">—</span>
                      <span className="agenda-main">
                        <strong>{p.title}</strong>
                        <span className="small muted">{CHANNEL_LABELS[p.channel]}</span>
                      </span>
                      <StatusBadge status={p.status} />
                    </button>
                  ))}
                </section>
              )}
            </div>
          )}
          <p className="small muted footnote">
            L’export .ics crée des rappels dans Google Agenda, Apple Calendrier ou Outlook (gratuit). La mise en ligne reste manuelle ou se programme dans l’outil natif du réseau.
          </p>
        </>
      )}
    </div>
  );
}
