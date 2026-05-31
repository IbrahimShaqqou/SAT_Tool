/**
 * Public layout for login/register pages
 * Split panel: brand left, form right
 * Supports dark mode
 */
import { Outlet } from 'react-router-dom';

const PublicLayout = () => {
  return (
    <div className="min-h-screen flex bg-surface-page">
      {/* Left brand panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 flex-col justify-between p-10 bg-brand-600">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <span className="text-white font-bold text-sm">Z</span>
          </div>
          <span className="text-white font-semibold text-[15px] tracking-tight">ZooPrep</span>
        </div>

        {/* Center content */}
        <div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            The smarter way to prepare for the Digital SAT
          </h2>
          <p className="text-brand-100/80 text-[15px] leading-relaxed mb-8">
            Adaptive practice, AI explanations, and expert lessons — all in one place.
          </p>
          <div className="space-y-3">
            {[
              '3,271 real Digital SAT questions',
              'AI-powered step-by-step explanations',
              'Adaptive difficulty targeting',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-white/80 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <p className="text-white/40 text-xs">&copy; {new Date().getFullYear()} ZooPrep</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col justify-center py-12 px-6 sm:px-10 lg:px-16">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">Z</span>
          </div>
          <span className="text-ink-body font-semibold text-[15px] tracking-tight">ZooPrep</span>
        </div>

        <div className="w-full max-w-sm mx-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default PublicLayout;
