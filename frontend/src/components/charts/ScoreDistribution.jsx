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
import useChartTheme from './useChartTheme';

const ScoreDistribution = ({ data = [], height = 200 }) => {
  const t = useChartTheme();
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
        <CartesianGrid strokeDasharray="none" stroke={t.grid} strokeWidth={1} />
        <XAxis
          dataKey="range"
          tick={{ fontSize: 12, fill: t.axis }}
          tickLine={{ stroke: t.grid }}
          axisLine={{ stroke: t.grid, strokeWidth: 1 }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: t.axis }}
          tickLine={{ stroke: t.grid }}
          axisLine={{ stroke: t.grid, strokeWidth: 1 }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={t.tooltip}
          formatter={(value) => [value, 'Students']}
          labelFormatter={(label) => `Score: ${label}%`}
        />
        <Bar dataKey="count" fill={t.brand} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default ScoreDistribution;
