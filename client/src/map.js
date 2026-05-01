/**
 * ──────────────────────────────────────────────
 *  map.js — Leaflet map helpers
 * ──────────────────────────────────────────────
 *
 *  Shared utilities for all Leaflet maps in the app:
 *    • Custom coloured marker icons
 *    • Noise-level → colour mapping
 *
 *  Each page module (report, dashboard, modal) creates
 *  its own map instance using these helpers.
 */

import L from 'leaflet';

/* ── Default centre: Mumbai ── */
export const MUMBAI = [19.076, 72.8777];

/**
 * Create a small circular Leaflet marker icon.
 *
 * @param {string} color - CSS colour for the pin, e.g. "#dc2626"
 * @returns {L.DivIcon}
 */
export function markerIcon(color = '#1e3a8a') {
  return L.divIcon({
    className: '',
    html: `<span class="map-pin" style="background:${color}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

/**
 * Map a noise level (dB) to a severity colour.
 *
 * ≥ 95 dB  → red    (dangerously loud)
 * ≥ 75 dB  → amber  (high noise)
 * < 75 dB  → blue   (moderate)
 *
 * @param {number} noiseLevel - Decibel reading
 * @returns {string} Hex colour
 */
export function severityColor(noiseLevel) {
  if (Number(noiseLevel) >= 95) return '#dc2626';
  if (Number(noiseLevel) >= 75) return '#f59e0b';
  return '#2563eb';
}
