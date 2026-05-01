/**
 * ──────────────────────────────────────────────
 *  dashboard.js — Authority dashboard page
 * ──────────────────────────────────────────────
 *
 *  Handles everything on the "Authority Dashboard" page:
 *    • Officer login / logout (JWT-based)
 *    • Report list with filters (status, type, zone, date range)
 *    • Report detail modal (view video, update status, assign officer)
 *    • CSV and PDF export
 */

import L from 'leaflet';
import { jsPDF } from 'jspdf';
import { $, request, showToast, escapeHtml } from './utils.js';
import { markerIcon, severityColor } from './map.js';

/* ── Module state ── */
let allReports = [];    // Array of report objects fetched from the API
let activeReport = null; // The report currently open in the detail modal
let modalMap = null;     // Leaflet map inside the modal

/* ── Authentication ── */

/**
 * Handle officer login form submission.
 * On success, stores the JWT token in localStorage
 * and switches the dashboard to the authenticated view.
 */
async function login(event) {
  event.preventDefault();
  try {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: $('#loginEmail').value,
        password: $('#loginPassword').value
      })
    });
    localStorage.setItem('noise_portal_token', data.token);
    showToast('Officer login successful.');
    renderDashboardState();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/**
 * Clear the stored JWT and reset dashboard state.
 */
function logout() {
  localStorage.removeItem('noise_portal_token');
  allReports = [];
  activeReport = null;
  showToast('Logged out.');
  renderDashboardState();
}

/* ── Dashboard State ── */

/**
 * Toggle between the login panel and the main dashboard panel
 * based on whether a JWT token exists in localStorage.
 */
export function renderDashboardState() {
  const loggedIn = Boolean(localStorage.getItem('noise_portal_token'));

  $('#loginPanel').classList.toggle('hidden', loggedIn);
  $('#dashboardPanel').classList.toggle('hidden', !loggedIn);

  if (loggedIn) {
    setTimeout(() => {
      loadReports();
    }, 50);
  }
}

/* ── Filters ── */

/**
 * Read the current filter values from the dashboard filter bar.
 * Returns an object suitable for URLSearchParams.
 */
function currentFilters() {
  return {
    status: $('#filterStatus').value,
    violationType: $('#filterViolation').value,
    zoneType: $('#filterZone').value,
    from: $('#filterFrom').value,
    to: $('#filterTo').value
  };
}

/* ── Load & Render Reports ── */

/**
 * Fetch reports from the API using current filters,
 * then render the table.
 */
async function loadReports() {
  try {
    const data = await request(`/api/reports?${new URLSearchParams(currentFilters())}`);
    allReports = data.reports || [];
    renderReports();
  } catch (error) {
    showToast(error.message, 'error');
    // If the token expired, log the officer out automatically
    if (error.message.toLowerCase().includes('token')) logout();
  }
}

/**
 * Build table rows from the allReports array
 * and insert them into the reports table body.
 */
