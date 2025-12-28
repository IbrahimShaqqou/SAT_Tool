/**
 * Accuracy Trend Chart
 * Line chart showing accuracy over time
 */
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const AccuracyTrend = ({ data = [], height = 300 }) => {
  // Sample data if none provided
  const chartData = data.length > 0 ? data : [
    { date: 'Week 1', accuracy: 65 },
    { date: 'Week 2', accuracy: 68 },
    { date: 'Week 3', accuracy: 72 },
    { date: 'Week 4', accuracy: 70 },
    { date: 'Week 5', accuracy: 75 },
    { date: 'Week 6', accuracy: 78 },
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={chartData}
        margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="none"
          stroke="#e5e7eb"
          strokeWidth={1}
          vertical={true}
          horizontal={true}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={{ stroke: '#d1d5db' }}
          axisLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={{ stroke: '#d1d5db' }}
          axisLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
          formatter={(value) => [`${value}%`, 'Accuracy']}
        />
        <Line
          type="monotone"
          dataKey="accuracy"
          stroke="#374151"
          strokeWidth={2}
          dot={{ fill: '#374151', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, fill: '#374151' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default AccuracyTrend;
