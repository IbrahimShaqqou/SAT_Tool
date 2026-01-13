/**
 * Skill Breakdown Chart
 * Horizontal bar chart showing accuracy by skill
 * Supports dark mode
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';

const getBarColor = (accuracy) => {
  if (accuracy >= 80) return '#059669'; // green
  if (accuracy >= 60) return '#d97706'; // amber
  return '#dc2626'; // red
};

const SkillBreakdown = ({ data = [], height = 300 }) => {
  const { isDarkMode } = useTheme();

  // Sample data if none provided
  const chartData = data.length > 0 ? data : [
    { name: 'Linear Equations', accuracy: 85, questions: 45 },
    { name: 'Quadratics', accuracy: 72, questions: 32 },
    { name: 'Word Problems', accuracy: 68, questions: 28 },
    { name: 'Geometry', accuracy: 55, questions: 20 },
    { name: 'Statistics', accuracy: 78, questions: 35 },
  ];

  // Sort by accuracy ascending (weakest first)
  const sortedData = [...chartData].sort((a, b) => a.accuracy - b.accuracy);

  // Dark mode colors
  const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
  const axisColor = isDarkMode ? '#9ca3af' : '#6b7280';
  const labelColor = isDarkMode ? '#d1d5db' : '#374151';
  const tooltipBg = isDarkMode ? '#1f2937' : '#fff';
  const tooltipBorder = isDarkMode ? '#374151' : '#d1d5db';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={sortedData}
        layout="vertical"
        margin={{ top: 10, right: 30, left: 100, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="none"
          stroke={gridColor}
          strokeWidth={1}
          horizontal={true}
          vertical={true}
        />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: axisColor }}
          tickLine={{ stroke: gridColor }}
          axisLine={{ stroke: axisColor, strokeWidth: 1 }}
          tickFormatter={(value) => `${value}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: labelColor }}
          tickLine={{ stroke: gridColor }}
          axisLine={{ stroke: axisColor, strokeWidth: 1 }}
          width={90}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: '8px',
            fontSize: '14px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            color: labelColor,
          }}
          formatter={(value, name, props) => [
            `${value}% (${props.payload.questions} questions)`,
            'Accuracy',
          ]}
        />
        <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
          {sortedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.accuracy)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default SkillBreakdown;
