/**
 * Create Assignment Page — Study Hall.
 * Borderless sections, tokens, dark mode, a11y. Beautiful skill selector for
 * adaptive assignments. Restyle only — all form logic and data fetching preserved.
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Brain, Zap, Check, ChevronDown, ChevronRight, Clock, Calendar } from 'lucide-react';
import { Button, Input, Select, PageHeader, Section, Skeleton } from '../../components/ui';
import { assignmentService, tutorService, taxonomyService } from '../../services';

/**
 * Skill Selector Component
 * Shows domains with expandable skill lists
 */
const SkillSelector = ({ skills, selectedSkills, onToggleSkill, subject }) => {
  const [expandedDomains, setExpandedDomains] = useState(new Set());

  // Filter skills by subject and group by domain
  const filteredSkills = skills.filter(skill => {
    if (subject === 'math') {
      return ['H', 'Q', 'P', 'S'].includes(skill.domain?.code);
    } else {
      return ['INI', 'CAS', 'EOI', 'SEC'].includes(skill.domain?.code);
    }
  });

  const skillsByDomain = filteredSkills.reduce((acc, skill) => {
    const domainName = skill.domain?.name || 'Other';
    const domainCode = skill.domain?.code || 'X';
    if (!acc[domainName]) {
      acc[domainName] = { code: domainCode, skills: [] };
    }
    acc[domainName].skills.push(skill);
    return acc;
  }, {});

  const toggleDomain = (domain) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  const selectAllInDomain = (domainSkills) => {
    const allSelected = domainSkills.every(s => selectedSkills.includes(s.id));
    if (allSelected) {
      // Deselect all
      domainSkills.forEach(s => {
        if (selectedSkills.includes(s.id)) {
          onToggleSkill(s.id);
        }
      });
    } else {
      // Select all
      domainSkills.forEach(s => {
        if (!selectedSkills.includes(s.id)) {
          onToggleSkill(s.id);
        }
      });
    }
  };

  if (Object.keys(skillsByDomain).length === 0) {
    return (
      <div className="py-8 text-center text-ink-subtle">
        No skills available for this subject
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Object.entries(skillsByDomain).map(([domainName, { code, skills: domainSkills }]) => {
        const isExpanded = expandedDomains.has(domainName);
        const selectedCount = domainSkills.filter(s => selectedSkills.includes(s.id)).length;
        const allSelected = selectedCount === domainSkills.length;

        return (
          <div key={domainName} className="overflow-hidden rounded-lg border border-edge">
            {/* Domain Header */}
            <button
              type="button"
              aria-expanded={isExpanded}
              className="flex w-full items-center justify-between bg-surface-muted px-4 py-3 text-left transition-colors hover:bg-edge-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
              onClick={() => toggleDomain(domainName)}
            >
              <span className="flex items-center gap-3">
                <span className="rounded bg-edge-subtle px-2 py-1 font-mono text-xs text-ink-muted">
                  {code}
                </span>
                <span className="font-medium text-ink-body">{domainName}</span>
                {selectedCount > 0 && (
                  <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">
                    {selectedCount} selected
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectAllInDomain(domainSkills);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      selectAllInDomain(domainSkills);
                    }
                  }}
                  className={`rounded px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    allSelected
                      ? 'bg-brand-600 text-white'
                      : 'border border-edge bg-surface-card text-ink-muted hover:bg-surface-muted'
                  }`}
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </span>
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-ink-faint" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-ink-faint" />
                )}
              </span>
            </button>

            {/* Skills List */}
            {isExpanded && (
              <div className="border-t border-edge bg-surface-card p-3">
                <div className="grid grid-cols-1 gap-2">
                  {domainSkills.map(skill => {
                    const isSelected = selectedSkills.includes(skill.id);
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => onToggleSkill(skill.id)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                          isSelected
                            ? 'bg-brand-600 text-white'
                            : 'bg-surface-muted text-ink-muted hover:bg-edge-subtle'
                        }`}
                      >
                        <div className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded ${
                          isSelected ? 'bg-white' : 'border-2 border-edge-strong'
                        }`}>
                          {isSelected && <Check className="h-3.5 w-3.5 text-brand-600" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono text-xs ${isSelected ? 'text-brand-100' : 'text-ink-subtle'}`}>
                              {skill.code}
                            </span>
                            <span className="truncate font-medium">{skill.name}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const CreateAssignmentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [allSkills, setAllSkills] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [skillsError, setSkillsError] = useState(null);
  const [retryNonce, setRetryNonce] = useState(0);

  // Get student ID from URL params (when coming from student detail page)
  const preselectedStudentId = searchParams.get('student') || '';
  // Get skills from URL params (when coming with skill suggestions)
  const preselectedSkills = searchParams.get('skills')?.split(',').map(Number).filter(Boolean) || [];

  const [formData, setFormData] = useState({
    student_id: preselectedStudentId,
    title: '',
    instructions: '',
    subject: 'math',
    selectedSkills: preselectedSkills,
    question_count: 10,
    unlimited_questions: true,
    time_limit_minutes: '',
    due_date: '',
    is_adaptive: preselectedSkills.length > 0, // Auto-enable adaptive if skills pre-selected
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      // Fetch students and skills separately so one failure doesn't break both
      try {
        const studentsRes = await tutorService.getStudents();
        const studentsList = studentsRes.data?.items || studentsRes.data || [];
        setStudents(studentsList);
      } catch (error) {
        console.error('Failed to fetch students:', error);
      }

      setSkillsLoading(true);
      setSkillsError(null);
      try {
        const skillsRes = await taxonomyService.getSkills({ limit: 200 });
        const skills = skillsRes.data?.items || skillsRes.data || [];
        setAllSkills(skills);
      } catch (error) {
        console.error('Failed to fetch skills:', error);
        setSkillsError(error.response?.data?.detail || error.message || 'Failed to load skills');
      } finally {
        setSkillsLoading(false);
      }
    };

    fetchData();
  }, [retryNonce]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleToggleSkill = (skillId) => {
    setFormData(prev => {
      const newSelected = prev.selectedSkills.includes(skillId)
        ? prev.selectedSkills.filter(id => id !== skillId)
        : [...prev.selectedSkills, skillId];
      return { ...prev, selectedSkills: newSelected };
    });
    if (errors.skills) {
      setErrors(prev => ({ ...prev, skills: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.student_id) newErrors.student_id = 'Please select a student';
    if (!formData.title.trim()) newErrors.title = 'Title is required';

    // For adaptive, require at least one skill
    if (formData.is_adaptive && formData.selectedSkills.length === 0) {
      newErrors.skills = 'Please select at least one skill for adaptive practice';
    }

    // For non-adaptive or adaptive with set count, require at least 1 question
    if (!formData.is_adaptive || !formData.unlimited_questions) {
      if (!formData.question_count || formData.question_count < 1) {
        newErrors.question_count = 'At least 1 question required';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const extractErrorMessage = (error, defaultMsg) => {
    const detail = error.response?.data?.detail;
    if (!detail) return defaultMsg;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map(e => e.msg || e.message).join(', ');
    }
    if (detail.msg) return detail.msg;
    return defaultMsg;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const questionCount = formData.is_adaptive && formData.unlimited_questions
        ? null
        : parseInt(formData.question_count);

      const payload = {
        student_id: formData.student_id,
        title: formData.title,
        instructions: formData.instructions || null,
        subject: formData.subject,
        skill_ids: formData.selectedSkills.length > 0 ? formData.selectedSkills : null,
        question_count: questionCount,
        time_limit_minutes: formData.time_limit_minutes ? parseInt(formData.time_limit_minutes) : null,
        due_date: formData.due_date || null,
        is_adaptive: formData.is_adaptive,
      };

      await assignmentService.createAssignment(payload);
      navigate('/tutor/assignments');
    } catch (error) {
      console.error('Failed to create assignment:', error);
      setErrors({ submit: extractErrorMessage(error, 'Failed to create assignment') });
    } finally {
      setIsLoading(false);
    }
  };

  const studentOptions = students.map((s) => ({
    value: s.id,
    label: `${s.first_name} ${s.last_name}`,
  }));

  const subjectOptions = [
    { value: 'math', label: 'Math' },
    { value: 'reading_writing', label: 'Reading & Writing' },
  ];

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <Link
        to="/tutor/assignments"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <ArrowLeft className="h-4 w-4" /> Back to assignments
      </Link>

      <PageHeader
        eyebrow="Your studio"
        title="Create Assignment"
        subtitle="Build targeted practice. Pick a student, choose skills, and let adaptive mode tune difficulty in real time."
      />

      <form onSubmit={handleSubmit} className="space-y-7">
        {errors.submit && (
          <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
            {errors.submit}
          </div>
        )}

        {/* Student & Title */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Student"
            name="student_id"
            value={formData.student_id}
            onChange={handleChange}
            options={studentOptions}
            error={errors.student_id}
            placeholder="Select a student"
            required
          />

          <Input
            label="Title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            error={errors.title}
            placeholder="e.g., Algebra Practice"
            required
          />
        </div>

        <Input
          label="Instructions (optional)"
          name="instructions"
          value={formData.instructions}
          onChange={handleChange}
          placeholder="Any special instructions for the student"
        />

        {/* Subject & Question Count */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Subject"
            name="subject"
            value={formData.subject}
            onChange={(e) => {
              handleChange(e);
              // Clear selected skills when subject changes
              setFormData(prev => ({ ...prev, selectedSkills: [] }));
            }}
            options={subjectOptions}
          />

          {(!formData.is_adaptive || !formData.unlimited_questions) && (
            <Input
              label="Number of Questions"
              name="question_count"
              type="number"
              min="1"
              max="100"
              value={formData.question_count}
              onChange={handleChange}
              error={errors.question_count}
            />
          )}

          {formData.is_adaptive && formData.unlimited_questions && (
            <div className="flex flex-col">
              <label className="mb-1 block text-sm font-medium text-ink-muted">
                Number of Questions
              </label>
              <div className="flex h-10 items-center rounded-lg border border-edge bg-surface-muted px-3 text-sm text-ink-muted">
                Unlimited - student ends when ready
              </div>
            </div>
          )}
        </div>

        {/* Skill Selection - Always visible */}
        <Section
          title={formData.is_adaptive ? 'Select skills to practice' : 'Focus areas (optional)'}
          hint={formData.selectedSkills.length > 0
            ? `${formData.selectedSkills.length} skill${formData.selectedSkills.length !== 1 ? 's' : ''} selected`
            : undefined}
        >
          {formData.is_adaptive && (
            <p className="mb-2 text-sm text-ink-subtle">
              At least one skill is required for adaptive practice.
            </p>
          )}
          {!formData.is_adaptive && (
            <p className="mb-2 text-sm text-ink-subtle">
              Choose specific domains and skills to focus the assignment on
            </p>
          )}
          {errors.skills && (
            <p role="alert" className="mb-2 text-sm text-rose-700 dark:text-rose-400">{errors.skills}</p>
          )}
          {skillsError && (
            <div role="alert" className="mb-2 rounded-lg bg-rose-50 p-4 dark:bg-rose-900/20">
              <p className="text-sm text-rose-700 dark:text-rose-300">Error loading skills: {skillsError}</p>
              <button
                type="button"
                onClick={() => setRetryNonce((n) => n + 1)}
                className="mt-2 text-sm text-rose-700 underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-rose-300"
              >
                Retry
              </button>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto rounded-lg border border-edge">
            {skillsLoading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-11 w-full" rounded="rounded-lg" />)}
              </div>
            ) : (
              <SkillSelector
                skills={allSkills}
                selectedSkills={formData.selectedSkills}
                onToggleSkill={handleToggleSkill}
                subject={formData.subject}
              />
            )}
          </div>
        </Section>

        {/* Adaptive Mode Toggle */}
        <div
          className={`rounded-xl p-4 transition-all ${
            formData.is_adaptive
              ? 'bg-brand-50 dark:bg-brand-900/20'
              : 'bg-surface-muted'
          }`}
        >
          <button
            type="button"
            aria-pressed={formData.is_adaptive}
            className="flex w-full items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            onClick={() => setFormData(prev => ({ ...prev, is_adaptive: !prev.is_adaptive }))}
          >
            <span className="flex items-center gap-3">
              <span className={`rounded-lg p-2 ${formData.is_adaptive ? 'bg-brand-600' : 'bg-edge'}`}>
                <Brain className={`h-5 w-5 ${formData.is_adaptive ? 'text-white' : 'text-ink-subtle'}`} />
              </span>
              <span>
                <span className="block font-medium text-ink-body">Adaptive Mode (IRT)</span>
                <span className="block text-sm text-ink-subtle">
                  Questions adapt to student&apos;s ability level in real-time
                </span>
              </span>
            </span>
            <span className={`h-6 w-12 rounded-full transition-colors ${
              formData.is_adaptive ? 'bg-brand-600' : 'bg-edge-strong'
            }`}>
              <span className={`mt-0.5 block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                formData.is_adaptive ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </span>
          </button>

          {formData.is_adaptive && (
            <div className="mt-4 space-y-4 border-t border-edge pt-4">
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <Zap className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                <span>Each question optimally challenges the student based on their performance</span>
              </div>

              {/* Question mode toggle */}
              <div className="flex items-center gap-4 rounded-lg border border-edge bg-surface-card p-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="question_mode"
                    checked={formData.unlimited_questions}
                    onChange={() => setFormData(prev => ({ ...prev, unlimited_questions: true }))}
                    className="h-4 w-4 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-ink-muted">Unlimited — student ends when ready</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="question_mode"
                    checked={!formData.unlimited_questions}
                    onChange={() => setFormData(prev => ({ ...prev, unlimited_questions: false }))}
                    className="h-4 w-4 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm text-ink-muted">Fixed number of questions</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Time Limit & Due Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-muted">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Time Limit
              </span>
            </label>
            <Input
              name="time_limit_minutes"
              type="number"
              min="1"
              value={formData.time_limit_minutes}
              onChange={handleChange}
              placeholder="No limit (minutes)"
            />
            {formData.time_limit_minutes && (
              <p className="mt-1 text-xs text-ink-subtle">
                Timer auto-submits when time expires
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-muted">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Due Date
              </span>
            </label>
            <Input
              name="due_date"
              type="datetime-local"
              value={formData.due_date}
              onChange={handleChange}
            />
            {formData.due_date && (
              <p className="mt-1 text-xs text-ink-subtle">
                Student cannot start after this date
              </p>
            )}
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-3 border-t border-edge pt-5">
          <Button
            type="submit"
            variant="primary"
            loading={isLoading}
            disabled={isLoading}
          >
            Create Assignment
          </Button>
          <Link to="/tutor/assignments">
            <Button variant="secondary" disabled={isLoading}>
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
};

export default CreateAssignmentPage;
