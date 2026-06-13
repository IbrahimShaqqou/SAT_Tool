/**
 * TutorWorklist — editable view of one student's worklist, embedded in the
 * Student Detail "Worklist" tab. Tutor can reorder, mark done/reopen, lock, and
 * remove items, and see each skill's before→after + status.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2, AlertTriangle, Circle, Loader2, ArrowUp, ArrowDown,
  Lock, Unlock, Trash2, ArrowRight,
} from 'lucide-react';
import { Button, Skeleton, Surface, useToast } from '../ui';
import { worklistService } from '../../services/worklistService';

const STATUS_META = {
  open: { label: 'To do', icon: Circle, cls: 'text-ink-faint' },
  in_progress: { label: 'In progress', icon: Loader2, cls: 'text-brand-600 dark:text-brand-300' },
  passed: { label: 'Passed', icon: CheckCircle2, cls: 'text-accent-600 dark:text-accent-300' },
  done: { label: 'Done', icon: CheckCircle2, cls: 'text-accent-600 dark:text-accent-300' },
  needs_tutor: { label: 'Needs you', icon: AlertTriangle, cls: 'text-amber-600 dark:text-amber-400' },
  refresh: { label: 'Refresh', icon: Circle, cls: 'text-brand-600 dark:text-brand-300' },
};

const fmtPct = (v) => (v == null ? null : `${Math.round(v)}%`);

const TutorWorklist = ({ studentId }) => {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await worklistService.getStudentWorklist(studentId);
      setItems(res.data || []);
    } catch {
      setItems([]);
    }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const patch = async (item, body) => {
    setBusyId(item.id);
    try {
      await worklistService.patchItem(item.id, body);
      await load();
    } catch (err) {
      toast?.error?.(err?.response?.data?.detail || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const move = async (item, dir) => {
    if (!items) return;
    const ids = items.map((i) => i.id);
    const idx = ids.indexOf(item.id);
    const swap = idx + dir;
    if (swap < 0 || swap >= ids.length) return;
    [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
    await patch(item, { order: ids });
  };

  const remove = async (item) => {
    if (!window.confirm(`Remove "${item.skill_name}" from the worklist?`)) return;
    setBusyId(item.id);
    try {
      await worklistService.deleteItem(item.id);
      await load();
    } catch (err) {
      toast?.error?.(err?.response?.data?.detail || 'Remove failed');
    } finally {
      setBusyId(null);
    }
  };

  if (items === null) return <Skeleton className="h-48 w-full" rounded="rounded-xl" />;
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-edge px-4 py-10 text-center text-sm text-ink-subtle">
        No worklist yet — it generates when this student imports a practice test.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item, i) => {
        const meta = STATUS_META[item.status] || STATUS_META.open;
        const Icon = meta.icon;
        const before = fmtPct(item.baseline_accuracy);
        const after = fmtPct(item.current_accuracy);
        const cleared = ['done', 'passed'].includes(item.status);
        const busy = busyId === item.id;
        return (
          <Surface as="li" key={item.id} className={`rounded-xl p-3.5 ${busy ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 shrink-0 ${meta.cls}`} />
                  <span className="font-medium text-ink-body">{item.skill_name}</span>
                  {item.tutor_locked && <Lock className="h-3 w-3 text-ink-faint" title="Locked" />}
                </div>
                <div className="mt-1 flex items-center gap-2 pl-6 text-xs">
                  <span className={meta.cls}>{meta.label}</span>
                  {(before || after) && (
                    <span className="tabular-nums text-ink-subtle">
                      {before && after ? <>{before} <ArrowRight className="inline h-3 w-3" /> <span className="font-semibold text-ink-body">{after}</span></> : (after || before)}
                    </span>
                  )}
                  {item.source === 'tutor' && <span className="text-ink-faint">· added by you</span>}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <button type="button" disabled={busy || i === 0} onClick={() => move(item, -1)}
                  className="rounded-md p-1.5 text-ink-faint hover:bg-surface-muted disabled:opacity-30" title="Move up">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" disabled={busy || i === items.length - 1} onClick={() => move(item, 1)}
                  className="rounded-md p-1.5 text-ink-faint hover:bg-surface-muted disabled:opacity-30" title="Move down">
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button type="button" disabled={busy}
                  onClick={() => patch(item, { tutor_locked: !item.tutor_locked })}
                  className="rounded-md p-1.5 text-ink-faint hover:bg-surface-muted" title={item.tutor_locked ? 'Unlock' : 'Lock'}>
                  {item.tutor_locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </button>
                <button type="button" disabled={busy} onClick={() => remove(item)}
                  className="rounded-md p-1.5 text-ink-faint hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400" title="Remove">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-2 flex gap-2 pl-6">
              {cleared ? (
                <Button variant="ghost" size="sm" disabled={busy}
                  onClick={() => patch(item, { status: 'open' })}>Reopen</Button>
              ) : (
                <Button variant="ghost" size="sm" disabled={busy}
                  onClick={() => patch(item, { status: 'done' })}>Mark done</Button>
              )}
            </div>
          </Surface>
        );
      })}
    </ul>
  );
};

export default TutorWorklist;
