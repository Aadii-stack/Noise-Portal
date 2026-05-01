/**
 * ──────────────────────────────────────────────
 *  stats.js — Public statistics page
 * ──────────────────────────────────────────────
 *
 *  Fetches aggregated, anonymised statistics from the API
 *  and renders them as four violation-type cards with
 *  relative bar charts.
 *
 *  No personal details, videos, or officer data is exposed
 *  on this page — only counts by violation type.
 */

import { $, request, showToast, escapeHtml } from './utils.js';

/**
 * Fetch public stats from the API and render the cards.
 */
export async function loadPublicStats() {
  try {
    const data = await request('/api/reports/stats/public');
    renderPublicStats(data.stats);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/**
 * Build the four stat cards from server data.
 * Each card shows the violation type name, count, and a
 * proportional bar (relative to the highest count).
 */
function renderPublicStats(stats) {
  const counts = stats.byViolationType || {};

  const entries = [
    ['Excessive honking', counts['Excessive honking'] || 0],
    ['Loud music', counts['Loud music'] || 0],
    ['Construction noise', counts['Construction noise'] || 0],
    ['Vehicle revving', counts['Vehicle revving'] || 0]
  ];

  // Avoid division by zero — max is at least 1
  const maxValue = Math.max(1, ...entries.map(([, value]) => value));

  $('#statsGrid').innerHTML = entries
    .map(([label, value]) => summaryStatCard(label, value, percent(value, maxValue)))
    .join('');
}

/**
 * Calculate a percentage relative to a maximum value.
 */
function percent(value, maxValue) {
  if (!maxValue) return 0;
  return Math.round((Number(value) / Number(maxValue)) * 100);
}

/**
 * Return HTML for a single stat card.
 * The --bar CSS custom property controls the bar fill width.
 */
function summaryStatCard(label, value, barPercent) {
  return `
    <article class="stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <div style="--bar: ${Math.max(0, Math.min(100, Number(barPercent) || 0))}%"></div>
    </article>
  `;
}
