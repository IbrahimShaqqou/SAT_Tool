/**
 * Diagnostic Landing Page
 * Students start their self-serve 30-question diagnostic from here.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Clock, Target, CheckCircle, ArrowRight } from 'lucide-react';
import { Card, Button, LoadingSpinner } from '../../components/ui';
import diagnosticService from '../../services/diagnosticService';

export default function DiagnosticLandingPage() {
  const navigate = useNavigate();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState(null);

  const handleStart = async () => {
    setIsStarting(true);
    setError(null);
    try {
      const res = await diagnosticService.start();
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
            Take a 30-question diagnostic to get your estimated SAT score across both sections.
          </p>
        </div>
      </div>

      {/* What to expect */}
      <Card>
        <Card.Header>
          <Card.Title>What to expect</Card.Title>
        </Card.Header>
        <Card.Content>
          <div className="space-y-4">
            {[
              { icon: Clock, title: '20–30 minutes', desc: 'Questions are adaptive — faster if you\'re confident, slower if mixed.' },
              { icon: Target, title: '30 questions total', desc: '15 Math + 15 Reading & Writing, covering all SAT domains.' },
              { icon: CheckCircle, title: 'Instant results', desc: 'Get your estimated SAT score, section scores, and weakest skills.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card.Content>
      </Card>

      {/* Tips */}
      <Card>
        <Card.Content className="pt-5">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Tips for best results</p>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-brand-500 font-bold mt-0.5">•</span>
              Find a quiet spot with 25–30 minutes of uninterrupted time
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-500 font-bold mt-0.5">•</span>
              Answer every question — guessing beats skipping
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-500 font-bold mt-0.5">•</span>
              Don't look anything up — honest answers give the best study plan
            </li>
          </ul>
        </Card.Content>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
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
            Start Diagnostic
            <ArrowRight className="h-5 w-5 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}
