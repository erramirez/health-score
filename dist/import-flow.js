import {METRICS} from './core.js';

export function availableSignals(rows) {
  return METRICS.filter(metric => rows.some(row => Number.isFinite(row[metric])));
}

export function defaultMusicalMappings(rows) {
  const available = new Set(availableSignals(rows));
  return {
    melody: ['mood', 'hrv', 'sleep'].find(metric => available.has(metric)) || 'none',
    rhythm: ['steps', 'activity'].find(metric => available.has(metric)) || 'none',
    tension: ['rhr', 'hrv', 'sleep'].find(metric => available.has(metric)) || 'none'
  };
}

export function preferredYear(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (!METRICS.some(metric => Number.isFinite(row[metric]))) continue;
    const year = row.date.slice(0, 4);
    counts.set(year, (counts.get(year) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] || null;
}
