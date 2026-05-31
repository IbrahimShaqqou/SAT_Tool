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
import useChartTheme from './useChartTheme';

const AccuracyTrend = ({ data = [], height = 300 }) => {
  const t = useChartTheme();

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
        <CartesianGrid strokeDasharray="none" stroke={t.grid} strokeWidth={1} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: t.axis }}
          tickLine={{ stroke: t.grid }}
          axisLine={{ stroke: t.grid, strokeWidth: 1 }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: t.axis }}
          tickLine={{ stroke: t.grid }}
          axisLine={{ stroke: t.grid, strokeWidth: 1 }}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip contentStyle={t.tooltip} formatter={(value) => [`${value}%`, 'Accuracy']} />
        <Line
          type="monotone"
          dataKey="accuracy"
          stroke={t.brand}
          strokeWidth={2.5}
          dot={{ fill: t.brand, strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, fill: t.brand }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default AccuracyTrend;
