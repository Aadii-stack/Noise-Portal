/**
 * ──────────────────────────────────────────────
 *  main.js — Application entry point
 * ──────────────────────────────────────────────
 *
 *  This is the only file loaded by index.html.
 *
 *  It does three things:
 *    1. Imports styles + Leaflet CSS
 *    2. Injects HTML partials into the page shell
 *    3. Binds events and starts the app
 *
 *  File structure:
 *    css/           → Split stylesheets (base, layout, components, pages)
 *    pages/         → HTML partials for each page section
 *    utils.js       → DOM helpers, API wrapper, toast, HTML escape
 *    i18n.js        → English / Hindi translations
 *    map.js         → Shared Leaflet map helpers
 *    report.js      → Citizen report submission page
 *    dashboard.js   → Authority dashboard (login, table, modal, export)
 *    stats.js       → Public statistics cards
 */

/* ── Styles ── */
import './styles.css';
import 'leaflet/dist/leaflet.css';

/* ── HTML Partials (loaded as raw strings by Vite) ── */
import homeHtml from './pages/home.html?raw';
import submitHtml from './pages/submit.html?raw';
import dashboardHtml from './pages/dashboard.html?raw';
import statsHtml from './pages/stats.html?raw';
import modalHtml from './pages/modal.html?raw';

/* ── JS Modules ── */
import { $, $$ } from './utils.js';
import { applyLanguage, toggleLanguage } from './i18n.js';
import { initReportMap, bindReportEvents } from './report.js';
import { renderDashboardState, bindDashboardEvents } from './dashboard.js';
import { loadPublicStats } from './stats.js';

/* ── Inject HTML partials into page shell ── */
$('#homePage').innerHTML = homeHtml;
$('#submitPage').innerHTML = submitHtml;
$('#dashboardPage').innerHTML = dashboardHtml;
$('#statsPage').innerHTML = statsHtml;
$('#reportModal').innerHTML = modalHtml;

/* ── Page Navigation ── */

/**
 * Switch between pages (Home / Submit / Dashboard / Stats).
 *
 * Each page is a <section class="page"> in index.html.
 * Only the active page has display: block (via .active class).
 * Navigation buttons use data-page-target="pageName" attributes.
 */
function showPage(pageName) {
  // Hide all pages, then show the target
  $$('.page').forEach((page) => page.classList.remove('active'));
  $(`#${pageName}Page`).classList.add('active');

  // Highlight the active nav button
  $$('.nav-button').forEach((button) =>
    button.classList.toggle('active', button.dataset.pageTarget === pageName)
  );

  // Page-specific initialisation
  if (pageName === 'submit') setTimeout(initReportMap, 50);
  if (pageName === 'dashboard') renderDashboardState();
  if (pageName === 'stats') loadPublicStats();
}

/* ── Bind Global Events ── */

// Navigation buttons (header nav + hero CTA)
$$('[data-page-target]').forEach((button) => {
  button.addEventListener('click', () => showPage(button.dataset.pageTarget));
});

// Language toggle (English ↔ Hindi)
$('#languageToggle').addEventListener('click', toggleLanguage);

// Page-specific event bindings
bindReportEvents();
bindDashboardEvents();

/* ── Initialise ── */

// Apply translations on first load
applyLanguage();

// If stats page is already visible, load data immediately
if (document.querySelector('#statsPage.active')) {
  loadPublicStats();
}
