/**
 * Create Assignment Page
 * With beautiful skill selector for adaptive assignments
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Brain, Zap, Check, ChevronDown, ChevronRight, Clock, Calendar } from 'lucide-react';
import { Card, Button, Input, Select } from '../../components/ui';
import { assignmentService, tutorService, taxonomyService } from '../../services';

/**
 * Skill Selector Component for Adaptive Assignments
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
      <div className="text-center py-8 text-gray-500">
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
          <div key={domainName} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Domain Header */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => toggleDomain(domainName)}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono px-2 py-1 bg-gray-200 text-gray-600 rounded">
                  {code}
                </span>
                <span className="font-medium text-gray-900">{domainName}</span>
                {selectedCount > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-gray-900 text-white rounded-full">
                    {selectedCount} selected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectAllInDomain(domainSkills);
                  }}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    allSelected
                      ? 'bg-gray-900 text-white'
                      : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>

            {/* Skills List */}
            {isExpanded && (
              <div className="p-3 bg-white border-t border-gray-200">
                <div className="grid grid-cols-1 gap-2">
                  {domainSkills.map(skill => {
                    const isSelected = selectedSkills.includes(skill.id);
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => onToggleSkill(skill.id)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                          isSelected
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-white' : 'border-2 border-gray-300'
                        }`}>
                          {isSelected && <Check className="h-3.5 w-3.5 text-gray-900" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-mono ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                              {skill.code}
                            </span>
                            <span className="font-medium truncate">{skill.name}</span>
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
  const [isLoading, setIsLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [allSkills, setAllSkills] = useState([]);

  const [formData, setFormData] = useState({
    student_id: '',
    title: '',
    instructions: '',
    subject: 'math',
    selectedSkills: [], // Array of skill IDs for adaptive
    question_count: 10,
    unlimited_questions: true,
    time_limit_minutes: '',
    due_date: '',
    is_adaptive: false,
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentsRes, skillsRes] = await Promise.all([
          tutorService.getStudents(),
          taxonomyService.getSkills({ limit: 200 }),
        ]);
        setStudents(studentsRes.data.items || []);
        setAllSkills(skillsRes.data.items || skillsRes.data || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };

    fetchData();
  }, []);

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
        skill_ids: formData.is_adaptive ? formData.selectedSkills : null,
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/tutor/assignments">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Create Assignment</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          {errors.submit && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Questions
                </label>
                <div className="h-10 flex items-center px-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-600 text-sm">
                  Unlimited - student ends when ready
                </div>
              </div>
            )}
          </div>

          {/* Adaptive Mode Toggle */}
          <div
            className={`p-4 rounded-xl border-2 transition-all ${
              formData.is_adaptive
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setFormData(prev => ({ ...prev, is_adaptive: !prev.is_adaptive }))}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${formData.is_adaptive ? 'bg-gray-900' : 'bg-gray-200'}`}>
                  <Brain className={`h-5 w-5 ${formData.is_adaptive ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Adaptive Mode (IRT)</p>
                  <p className="text-sm text-gray-500">
                    Questions adapt to student's ability level in real-time
                  </p>
                </div>
              </div>
              <div className={`w-12 h-6 rounded-full transition-colors ${
                formData.is_adaptive ? 'bg-gray-900' : 'bg-gray-300'
              }`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                  formData.is_adaptive ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </div>
            </div>

            {formData.is_adaptive && (
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Zap className="h-4 w-4" />
                  <span>Each question optimally challenges the student based on their performance</span>
                </div>

                {/* Question mode toggle */}
                <div className="flex items-center gap-4 p-3 bg-white rounded-lg border border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="question_mode"
                      checked={formData.unlimited_questions}
                      onChange={() => setFormData(prev => ({ ...prev, unlimited_questions: true }))}
                      className="w-4 h-4 text-gray-900 focus:ring-gray-900"
                    />
                    <span className="text-sm text-gray-700">Unlimited practice</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="question_mode"
                      checked={!formData.unlimited_questions}
                      onChange={() => setFormData(prev => ({ ...prev, unlimited_questions: false }))}
                      className="w-4 h-4 text-gray-900 focus:ring-gray-900"
                    />
                    <span className="text-sm text-gray-700">Fixed question count</span>
                  </label>
                </div>

                {/* Skill Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-900">
                      Select Skills to Practice <span className="text-red-500">*</span>
                    </label>
                    {formData.selectedSkills.length > 0 && (
                      <span className="text-sm text-gray-500">
                        {formData.selectedSkills.length} skill{formData.selectedSkills.length !== 1 ? 's' : ''} selected
                      </span>
                    )}
                  </div>
                  {errors.skills && (
                    <p className="text-sm text-red-600 mb-2">{errors.skills}</p>
                  )}
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    <SkillSelector
                      skills={allSkills}
                      selectedSkills={formData.selectedSkills}
                      onToggleSkill={handleToggleSkill}
                      subject={formData.subject}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Time Limit & Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <p className="text-xs text-gray-500 mt-1">
                  Timer auto-submits when time expires
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <p className="text-xs text-gray-500 mt-1">
                  Student cannot start after this date
                </p>
              )}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
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
      </Card>
    </div>
  );
};

export default CreateAssignmentPage;
