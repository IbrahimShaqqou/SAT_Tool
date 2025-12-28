/**
 * Skill Breakdown Chart
 * Horizontal bar chart showing accuracy by skill
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

const getBarColor = (accuracy) => {
  if (accuracy >= 80) return '#059669'; // green
  if (accuracy >= 60) return '#d97706'; // amber
  return '#dc2626'; // red
};

const SkillBreakdown = ({ data = [], height = 300 }) => {
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

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={sortedData}
        layout="vertical"
        margin={{ top: 10, right: 30, left: 100, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="none"
          stroke="#e5e7eb"
          strokeWidth={1}
          horizontal={true}
          vertical={true}
        />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={{ stroke: '#d1d5db' }}
          axisLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
          tickFormatter={(value) => `${value}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: '#374151' }}
          tickLine={{ stroke: '#d1d5db' }}
          axisLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
          width={90}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
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
