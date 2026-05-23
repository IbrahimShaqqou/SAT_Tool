/**
 * Module Start Screen
 * Shows module info and "Start Module" button
 * Matches Bluebook module start screen
 */

const ModuleStartScreen = ({ module, moduleNumber, totalModules, onStart }) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="max-w-2xl w-full px-8 text-center">
        {/* College Board style header */}
        <div className="mb-8">
          <div className="text-sm text-gray-500 uppercase tracking-wide mb-2">
            Module {moduleNumber} of {totalModules}
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {module.title}
          </h1>
        </div>

        {/* Module details */}
        <div className="bg-gray-50 rounded-lg p-8 mb-8">
          <div className="grid grid-cols-2 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-[#0077C8] mb-2">
                {module.total_questions}
              </div>
              <div className="text-sm text-gray-600 uppercase tracking-wide">
                Questions
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#0077C8] mb-2">
                {module.time_limit_minutes}
              </div>
              <div className="text-sm text-gray-600 uppercase tracking-wide">
                Minutes
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-left mb-8 space-y-4 text-gray-700">
          <p>
            <strong>Before you begin:</strong>
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>You will have <strong>{module.time_limit_minutes} minutes</strong> to complete this module</li>
            <li>You can navigate between questions freely within this module</li>
            <li>Mark questions for review if you want to revisit them</li>
            <li>Once you submit, you <strong>cannot</strong> return to this module</li>
            {module.subject_area === 'MATH' && (
              <>
                <li>A calculator and reference sheet are available</li>
              </>
            )}
          </ul>
        </div>

        {/* Start button */}
        <div className="flex justify-center">
          <button
            onClick={onStart}
            className="px-12 py-4 bg-[#0077C8] text-white text-lg font-semibold rounded-lg hover:bg-[#005fa3] transition-colors shadow-md"
          >
            Start Module
          </button>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-sm text-gray-500">
          The timer will start when you click "Start Module"
        </p>
      </div>
    </div>
  );
};

export { ModuleStartScreen };