function renderReports() {
  const body = $('#reportsTableBody');
  body.innerHTML = '';

  // Show "no results" message when the list is empty
  $('#emptyReports').classList.toggle('hidden', allReports.length > 0);

  allReports.forEach((report) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${escapeHtml(report.referenceId)}</strong></td>
      <td>${new Date(report.submittedAt).toLocaleString()}</td>
      <td>${escapeHtml(report.location?.address || 'Map selected')}</td>
      <td>${escapeHtml(report.violationType)}</td>
      <td>${statusBadge(report.status)}</td>
      <td><button class="outline-button" type="button" data-view-report="${report.id}">View</button></td>
    `;
    body.appendChild(row);
  });
}

/**
 * Return a coloured HTML badge for the report status.
 *
 * Pending      → default yellow
 * Under Review → blue
 * Action Taken → green
 * Rejected     → red
 */
function statusBadge(status) {
  const className =
    status === 'Under Review' ? 'review' :
    status === 'Action Taken' ? 'done' :
    status === 'Rejected' ? 'rejected' : '';

  return `<span class="status-badge ${className}">${escapeHtml(status || 'Pending')}</span>`;
}

/* ── Report Detail Modal ── */

/**
 * Open the detail modal for a specific report.
 * Fills in all fields (video, location, editable status/officer/notes).
 */
function openReportModal(reportId) {
  activeReport = allReports.find((report) => report.id === reportId);
  if (!activeReport) return;

  // Fill modal header
  $('#modalTitle').textContent = activeReport.referenceId;
  $('#modalTime').textContent = new Date(activeReport.submittedAt).toLocaleString();
  $('#modalVideo').src = activeReport.videoUrl;

  // Fill detail fields + editable controls
  $('#modalDetails').innerHTML = `
    ${detailHtml('Location', activeReport.location?.address || `${activeReport.location?.latitude}, ${activeReport.location?.longitude}`)}
    ${detailHtml('Vehicle', activeReport.vehicleType)}
    ${detailHtml('Violation', activeReport.violationType)}
    ${detailHtml('Zone', activeReport.zoneType)}
    ${detailHtml('Noise level', `${activeReport.noiseLevel} dB`)}
    ${detailHtml('Description', activeReport.description || 'Not provided')}
    ${detailHtml('Citizen contact', activeReport.citizenContact || 'Anonymous')}
    <div class="field">
      <label for="modalStatus">Status</label>
      <select id="modalStatus">
        <option>Pending</option>
        <option>Under Review</option>
        <option>Action Taken</option>
        <option>Rejected</option>
      </select>
    </div>
    <div class="field">
      <label for="modalOfficer">Assigned officer</label>
      <input id="modalOfficer" type="text" value="${escapeHtml(activeReport.assignedOfficer || '')}" />
    </div>
    <div class="field">
      <label for="modalNotes">Internal notes</label>
      <textarea id="modalNotes">${escapeHtml(activeReport.notes || '')}</textarea>
    </div>
    <button class="primary-button full-width" id="saveReportUpdate" type="button">Save Updates</button>
  `;

  // Set status dropdown to the current value
  $('#modalStatus').value = activeReport.status || 'Pending';
  $('#reportModal').classList.remove('hidden');

  // Initialise the modal's map after the DOM updates
  setTimeout(initModalMap, 50);
}

/**
 * Create a read-only detail row (label + value).
 */
function detailHtml(label, value) {
  return `<div class="detail-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

/**
 * Create a fresh Leaflet map inside the modal.
 * Previous map is removed to avoid overlap bugs.
 */
function initModalMap() {
  if (modalMap) {
    modalMap.remove();
    modalMap = null;
  }

  const { latitude, longitude } = activeReport.location;
  modalMap = L.map('modalMap').setView([latitude, longitude], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(modalMap);

  L.marker([latitude, longitude], {
    icon: markerIcon(severityColor(activeReport.noiseLevel))
  }).addTo(modalMap);

  // Leaflet needs a moment after the modal renders to measure the correct container size
  setTimeout(() => modalMap.invalidateSize(), 100);
}

/**
 * Close the report detail modal.
 * Stops video playback and destroys the modal map.
 */
function closeReportModal() {
  $('#reportModal').classList.add('hidden');
  $('#modalVideo').pause();
  $('#modalVideo').src = '';

  if (modalMap) {
    modalMap.remove();
    modalMap = null;
  }
}

/**
 * Save officer updates (status, assigned officer, notes)
 * for the currently open report.
 */
async function saveReportUpdate() {
  if (!activeReport) return;

  try {
    const data = await request(`/api/reports/${activeReport.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: $('#modalStatus').value,
        assignedOfficer: $('#modalOfficer').value,
        notes: $('#modalNotes').value
      })
    });

    // Update local data with the server response
    allReports = allReports.map((report) => (report.id === activeReport.id ? data.report : report));
    activeReport = data.report;
    renderReports();
    showToast('Report updated.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/* ── Export Functions ── */

/**
 * Export the current reports list as a CSV file.
 * Creates a Blob URL and triggers a download.
 */
function exportCsv() {
  const header = ['Reference ID', 'Date/Time', 'Location', 'Violation Type', 'Zone', 'Noise Level', 'Status'];

  const rows = allReports.map((report) => [
    report.referenceId,
    new Date(report.submittedAt).toISOString(),
    report.location?.address || `${report.location?.latitude}, ${report.location?.longitude}`,
    report.violationType,
    report.zoneType,
    report.noiseLevel,
    report.status
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n');

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'noise-reports.csv';
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export the current reports list as a PDF file.
 * Uses jsPDF library. Shows up to 35 reports (one page).
 */
function exportPdf() {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Noise Pollution Reports', 14, 18);
  doc.setFontSize(10);

  allReports.slice(0, 35).forEach((report, index) => {
    doc.text(
      `${report.referenceId} | ${report.violationType} | ${report.status} | ${report.noiseLevel} dB`,
      14,
      30 + index * 7
    );
  });

  doc.save('noise-reports.pdf');
}

/* ── Event Binding ── */

/**
 * Attach all event listeners for the Authority Dashboard page.
 * Called once from main.js during app initialisation.
 */
export function bindDashboardEvents() {
  // Auth
  $('#loginForm').addEventListener('submit', login);
  $('#logoutButton').addEventListener('click', logout);

  // Toolbar buttons
  $('#refreshReports').addEventListener('click', loadReports);
  $('#exportCsv').addEventListener('click', exportCsv);
  $('#exportPdf').addEventListener('click', exportPdf);

  // Filter dropdowns and date pickers — reload reports on change
  ['#filterStatus', '#filterViolation', '#filterZone', '#filterFrom', '#filterTo'].forEach((selector) => {
    $(selector).addEventListener('change', loadReports);
  });

  // Table row "View" buttons — uses event delegation on the table body
  $('#reportsTableBody').addEventListener('click', (event) => {
    const button = event.target.closest('[data-view-report]');
    if (button) openReportModal(button.dataset.viewReport);
  });

  // Modal close
  $('#closeModal').addEventListener('click', closeReportModal);
  $('#reportModal').addEventListener('click', (event) => {
    if (event.target.id === 'reportModal') closeReportModal();   // Click outside modal card
    if (event.target.id === 'saveReportUpdate') saveReportUpdate(); // Save button
  });
}
