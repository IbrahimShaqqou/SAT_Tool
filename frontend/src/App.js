/**
 * SAT Tutoring Platform - Main App Component
 *
 * Root component with routing configuration.
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Pages will be imported here as they are implemented
// import Home from './pages/Home';
// import Login from './pages/Login';
// import Dashboard from './pages/Dashboard';
// import Practice from './pages/Practice';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Routes will be added as pages are implemented */}
        {/* <Route path="/login" element={<Login />} /> */}
        {/* <Route path="/dashboard" element={<Dashboard />} /> */}
        {/* <Route path="/practice" element={<Practice />} /> */}
      </Routes>
    </div>
  );
}

// Temporary Home component - will be moved to pages/
function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          SAT Tutoring Platform
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Master the Digital SAT with personalized practice
        </p>
        <div className="space-x-4">
          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition">
            Get Started
          </button>
          <button className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition">
            Learn More
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
