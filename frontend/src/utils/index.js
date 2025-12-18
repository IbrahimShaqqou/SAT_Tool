/**
 * SAT Tutoring Platform - Utility Functions
 *
 * Helper functions used across the application.
 *
 * Utilities to be implemented:
 * - formatTime: Format seconds to MM:SS display
 * - formatDate: Format dates for display
 * - calculateProgress: Calculate percentage from scores
 * - getSkillColor: Get color based on mastery level (green/yellow/red)
 * - validateEmail: Email validation
 * - validatePassword: Password strength validation
 * - debounce: Debounce function execution
 * - classNames: Conditional class name joining
 */

/**
 * Format seconds into MM:SS display string.
 *
 * @param {number} seconds - Total seconds
 * @returns {string} Formatted time string
 */
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get color class based on mastery percentage.
 *
 * @param {number} percentage - Mastery percentage (0-100)
 * @returns {string} Tailwind color class
 */
export function getSkillColor(percentage) {
  if (percentage >= 80) return 'text-green-600 bg-green-100';
  if (percentage >= 60) return 'text-yellow-600 bg-yellow-100';
  return 'text-red-600 bg-red-100';
}

/**
 * Conditionally join class names.
 *
 * @param {...(string|object|array)} classes - Class names or conditional objects
 * @returns {string} Joined class names
 */
export function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

// Additional utilities will be added here as needed
