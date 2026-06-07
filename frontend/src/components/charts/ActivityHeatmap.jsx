/**
 * Activity Heatmap
 * Shows practice activity by day
 */

const ActivityHeatmap = ({ data = [], weeks = 12 }) => {
  // Generate sample data if none provided
  const generateSampleData = () => {
    const days = [];
    const today = new Date();

    for (let i = weeks * 7 - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      days.push({
        date: date.toISOString().split('T')[0],
        count: Math.random() > 0.3 ? Math.floor(Math.random() * 20) : 0,
      });
    }
    return days;
  };

  const activityData = data.length > 0 ? data : generateSampleData();

  // Group by weeks
  const weekGroups = [];
  for (let i = 0; i < activityData.length; i += 7) {
    weekGroups.push(activityData.slice(i, i + 7));
  }

  // Get color based on activity count
  const getColor = (count) => {
    if (count === 0) return 'bg-surface-muted';
    if (count <= 5) return 'bg-brand-200';
    if (count <= 10) return 'bg-brand-400';
    if (count <= 15) return 'bg-brand-600';
    return 'bg-brand-800';
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-2">
      {/* Day labels */}
      <div className="flex gap-1 pl-8">
        {dayLabels.map((day, i) => (
          <span key={i} className="text-xs text-ink-faint w-4 text-center">
            {i % 2 === 1 ? day.charAt(0) : ''}
          </span>
        ))}
      </div>

      {/* Heatmap grid */}
      <div className="flex gap-1">
        <div className="flex flex-col gap-1 pr-2">
          {weekGroups.map((_, i) => (
            <span key={i} className="text-xs text-ink-faint h-4 leading-4">
              {i % 4 === 0 ? `W${i + 1}` : ''}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          {weekGroups.map((week, weekIndex) => (
            <div key={weekIndex} className="flex gap-1">
              {week.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className={`w-4 h-4 rounded-sm border border-edge ${getColor(day.count)}`}
                  title={`${day.date}: ${day.count} questions`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 pt-2">
        <span className="text-xs text-ink-subtle">Less</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-sm bg-surface-muted" />
          <div className="w-3 h-3 rounded-sm bg-brand-200" />
          <div className="w-3 h-3 rounded-sm bg-brand-400" />
          <div className="w-3 h-3 rounded-sm bg-brand-600" />
          <div className="w-3 h-3 rounded-sm bg-brand-800" />
        </div>
        <span className="text-xs text-ink-subtle">More</span>
      </div>
    </div>
  );
};

export default ActivityHeatmap;
