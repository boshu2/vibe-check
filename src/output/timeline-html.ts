import { format } from 'date-fns';
import { TimelineResult, TimelineDay, TimelineSession, OverallRating } from '../types.js';

/**
 * Format timeline as shareable HTML (self-contained single file)
 */
export function formatTimelineHtml(timeline: TimelineResult): string {
  const dateRange = `${format(timeline.from, 'MMM d')} - ${format(timeline.to, 'MMM d, yyyy')}`;
  const activeHours = Math.round(timeline.totalActiveMinutes / 60);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vibe-Check Timeline | ${dateRange}</title>
  <style>
    :root {
      --bg: #1a1a2e;
      --surface: #16213e;
      --text: #eee;
      --muted: #888;
      --accent: #00d9ff;
      --green: #4ade80;
      --blue: #60a5fa;
      --yellow: #facc15;
      --red: #f87171;
      --purple: #c084fc;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
    }

    header {
      text-align: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid var(--accent);
    }

    h1 {
      color: var(--accent);
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: var(--muted);
      font-size: 0.9rem;
    }

    .trend {
      font-size: 2rem;
      letter-spacing: 2px;
      margin: 1rem 0;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat {
      background: var(--surface);
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: bold;
      color: var(--accent);
    }

    .stat-label {
      color: var(--muted);
      font-size: 0.75rem;
      text-transform: uppercase;
    }

    .day {
      background: var(--surface);
      border-radius: 8px;
      margin-bottom: 1rem;
      overflow: hidden;
    }

    .day-header {
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }

    .day-date {
      font-weight: bold;
    }

    .rating {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: bold;
    }

    .rating-elite { background: var(--green); color: #000; }
    .rating-high { background: var(--blue); color: #000; }
    .rating-medium { background: var(--yellow); color: #000; }
    .rating-low { background: var(--red); color: #000; }

    .day-summary {
      padding: 0.5rem 1rem;
      color: var(--muted);
      font-size: 0.85rem;
    }

    .sessions {
      padding: 0.5rem 1rem 1rem;
    }

    .session {
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .session:last-child {
      border-bottom: none;
    }

    .session-time {
      color: var(--muted);
      font-size: 0.8rem;
    }

    .session-work {
      margin-top: 0.25rem;
    }

    .badge {
      display: inline-block;
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      font-size: 0.7rem;
      margin-left: 0.5rem;
    }

    .badge-flow { background: rgba(96, 165, 250, 0.2); color: var(--blue); }
    .badge-spiral { background: rgba(250, 204, 21, 0.2); color: var(--yellow); }

    .insights {
      background: var(--surface);
      border-radius: 8px;
      padding: 1.5rem;
      margin-top: 2rem;
    }

    .insights h2 {
      color: var(--accent);
      font-size: 1rem;
      margin-bottom: 1rem;
    }

    .insight {
      padding: 0.5rem 0;
      display: flex;
      gap: 0.75rem;
    }

    .insight-icon {
      font-size: 1.2rem;
    }

    footer {
      text-align: center;
      color: var(--muted);
      font-size: 0.75rem;
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(255,255,255,0.1);
    }

    footer a {
      color: var(--accent);
      text-decoration: none;
    }
  </style>
</head>
<body>
  <header>
    <h1>VIBE-CHECK TIMELINE</h1>
    <div class="subtitle">${dateRange}</div>
    <div class="trend">${buildTrendHtml(timeline.trend)}</div>
  </header>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">~${activeHours}h</div>
      <div class="stat-label">Active Time</div>
    </div>
    <div class="stat">
      <div class="stat-value">${timeline.totalCommits}</div>
      <div class="stat-label">Commits</div>
    </div>
    <div class="stat">
      <div class="stat-value">${timeline.totalFeatures}</div>
      <div class="stat-label">Features</div>
    </div>
    <div class="stat">
      <div class="stat-value">${timeline.flowStates}</div>
      <div class="stat-label">Flow States</div>
    </div>
    <div class="stat">
      <div class="stat-value">${timeline.totalSpirals}</div>
      <div class="stat-label">Spirals</div>
    </div>
    <div class="stat">
      <div class="stat-value">+${timeline.totalXp}</div>
      <div class="stat-label">XP Earned</div>
    </div>
  </div>

  ${timeline.days.map(day => formatDayHtml(day)).join('\n')}

  <div class="insights">
    <h2>INSIGHTS</h2>
    ${generateInsightsHtml(timeline)}
  </div>

  <footer>
    Generated by <a href="https://github.com/boshu2/vibe-check">vibe-check</a> on ${format(new Date(), 'yyyy-MM-dd HH:mm')}
  </footer>
</body>
</html>`;
}

/**
 * Build trend sparkline HTML with colors
 */
function buildTrendHtml(scores: (number | null)[]): string {
  const bars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

  return scores
    .map(score => {
      if (score === null) return '<span style="color: var(--muted)">▁</span>';
      const idx = Math.min(7, Math.floor(score / 12.5));
      const bar = bars[idx];
      if (score >= 80) return `<span style="color: var(--green)">${bar}</span>`;
      if (score >= 60) return `<span style="color: var(--blue)">${bar}</span>`;
      if (score >= 40) return `<span style="color: var(--yellow)">${bar}</span>`;
      return `<span style="color: var(--red)">${bar}</span>`;
    })
    .join('');
}

/**
 * Format a single day for HTML
 */
function formatDayHtml(day: TimelineDay): string {
  const ratingClass = `rating-${day.dayRating.toLowerCase()}`;
  const trophy = day.dayRating === 'ELITE' ? ' 🏆' : '';

  return `
  <div class="day">
    <div class="day-header">
      <span class="day-date">📅 ${day.displayDate}</span>
      <span class="rating ${ratingClass}">${day.dayScore}% ${day.dayRating}${trophy}</span>
    </div>
    <div class="day-summary">
      ${day.sessions.length} session${day.sessions.length > 1 ? 's' : ''},
      ${day.totalCommits} commits,
      ${day.spiralCount} spirals,
      +${day.totalXp} XP
    </div>
    <div class="sessions">
      ${day.sessions.map(session => formatSessionHtml(session)).join('\n')}
    </div>
  </div>`;
}

/**
 * Format a single session for HTML
 */
function formatSessionHtml(session: TimelineSession): string {
  const timeRange = `${format(session.start, 'HH:mm')}-${format(session.end, 'HH:mm')}`;
  const durationStr = formatDuration(session.duration);

  // Badges
  const flowBadge = session.flowState ? '<span class="badge badge-flow">🌊 Flow</span>' : '';
  const spiralBadge = session.spirals.length > 0 ? '<span class="badge badge-spiral">⚠️ Spiral</span>' : '';

  // Get main work summary
  const featCount = session.commits.filter(c => c.type === 'feat').length;
  const fixCount = session.commits.filter(c => c.type === 'fix').length;

  let workSummary = '';
  if (featCount > 0) {
    const firstFeat = session.commits.find(c => c.type === 'feat');
    workSummary = firstFeat ? escapeHtml(truncate(firstFeat.subject, 60)) : `${featCount} features`;
  } else if (fixCount > 0) {
    workSummary = `${fixCount} fix${fixCount > 1 ? 'es' : ''}`;
  } else {
    const first = session.commits[0];
    workSummary = escapeHtml(truncate(first.subject, 60));
  }

  return `
      <div class="session">
        <div class="session-time">${timeRange} (${durationStr})${flowBadge}${spiralBadge}</div>
        <div class="session-work">${workSummary}</div>
      </div>`;
}

/**
 * Generate insights HTML
 */
function generateInsightsHtml(timeline: TimelineResult): string {
  const insights: string[] = [];

  if (timeline.postDeleteSprint?.detected) {
    insights.push(`<div class="insight"><span class="insight-icon">⚡</span><span>${escapeHtml(timeline.postDeleteSprint.message)}</span></div>`);
  }

  if (timeline.flowStates > 0) {
    const avgFlowDuration = timeline.sessions
      .filter(s => s.flowState)
      .reduce((sum, s) => sum + s.duration, 0) / timeline.flowStates;
    insights.push(`<div class="insight"><span class="insight-icon">🌊</span><span>Flow states: ${timeline.flowStates} detected (avg ${Math.round(avgFlowDuration)} min)</span></div>`);
  }

  if (timeline.detours?.detected) {
    insights.push(`<div class="insight"><span class="insight-icon">🚧</span><span>${escapeHtml(timeline.detours.message)}</span></div>`);
  }

  if (timeline.lateNightSpirals?.detected) {
    insights.push(`<div class="insight"><span class="insight-icon">🌙</span><span>${escapeHtml(timeline.lateNightSpirals.message)}</span></div>`);
  }

  if (timeline.thrashing?.detected) {
    insights.push(`<div class="insight"><span class="insight-icon">🔄</span><span>${escapeHtml(timeline.thrashing.message)}</span></div>`);
  }

  if (timeline.totalSpirals > 0) {
    insights.push(`<div class="insight"><span class="insight-icon">⚠️</span><span>Debug spirals: ${timeline.totalSpirals} detected</span></div>`);
  }

  // Productivity ratio
  const wallClockHours = timeline.totalDays * 24;
  const activeHours = Math.round(timeline.totalActiveMinutes / 60);
  const efficiencyPercent = Math.round((activeHours / wallClockHours) * 100);
  insights.push(`<div class="insight"><span class="insight-icon">⏱️</span><span>Active time: ${activeHours}h of ${wallClockHours}h (${efficiencyPercent}% efficiency)</span></div>`);

  // Best day
  const bestDay = timeline.days.reduce((best, day) =>
    (day.dayScore || 0) > (best.dayScore || 0) ? day : best
  );
  if (bestDay.dayScore && bestDay.dayScore >= 80) {
    insights.push(`<div class="insight"><span class="insight-icon">🏆</span><span>Best day: ${bestDay.displayDate} (${bestDay.dayScore}%)</span></div>`);
  }

  return insights.join('\n    ');
}

/**
 * Format duration in human-readable form
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 1) + '…';
}

/**
 * Escape HTML entities
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
