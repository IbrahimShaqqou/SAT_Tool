/**
 * Public layout for login/register pages
 * Centered content with minimal design
 */
import { Outlet } from 'react-router-dom';

const PublicLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Logo */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-2xl font-semibold text-gray-900">
          ZooPrep
        </h1>
      </div>

      {/* Content */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm rounded-lg sm:px-10 border border-gray-200">
          <Outlet />
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-center text-sm text-gray-500">
        ZooPrep - SAT Preparation
      </p>
    </div>
  );
};

export default PublicLayout;
