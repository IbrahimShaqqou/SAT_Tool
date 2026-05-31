/**
 * Domain Radar Chart
 * Radar chart showing performance across domains
 */
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import useChartTheme from './useChartTheme';

const DomainRadar = ({ data = [], height = 300 }) => {
  const t = useChartTheme();

  // Sample data if none provided
  const chartData = data.length > 0 ? data : [
    { domain: 'Algebra', accuracy: 78, fullMark: 100 },
    { domain: 'Geometry', accuracy: 65, fullMark: 100 },
    { domain: 'Statistics', accuracy: 82, fullMark: 100 },
    { domain: 'Reading', accuracy: 71, fullMark: 100 },
    { domain: 'Writing', accuracy: 75, fullMark: 100 },
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
        <PolarGrid stroke={t.grid} strokeWidth={1} gridType="polygon" />
        <PolarAngleAxis dataKey="domain" tick={{ fontSize: 12, fill: t.label }} stroke={t.grid} />
        <PolarRadiusAxis
          angle={30}
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: t.axis }}
          tickFormatter={(value) => `${value}%`}
          stroke={t.grid}
        />
        <Tooltip contentStyle={t.tooltip} formatter={(value) => [`${value}%`, 'Accuracy']} />
        <Radar
          name="Accuracy"
          dataKey="accuracy"
          stroke={t.brand}
          fill={t.brand}
          fillOpacity={0.28}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
};

export default DomainRadar;
