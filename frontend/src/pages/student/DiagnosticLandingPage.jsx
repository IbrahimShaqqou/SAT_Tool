/**
 * Diagnostic Landing Page
 * Students choose Math, Reading & Writing, or both before starting.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Clock, Target, CheckCircle, ArrowRight, Calculator, BookOpenText } from 'lucide-react';
import { Card, Button, LoadingSpinner } from '../../components/ui';
import diagnosticService from '../../services/diagnosticService';

const sectionOptions = [
  {
    key: 'both',
    sections: ['math', 'reading_writing'],
    label: 'Full Diagnostic',
    desc: '58 questions, covers every skill across both sections',
    time: '40–55 min',
    icon: Brain,
    color: 'brand',
  },
  {
    key: 'math',
    sections: ['math'],
    label: 'Math Only',
    desc: '38 questions: Algebra, Advanced Math, Problem Solving & Geometry',
    time: '25–35 min',
    icon: Calculator,
    color: 'brand',
  },
  {
    key: 'reading_writing',
    sections: ['reading_writing'],
    label: 'Reading & Writing Only',
    desc: '20 questions: Craft & Structure, Information & Ideas, Standard English & Expression',
    time: '15–20 min',
    icon: BookOpenText,
    color: 'accent',
  },
];

const colorMap = {
  brand: {
    ring: 'ring-brand-600 dark:ring-brand-400 bg-brand-50 dark:bg-brand-900/20',
    idle: 'hover:border-brand-300 dark:hover:border-brand-700',
    iconBg: 'bg-brand-100 dark:bg-brand-900/30',
    icon: 'text-brand-600 dark:text-brand-400',
  },
  accent: {
    ring: 'ring-accent-600 dark:ring-accent-400 bg-accent-50 dark:bg-accent-900/20',
    idle: 'hover:border-accent-300 dark:hover:border-accent-700',
    iconBg: 'bg-accent-100 dark:bg-accent-900/30',
    icon: 'text-accent-600 dark:text-accent-400',
  },
};

export default function DiagnosticLandingPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('both');
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState(null);

  const selectedOption = sectionOptions.find(o => o.key === selected);

  const handleStart = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const res = await diagnosticService.start(selectedOption.sections);
      const { token } = res.data;
      navigate(`/assess/${token}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start diagnostic. Please try again.');
      setIsStarting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-brand-600 px-7 py-10 text-white">
        <div className="relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mb-5">
            <Brain className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Know Where You Stand</h1>
          <p className="text-brand-100 text-lg">
            Take a diagnostic to identify your strengths and pinpoint exactly what to study.
          </p>
        </div>
      </div>

      {/* Section picker */}
      <Card>
        <Card.Header>
          <Card.Title>Choose your diagnostic</Card.Title>
        </Card.Header>
        <Card.Content>
          <div className="space-y-3">
            {sectionOptions.map((opt) => {
              const isSelected = selected === opt.key;
              const c = colorMap[opt.color];
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  onClick={() => setSelected(opt.key)}
                  className={`
                    w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all
                    ${isSelected
                      ? `${c.ring} ring-2 border-transparent`
                      : `border-edge ${c.idle}`
                    }
                  `}
                >
                  <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`h-5 w-5 ${c.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-body">{opt.label}</p>
                    <p className="text-sm text-ink-subtle">{opt.desc}</p>
                  </div>
                  <span className="text-xs font-medium text-ink-faint whitespace-nowrap">
                    {opt.time}
                  </span>
                </button>
              );
            })}
          </div>
        </Card.Content>
      </Card>

      {/* What to expect */}
      <Card>
        <Card.Header>
          <Card.Title>What to expect</Card.Title>
        </Card.Header>
        <Card.Content>
          <div className="space-y-4">
            {[
              { icon: Clock, title: selectedOption.time, desc: 'Questions are adaptive: faster if you\'re confident, slower if mixed.' },
              { icon: Target, title: '2 questions per skill', desc: 'Every skill is tested with an easy and a hard question for accurate results.' },
              { icon: CheckCircle, title: 'Instant results', desc: 'See your accuracy, section breakdown, and which skills to focus on.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div>
                  <p className="font-semibold text-ink-body">{title}</p>
                  <p className="text-sm text-ink-subtle mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card.Content>
      </Card>

      {/* Tips */}
      <Card>
        <Card.Content className="pt-5">
          <p className="text-sm font-semibold text-ink-body mb-3">Tips for best results</p>
          <ul className="space-y-2 text-sm text-ink-muted">
            <li className="flex items-start gap-2">
              <span className="text-brand-500 font-bold mt-0.5">•</span>
              Find a quiet spot with {selectedOption.time} of uninterrupted time
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-500 font-bold mt-0.5">•</span>
              Answer every question; guessing beats skipping
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-500 font-bold mt-0.5">•</span>
              Don't look anything up; honest answers give the best study plan
            </li>
          </ul>
        </Card.Content>
      </Card>

      {error && (
        <div role="alert" className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleStart}
        disabled={isStarting}
      >
        {isStarting ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Setting up your diagnostic…
          </>
        ) : (
          <>
            Start {selectedOption.label}
            <ArrowRight className="h-5 w-5 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}
