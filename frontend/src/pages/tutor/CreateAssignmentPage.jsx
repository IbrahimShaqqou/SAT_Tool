/**
 * Create Assignment Page
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Brain, Zap } from 'lucide-react';
import { Card, Button, Input, Select } from '../../components/ui';
import { assignmentService, tutorService, taxonomyService } from '../../services';

const CreateAssignmentPage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [domains, setDomains] = useState([]);
  const [skills, setSkills] = useState([]);

  const [formData, setFormData] = useState({
    student_id: '',
    title: '',
    instructions: '',
    subject: 'math',
    domain_id: '',
    skill_id: '',
    question_count: 10,
    unlimited_questions: true, // Default to unlimited for adaptive
    time_limit_minutes: '',
    due_date: '',
    is_adaptive: false,
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentsRes, domainsRes] = await Promise.all([
          tutorService.getStudents(),
          taxonomyService.getDomains(),
        ]);
        setStudents(studentsRes.data.items || []);
        setDomains(domainsRes.data.items || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };

    fetchData();
  }, []);

  // Fetch skills when domain changes
  useEffect(() => {
    const fetchSkills = async () => {
      if (formData.domain_id) {
        try {
          const response = await taxonomyService.getSkills({ domain_id: formData.domain_id });
          setSkills(response.data.items || []);
        } catch (error) {
          console.error('Failed to fetch skills:', error);
        }
      } else {
        setSkills([]);
      }
    };

    fetchSkills();
  }, [formData.domain_id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.student_id) newErrors.student_id = 'Please select a student';
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    // For adaptive with unlimited, no question count validation needed
    // For non-adaptive or adaptive with set count, require at least 1 question
    if (!formData.is_adaptive || !formData.unlimited_questions) {
      if (!formData.question_count || formData.question_count < 1) {
        newErrors.question_count = 'At least 1 question required';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Helper to extract error message from API errors
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
      // For adaptive with unlimited, send null for question_count
      const questionCount = formData.is_adaptive && formData.unlimited_questions
        ? null
        : parseInt(formData.question_count);

      const payload = {
        ...formData,
        domain_id: formData.domain_id ? parseInt(formData.domain_id) : null,
        skill_id: formData.skill_id ? parseInt(formData.skill_id) : null,
        question_count: questionCount,
        time_limit_minutes: formData.time_limit_minutes ? parseInt(formData.time_limit_minutes) : null,
        due_date: formData.due_date || null,
        is_adaptive: formData.is_adaptive,
      };
      // Remove unlimited_questions from payload as backend doesn't expect it
      delete payload.unlimited_questions;
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

  const domainOptions = domains.map((d) => ({
    value: d.id,
    label: d.name,
  }));

  const skillOptions = skills.map((s) => ({
    value: s.id,
    label: s.name,
  }));

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
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.submit && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
              {errors.submit}
            </div>
          )}

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

          <Input
            label="Instructions (optional)"
            name="instructions"
            value={formData.instructions}
            onChange={handleChange}
            placeholder="Any special instructions for the student"
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Subject"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              options={subjectOptions}
            />

            {/* Hide question count when adaptive with unlimited is selected */}
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

            {/* Show unlimited indicator when in unlimited mode */}
            {formData.is_adaptive && formData.unlimited_questions && (
              <div className="flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Questions
                </label>
                <div className="h-10 flex items-center px-3 bg-purple-100 border border-purple-200 rounded-lg text-purple-700 text-sm">
                  Unlimited - student ends when ready
                </div>
              </div>
            )}
          </div>

          {/* Adaptive Mode Toggle */}
          <div
            className={`p-4 rounded-lg border-2 transition-all ${
              formData.is_adaptive
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setFormData(prev => ({ ...prev, is_adaptive: !prev.is_adaptive }))}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${formData.is_adaptive ? 'bg-purple-500' : 'bg-gray-200'}`}>
                  <Brain className={`h-5 w-5 ${formData.is_adaptive ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Adaptive Mode</p>
                  <p className="text-sm text-gray-500">
                    Questions selected based on student's ability level using IRT
                  </p>
                </div>
              </div>
              <div className={`w-12 h-6 rounded-full transition-colors ${
                formData.is_adaptive ? 'bg-purple-500' : 'bg-gray-300'
              }`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                  formData.is_adaptive ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </div>
            </div>
            {formData.is_adaptive && (
              <div className="mt-3 pt-3 border-t border-purple-200 space-y-3">
                <div className="flex items-center gap-2 text-sm text-purple-700">
                  <Zap className="h-4 w-4" />
                  <span>Each question will be chosen to optimally challenge the student</span>
                </div>

                {/* Unlimited/Fixed questions toggle for adaptive */}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="question_mode"
                      checked={formData.unlimited_questions}
                      onChange={() => setFormData(prev => ({ ...prev, unlimited_questions: true }))}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Unlimited (student ends when ready)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="question_mode"
                      checked={!formData.unlimited_questions}
                      onChange={() => setFormData(prev => ({ ...prev, unlimited_questions: false }))}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Set question count</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Domain (optional)"
              name="domain_id"
              value={formData.domain_id}
              onChange={handleChange}
              options={domainOptions}
              placeholder="Any domain"
            />

            <Select
              label="Skill (optional)"
              name="skill_id"
              value={formData.skill_id}
              onChange={handleChange}
              options={skillOptions}
              placeholder="Any skill"
              disabled={!formData.domain_id}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Time Limit (minutes, optional)"
              name="time_limit_minutes"
              type="number"
              min="1"
              value={formData.time_limit_minutes}
              onChange={handleChange}
              placeholder="No limit"
            />

            <Input
              label="Due Date (optional)"
              name="due_date"
              type="datetime-local"
              value={formData.due_date}
              onChange={handleChange}
            />
          </div>

          <div className="flex gap-3 pt-4">
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
