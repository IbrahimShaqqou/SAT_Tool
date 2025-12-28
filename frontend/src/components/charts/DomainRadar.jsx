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

const DomainRadar = ({ data = [], height = 300 }) => {
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
        <PolarGrid
          stroke="#d1d5db"
          strokeWidth={1}
          gridType="polygon"
        />
        <PolarAngleAxis
          dataKey="domain"
          tick={{ fontSize: 12, fill: '#374151' }}
          stroke="#9ca3af"
        />
        <PolarRadiusAxis
          angle={30}
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: '#6b7280' }}
          tickFormatter={(value) => `${value}%`}
          stroke="#d1d5db"
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
        <Radar
          name="Accuracy"
          dataKey="accuracy"
          stroke="#374151"
          fill="#374151"
          fillOpacity={0.3}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
};

export default DomainRadar;
