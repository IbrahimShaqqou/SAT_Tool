/**
 * Full-Length SAT Practice Test Page
 * Matches College Board Bluebook format with 4 modules
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../../components/ui';
import { ModuleStartScreen } from '../../components/test/ModuleStartScreen';
import { ModuleTestInterface } from '../../components/test/ModuleTestInterface';
import { ModuleCompleteScreen } from '../../components/test/ModuleCompleteScreen';
import { BreakScreen } from '../../components/test/BreakScreen';
import { practiceService } from '../../services';

/**
 * Test Flow States:
 * - 'loading' - Initial load
 * - 'module_start' - Show module start screen
 * - 'module_test' - Active test-taking
 * - 'module_complete' - Review before submit
 * - 'break' - 10-minute break
 * - 'test_complete' - All modules done, redirect to results
 */

const FullLengthTestPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Test and module state
  const [testSession, setTestSession] = useState(null);
  const [modules, setModules] = useState([]);
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [flowState, setFlowState] = useState('loading');
  const [error, setError] = useState(null);

  // Fetch test session
  useEffect(() => {
    const fetchTest = async () => {
      try {
        const response = await practiceService.getFullLengthTest(id);
        const data = response.data;
        setTestSession(data);
        setModules(data.modules || []);

        // Determine starting state
        const inProgressModule = data.modules?.find(m => m.status === 'in_progress');
        const notStartedModule = data.modules?.find(m => m.status === 'not_started');

        if (inProgressModule) {
          // Resume in-progress module
          const moduleIdx = data.modules.indexOf(inProgressModule);
          setCurrentModuleIndex(moduleIdx);
          setFlowState('module_test');
        } else if (notStartedModule) {
          // Start next module
          const moduleIdx = data.modules.indexOf(notStartedModule);
          setCurrentModuleIndex(moduleIdx);
          setFlowState('module_start');
        } else if (data.status === 'completed') {
          // Test already completed
          navigate(`/student/full-length/${id}/results`);
        }
      } catch (err) {
        console.error('Error fetching test:', err);
        setError(err.response?.data?.error || 'Failed to load test');
      }
    };

    fetchTest();
  }, [id, navigate]);

  const currentModule = modules[currentModuleIndex];

  // Handle module start
  const handleModuleStart = async () => {
    try {
      await practiceService.startModule(currentModule.id);
      // Update module status locally
      const updatedModules = [...modules];
      updatedModules[currentModuleIndex] = {
        ...updatedModules[currentModuleIndex],
        status: 'in_progress',
      };
      setModules(updatedModules);
      setFlowState('module_test');
    } catch (err) {
      console.error('Error starting module:', err);
      setError(err.response?.data?.error || 'Failed to start module');
    }
  };

  // Handle moving to module complete screen
  const handleReadyToSubmit = () => {
    setFlowState('module_complete');
  };

  // Handle module submission
  const handleModuleSubmit = async (timeExpired = false) => {
    try {
      await practiceService.submitModule(currentModule.id, timeExpired);

      // Update module status
      const updatedModules = [...modules];
      updatedModules[currentModuleIndex] = {
        ...updatedModules[currentModuleIndex],
        status: 'completed',
      };
      setModules(updatedModules);

      // Check if there's a break after this module
      const isBreakAfterModule = currentModuleIndex === 1; // Break after Math Module 2

      if (isBreakAfterModule) {
        setFlowState('break');
      } else if (currentModuleIndex < modules.length - 1) {
        // Move to next module
        setCurrentModuleIndex(currentModuleIndex + 1);
        setFlowState('module_start');
      } else {
        // Test complete
        navigate(`/student/full-length/${id}/results`);
      }
    } catch (err) {
      console.error('Error submitting module:', err);
      setError(err.response?.data?.error || 'Failed to submit module');
    }
  };

  // Handle break end
  const handleBreakEnd = () => {
    setCurrentModuleIndex(currentModuleIndex + 1);
    setFlowState('module_start');
  };

  // Loading state
  if (flowState === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Test</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={() => navigate('/student')}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Render appropriate screen based on flow state
  return (
    <div className="min-h-screen bg-gray-50">
      {flowState === 'module_start' && (
        <ModuleStartScreen
          module={currentModule}
          moduleNumber={currentModuleIndex + 1}
          totalModules={modules.length}
          onStart={handleModuleStart}
        />
      )}

      {flowState === 'module_test' && (
        <ModuleTestInterface
          module={currentModule}
          moduleNumber={currentModuleIndex + 1}
          totalModules={modules.length}
          onReadyToSubmit={handleReadyToSubmit}
        />
      )}

      {flowState === 'module_complete' && (
        <ModuleCompleteScreen
          module={currentModule}
          moduleNumber={currentModuleIndex + 1}
          onSubmit={handleModuleSubmit}
          onBack={() => setFlowState('module_test')}
        />
      )}

      {flowState === 'break' && (
        <BreakScreen
          breakDuration={10}
          onEnd={handleBreakEnd}
        />
      )}
    </div>
  );
};

export default FullLengthTestPage;
