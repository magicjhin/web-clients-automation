/**
 * lead-actions.tsx — Client component for CRM actions on a lead detail page.
 *
 * Imports server actions from '@/lib/lead-actions' and calls them via
 * startTransition + router.refresh() pattern.
 *
 * Actions provided:
 *  - takeIntoWork: mark lead as in_progress
 *  - setOutcome: in_progress | no_response | lost | won (with optional dealValue / lostReason)
 *  - setCallback: schedule a callback date
 *  - setNote: save a free-text note
 *  - requestAudit: queue a PageSpeed/audit run (active only if website exists)
 */

'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  takeIntoWork,
  setOutcome,
  setCallback,
  setNote,
  requestAudit,
} from '@/lib/lead-actions';

type Outcome = 'in_progress' | 'no_response' | 'lost' | 'won';

interface LeadActionsProps {
  companyId: string;
  /** Сырой lead_outcome из LeadDelivery: 'sent'|'in_progress'|'no_response'|'lost'|'won' | null (не взят). */
  currentOutcome: string | null;
  hasWebsite: boolean;
  /** Optimistic audit status from enrichment (if available). Null = not started. */
  auditStatus?: string | null;
  callbackDate?: string | null;
  note?: string | null;
}

export function LeadActions({
  companyId,
  currentOutcome,
  hasWebsite,
  auditStatus,
  callbackDate,
  note: initialNote,
}: LeadActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Local UI state
  const [outcome, setOutcomeState] = useState<string | null>(currentOutcome);
  const [dealValue, setDealValue] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [showWonForm, setShowWonForm] = useState(false);
  const [showLostForm, setShowLostForm] = useState(false);
  const [callDate, setCallDate] = useState(callbackDate ?? '');
  const [noteText, setNoteText] = useState(initialNote ?? '');
  const [noteSaved, setNoteSaved] = useState(false);
  const [auditQueued, setAuditQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  function refresh() {
    router.refresh();
  }

  function handleError(e: unknown) {
    setError(e instanceof Error ? e.message : 'Произошла ошибка');
  }

  // --- Take into work ---
  function handleTakeIntoWork() {
    setError(null);
    startTransition(async () => {
      try {
        await takeIntoWork(companyId);
        setOutcomeState('sent');
        refresh();
      } catch (e) {
        handleError(e);
      }
    });
  }

  // --- Set outcome ---
  function handleOutcome(o: Outcome, extra?: { dealValue?: number; lostReason?: string }) {
    setError(null);
    startTransition(async () => {
      try {
        await setOutcome(companyId, o, extra);
        setOutcomeState(o);
        setShowWonForm(false);
        setShowLostForm(false);
        refresh();
      } catch (e) {
        handleError(e);
      }
    });
  }

  // --- Callback date ---
  function handleCallbackChange(val: string) {
    setCallDate(val);
    startTransition(async () => {
      try {
        await setCallback(companyId, val || null);
        refresh();
      } catch (e) {
        handleError(e);
      }
    });
  }

  // --- Note ---
  function handleNoteSave() {
    setError(null);
    startTransition(async () => {
      try {
        await setNote(companyId, noteText);
        setNoteSaved(true);
        setTimeout(() => setNoteSaved(false), 2000);
        refresh();
      } catch (e) {
        handleError(e);
      }
    });
  }

  // --- Request audit ---
  function handleRequestAudit() {
    setError(null);
    startTransition(async () => {
      try {
        await requestAudit(companyId);
        setAuditQueued(true);
        refresh();
      } catch (e) {
        handleError(e);
      }
    });
  }

  const isInWork = outcome === 'in_progress';
  const isWon = outcome === 'won';
  const isLost = outcome === 'lost';
  const isNoResponse = outcome === 'no_response';

  // Determine audit button label/state
  const effectiveAuditStatus = auditQueued ? 'queued' : auditStatus;
  const auditLabel =
    effectiveAuditStatus === 'queued'
      ? 'Аудит: в очереди'
      : effectiveAuditStatus === 'running'
      ? 'Аудит: считается...'
      : effectiveAuditStatus === 'done'
      ? 'Аудит готов'
      : effectiveAuditStatus === 'failed'
      ? 'Аудит: ошибка — повторить'
      : 'Запустить аудит';

  const auditDisabled =
    !hasWebsite ||
    isPending ||
    effectiveAuditStatus === 'queued' ||
    effectiveAuditStatus === 'running' ||
    effectiveAuditStatus === 'done';

  return (
    <div className="space-y-4" aria-label="Действия с лидом">

      {/* Error banner */}
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Status / Take into work ───────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Статус</p>

        {outcome === null ? (
          <button
            type="button"
            onClick={handleTakeIntoWork}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 text-white text-sm font-semibold px-4 py-2 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <BriefcaseIcon />
            Взять в работу
          </button>
        ) : (
          <OutcomePill outcome={outcome} />
        )}
      </div>

      {/* ── Outcome buttons (показываются как только лид взят в работу) ── */}
      {outcome !== null ? (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Исход звонка</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleOutcome('in_progress')}
              disabled={isPending || isInWork}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition
                ${isInWork
                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                } disabled:opacity-50`}
            >
              Ответил
            </button>
            <button
              type="button"
              onClick={() => handleOutcome('no_response')}
              disabled={isPending || isNoResponse}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition
                ${isNoResponse
                  ? 'bg-gray-100 text-gray-700 border-gray-300'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                } disabled:opacity-50`}
            >
              Не ответил
            </button>
            <button
              type="button"
              onClick={() => { setShowLostForm(true); setShowWonForm(false); }}
              disabled={isPending || isLost}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition
                ${isLost
                  ? 'bg-red-100 text-red-800 border-red-200'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                } disabled:opacity-50`}
            >
              Отказ
            </button>
            <button
              type="button"
              onClick={() => { setShowWonForm(true); setShowLostForm(false); }}
              disabled={isPending || isWon}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition
                ${isWon
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                } disabled:opacity-50`}
            >
              Сделка
            </button>
          </div>

          {/* Won form */}
          {showWonForm && (
            <div className="mt-3 flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="deal-value" className="text-xs text-gray-500">
                  Сумма сделки, €
                </label>
                <input
                  id="deal-value"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="2500"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  handleOutcome('won', {
                    dealValue: dealValue ? parseFloat(dealValue) : undefined,
                  })
                }
                disabled={isPending}
                className="rounded-lg bg-green-600 text-white px-4 py-1.5 text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
              >
                Подтвердить сделку
              </button>
              <button
                type="button"
                onClick={() => setShowWonForm(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 transition"
              >
                Отмена
              </button>
            </div>
          )}

          {/* Lost form */}
          {showLostForm && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-col gap-1 flex-1">
                <label htmlFor="lost-reason" className="text-xs text-gray-500">
                  Причина отказа (необязательно)
                </label>
                <input
                  id="lost-reason"
                  type="text"
                  placeholder="Дорого / Уже есть подрядчик / ..."
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  handleOutcome('lost', {
                    lostReason: lostReason || undefined,
                  })
                }
                disabled={isPending}
                className="rounded-lg bg-red-600 text-white px-4 py-1.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition"
              >
                Записать отказ
              </button>
              <button
                type="button"
                onClick={() => setShowLostForm(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 transition"
              >
                Отмена
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* ── Callback date ────────────────────────────────────────── */}
      <div>
        <label
          htmlFor="callback-date"
          className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"
        >
          Перезвонить
        </label>
        <input
          id="callback-date"
          type="datetime-local"
          value={callDate}
          onChange={(e) => handleCallbackChange(e.target.value)}
          disabled={isPending}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
        />
        {callDate && (
          <button
            type="button"
            onClick={() => handleCallbackChange('')}
            disabled={isPending}
            className="ml-2 text-xs text-gray-400 hover:text-red-500 transition"
            aria-label="Очистить дату"
          >
            Очистить
          </button>
        )}
      </div>

      {/* ── Note ─────────────────────────────────────────────────── */}
      <div>
        <label
          htmlFor="lead-note"
          className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"
        >
          Заметка
        </label>
        <textarea
          id="lead-note"
          ref={noteRef}
          value={noteText}
          onChange={(e) => { setNoteText(e.target.value); setNoteSaved(false); }}
          rows={3}
          placeholder="Договорились перезвонить через неделю..."
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={handleNoteSave}
            disabled={isPending}
            className="rounded-lg bg-gray-100 text-gray-700 px-3 py-1.5 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition"
          >
            Сохранить заметку
          </button>
          {noteSaved && (
            <span className="text-xs text-green-600">Сохранено</span>
          )}
        </div>
      </div>

      {/* ── Audit ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Аудит сайта</p>
        {!hasWebsite ? (
          <p className="text-sm text-gray-400">Сайт не найден — аудит недоступен</p>
        ) : (
          <>
            <button
              type="button"
              onClick={handleRequestAudit}
              disabled={auditDisabled}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition
                ${effectiveAuditStatus === 'done'
                  ? 'bg-green-100 text-green-800 cursor-default'
                  : effectiveAuditStatus === 'queued' || effectiveAuditStatus === 'running'
                  ? 'bg-amber-100 text-amber-800 cursor-default'
                  : 'bg-brand-600 text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <AuditIcon />
              {auditLabel}
            </button>
            {/* TODO: backend needs to expose audit_status in getCompanyDetail */}
            {!auditStatus && !auditQueued && (
              <p className="mt-1 text-xs text-gray-400">
                PageSpeed · запускается вручную
              </p>
            )}
          </>
        )}
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OutcomePill({ outcome }: { outcome: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    sent: { label: 'Взято в работу', cls: 'bg-amber-100 text-amber-800' },
    in_progress: { label: 'Ответил', cls: 'bg-blue-100 text-blue-800' },
    no_response: { label: 'Не ответил', cls: 'bg-gray-100 text-gray-700' },
    lost: { label: 'Отказ', cls: 'bg-red-100 text-red-800' },
    won: { label: 'Сделка', cls: 'bg-green-100 text-green-800' },
  };
  const { label, cls } = map[outcome] ?? { label: outcome, cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// Icons
function BriefcaseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
    </svg>
  );
}

function AuditIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
