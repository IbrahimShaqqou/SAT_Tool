/**
 * Tutor Students — Study Hall.
 * Borderless roster of keyboard-accessible rows (no click-only table),
 * inline search, StatusPill accuracy. Tokens, dark mode, a11y.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users, UserPlus, ArrowUpRight, Link2, Copy, Check } from 'lucide-react';
import {
  Button, Avatar, EmptyState, Modal, Input, Skeleton,
  PageHeader, Section, StatusPill,
} from '../../components/ui';
import { tutorService } from '../../services';
import { joinService } from '../../services/joinService';
import { useDebounce } from '../../hooks';
import { useToast } from '../../components/ui/Toast';

const StudentsPage = () => {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  const [showAddModal, setShowAddModal] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const toast = useToast();

  // Reusable roster join link.
  const [joinLink, setJoinLink] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    joinService.getJoinLink()
      .then((res) => { if (active) setJoinLink(res.data.link); })
      .catch(() => { /* non-blocking: link area just won't show */ });
    return () => { active = false; };
  }, []);

  const copyJoinLink = async () => {
    if (!joinLink) return;
    try {
      await navigator.clipboard.writeText(joinLink);
      setCopied(true);
      toast.success('Invite link copied. Drop it in your meeting chat.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Select and copy the link manually.');
    }
  };

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await tutorService.getStudents({ search: debouncedSearch || undefined });
      setStudents(response.data.items || []);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setAddError('');
    setIsAdding(true);
    try {
      await tutorService.addStudent(studentEmail);
      toast.success(`Student ${studentEmail} added successfully`);
      setShowAddModal(false);
      setStudentEmail('');
      fetchStudents();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to add student';
      setAddError(typeof message === 'string' ? message : 'Failed to add student. Make sure the email is registered as a student.');
    } finally {
      setIsAdding(false);
    }
  };

  const closeModal = () => { setShowAddModal(false); setStudentEmail(''); setAddError(''); };

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <PageHeader
        eyebrow="Your studio"
        title="Students"
        subtitle="Your roster at a glance. Open a student to see mastery, history, and assign targeted practice."
        actions={
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            <UserPlus className="h-4 w-4" /> Add student
          </Button>
        }
      />

      {/* Invite link — share once, students join your roster */}
      {joinLink && (
        <div className="mb-5 rounded-xl border border-edge bg-surface-muted/50 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/15">
              <Link2 className="h-4 w-4 text-brand-600 dark:text-brand-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-body">Your invite link</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Share this once (e.g. drop it in your meeting chat). Students who open it and sign up join your roster automatically.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-input px-3 py-2 text-xs text-ink-body">
                  {joinLink}
                </code>
                <Button variant="secondary" size="sm" onClick={copyJoinLink} className="shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <label htmlFor="student-search" className="sr-only">Search students</label>
        <input
          id="student-search"
          type="search"
          placeholder="Search students by name or email"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-edge bg-surface-input py-2.5 pl-10 pr-4 text-sm text-ink-body placeholder:text-ink-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
      </div>

      <Section title="Roster" icon={Users} hint={!isLoading && students.length ? `${students.length} student${students.length === 1 ? '' : 's'}` : undefined}>
        {isLoading ? (
          <ul className="divide-y divide-edge-subtle">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3"><Skeleton className="h-9 w-9" rounded="rounded-full" /><div className="space-y-1.5"><Skeleton className="h-3.5 w-36" /><Skeleton className="h-3 w-44" /></div></div>
                <Skeleton className="h-5 w-12" />
              </li>
            ))}
          </ul>
        ) : students.length === 0 ? (
          <EmptyState
            icon={Users}
            title={searchQuery ? 'No students match that search' : 'No students yet'}
            description={searchQuery ? 'Try a different name or email.' : 'Add your first student to start tracking progress.'}
            action={!searchQuery && <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}><UserPlus className="h-4 w-4" /> Add student</Button>}
          />
        ) : (
          <ul className="divide-y divide-edge-subtle">
            {students.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/tutor/students/${s.id}`}
                  className="group flex items-center justify-between gap-3 rounded-xl py-4 -mx-2 px-2 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={`${s.first_name} ${s.last_name}`} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-body">{s.first_name} {s.last_name}</p>
                      <p className="truncate text-xs text-ink-subtle">{s.email}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <div className="hidden text-right sm:block">
                      <p className="text-xs font-medium text-ink-body">{s.total_questions_answered || 0} questions</p>
                      <p className="text-[11px] text-ink-faint">
                        {s.assignments_pending || 0} pending · {s.last_active_at ? new Date(s.last_active_at).toLocaleDateString() : 'never active'}
                      </p>
                    </div>
                    <StatusPill value={s.overall_accuracy} size="sm" />
                    <ArrowUpRight className="h-4 w-4 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Add Student Modal */}
      <Modal isOpen={showAddModal} onClose={closeModal} title="Add student">
        <form onSubmit={handleAddStudent} className="space-y-4">
          <p className="text-sm text-ink-muted">
            Enter the email of a registered student account to add them to your roster.
          </p>
          {addError && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/50 dark:bg-rose-900/20 dark:text-rose-300">
              {addError}
            </div>
          )}
          <Input label="Student email" type="email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="student@example.com" required />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" variant="primary" loading={isAdding}>Add student</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StudentsPage;
