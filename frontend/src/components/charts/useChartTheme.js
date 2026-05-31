/**
 * useChartTheme — one warm, theme-aware recharts palette shared by every chart
 * so dark mode is correct everywhere and the colors match Study Hall (amber
 * brand + pine accent). Replaces the per-chart hardcoded hex.
 */
import { useTheme } from '../../contexts/ThemeContext';

export default function useChartTheme() {
  const { isDarkMode } = useTheme();
  return {
    isDarkMode,
    grid: isDarkMode ? '#38312b' : '#e7e2da',
    axis: isDarkMode ? '#a8a097' : '#6b6560',
    label: isDarkMode ? '#d6cfc4' : '#44403c',
    // Series colors
    brand: isDarkMode ? '#d4933e' : '#bf7724',   // amber
    accent: isDarkMode ? '#558d64' : '#3a7249',  // pine
    // Performance tones (paired with text in legends/labels)
    good: isDarkMode ? '#558d64' : '#3a7249',
    warn: isDarkMode ? '#d4933e' : '#bf7724',
    bad: isDarkMode ? '#e07a6b' : '#c2410c',
    tooltip: {
      backgroundColor: isDarkMode ? '#211d1a' : '#ffffff',
      border: `1px solid ${isDarkMode ? '#38312b' : '#e7e2da'}`,
      borderRadius: '12px',
      fontSize: '13px',
      boxShadow: '0 4px 16px -4px rgba(0,0,0,0.18)',
      color: isDarkMode ? '#f5f1ea' : '#1c1917',
    },
    // Accuracy → series color
    toneFor(accuracy) {
      if (accuracy >= 75) return this.good;
      if (accuracy >= 55) return this.warn;
      return this.bad;
    },
  };
}
