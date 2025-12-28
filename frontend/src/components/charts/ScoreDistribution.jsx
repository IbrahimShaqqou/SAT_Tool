/**
 * Score Distribution Chart
 * Histogram showing distribution of scores
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const ScoreDistribution = ({ data = [], height = 200 }) => {
  // Sample data if none provided (score ranges and counts)
  const chartData = data.length > 0 ? data : [
    { range: '0-20', count: 1 },
    { range: '21-40', count: 2 },
    { range: '41-60', count: 5 },
    { range: '61-80', count: 8 },
    { range: '81-100', count: 4 },
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="none"
          stroke="#e5e7eb"
          strokeWidth={1}
          horizontal={true}
          vertical={true}
        />
        <XAxis
          dataKey="range"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={{ stroke: '#d1d5db' }}
          axisLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={{ stroke: '#d1d5db' }}
          axisLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
          formatter={(value) => [value, 'Students']}
          labelFormatter={(label) => `Score: ${label}%`}
        />
        <Bar
          dataKey="count"
          fill="#374151"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default ScoreDistribution;
