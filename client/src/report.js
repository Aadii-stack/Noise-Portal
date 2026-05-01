/**
 * ──────────────────────────────────────────────
 *  report.js — Citizen report submission page
 * ──────────────────────────────────────────────
 *
 *  Handles everything on the "Submit Report" page:
 *    • Video upload with drag-and-drop + progress bar
 *    • Incident location map (click or GPS)
 *    • Form validation & submission to backend API
 *    • Form reset after successful submission
 */

import L from 'leaflet';
import { $, request, showToast } from './utils.js';
import { t } from './i18n.js';
import { MUMBAI, markerIcon } from './map.js';

/* ── Constants ── */
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi'];
const DEFAULT_CACHE_CONTROL = '3600';

/* ── Module state ── */
let selectedVideo = null; // File object chosen by the citizen
let reportMap = null;     // Leaflet map instance for location picking
let reportMarker = null;  // Draggable marker showing selected location

/* ── Map Initialisation ── */

/**
 * Create the Leaflet map inside #reportMap.
 * If already created, just tell Leaflet to recalculate its size
 * (needed when the page becomes visible after being hidden).
 */
export function initReportMap() {
  if (reportMap) {
    reportMap.invalidateSize();
    return;
  }

  reportMap = L.map('reportMap').setView(MUMBAI, 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(reportMap);

  // Place default marker at Mumbai centre
  reportMarker = L.marker(MUMBAI, { icon: markerIcon() }).addTo(reportMap);

  // Let the citizen click anywhere on the map to move the pin
  reportMap.on('click', (event) => setReportLocation(event.latlng.lat, event.latlng.lng, ''));
}

/* ── Location Helpers ── */

/**
 * Update the latitude / longitude input fields and move the map marker.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} address - Human-readable address (optional)
 */
function setReportLocation(latitude, longitude, address) {
  $('#latitude').value = latitude.toFixed(6);
  $('#longitude').value = longitude.toFixed(6);

  if (typeof address === 'string') {
    $('#address').value = address;
  }

  if (reportMarker) {
    reportMarker.setLatLng([latitude, longitude]);
    reportMap.setView([latitude, longitude], 15);
  }
}

/* ── Video Validation ── */

/**
 * Check file type and size before accepting.
 * Shows an error toast and returns false if invalid.
 */
function validateVideo(file) {
  if (!file) return false;

  const extension = file.name.split('.').pop().toLowerCase();
  const typeAllowed = ALLOWED_VIDEO_TYPES.includes(file.type) || ALLOWED_VIDEO_EXTENSIONS.includes(extension);

  if (!typeAllowed) {
    showToast('Only MP4, MOV, and AVI videos are allowed.', 'error');
    return false;
  }

  if (file.size > MAX_VIDEO_SIZE) {
    showToast('Video must be 100MB or smaller.', 'error');
    return false;
  }

  return true;
}

/**
 * Accept a video file — validates, stores it in module state,
 * and updates the UI to show the file name.
 */
function setSelectedVideo(file) {
  if (!validateVideo(file)) return;

  selectedVideo = file;
  $('#browseVideo').classList.add('hidden');
  $('#selectedVideo').classList.remove('hidden');
  $('#selectedVideoName').textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
}

/* ── Video Upload ── */

/**
 * Ask the backend for a signed Supabase upload URL, then stream the
 * file directly to storage with progress tracking.
 *
 * @param {File} file - Video file to upload
 * @returns {Promise<{videoUrl: string, storagePath: string}>}
 */
async function uploadVideo(file) {
  const uploadSession = await request('/api/upload/video', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      size: file.size
    })
  });

  if (!uploadSession?.signedUrl) {
    throw new Error('Upload session could not be created.');
  }

  return await new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('cacheControl', uploadSession.cacheControl || DEFAULT_CACHE_CONTROL);
    formData.append('', file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadSession.signedUrl);
    xhr.setRequestHeader('x-upsert', String(Boolean(uploadSession.upsert)));

    // Update progress bar as chunks are sent
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const progress = Math.round((event.loaded / event.total) * 100);
      $('#uploadProgressWrap').classList.remove('hidden');
      $('#uploadProgressText').textContent = `${progress}%`;
      $('#uploadProgressBar').style.width = `${progress}%`;
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          videoUrl: uploadSession.videoUrl,
          storagePath: uploadSession.storagePath
        });
        return;
      }

      const body = JSON.parse(xhr.responseText || '{}');
      reject(new Error(body.message || body.error || 'Upload failed'));
    };

    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(formData);
  });
}

/* ── Form Submission ── */

/**
 *  Collect all form data, upload the video, then POST
 *  the report payload to the backend.
 */
 async function submitReport(event) {
  event.preventDefault();

  if (!selectedVideo) {
    showToast('Please upload a video evidence file.', 'error');
    return;
  }

  const description = $('#description').value.trim();
  const citizenContact = $('#citizenContact').value.trim();

  if (description.length < 5) {
    showToast('Description must be at least 5 characters long.', 'error');
    return;
  }

  if (!citizenContact) {
    showToast('Contact details are required.', 'error');
    return;
  }

  const submitButton = $('#submitReportButton');
  submitButton.disabled = true;
  submitButton.textContent = 'Submitting...';

  try {
    // Step 1: Get a signed upload session and stream the file to Supabase
    const uploadResult = await uploadVideo(selectedVideo);

    // Step 2: Build the report payload
    const payload = {
      submittedAt: new Date().toISOString(),
      location: {
        latitude: Number($('#latitude').value),
        longitude: Number($('#longitude').value),
        address: $('#address').value.trim()
      },
      videoUrl: uploadResult.videoUrl,
      storagePath: uploadResult.storagePath,
      vehicleType: $('#vehicleType').value,
      violationType: $('#violationType').value,
      zoneType: $('#zoneType').value,
      noiseLevel: Number($('#noiseLevel').value),
      description: $('#description').value.trim(),
      citizenContact: $('#citizenContact').value.trim()
    };

    // Step 3: Submit to backend
    const report = await request('/api/reports', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    // Step 4: Show success message
    $('#successBox').textContent = `${t('success')} ${report.referenceId}`;
    $('#successBox').classList.remove('hidden');
    showToast(`Tracking number: ${report.referenceId}`);
    resetReportForm();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    $('#uploadProgressWrap').classList.add('hidden');
    $('#uploadProgressBar').style.width = '0%';
    $('#uploadProgressText').textContent = '0%';
    submitButton.disabled = false;
    submitButton.textContent = t('submit');
  }
}

/**
 * Clear all form fields and reset the map marker
 * back to the default Mumbai location.
 */
function resetReportForm() {
  selectedVideo = null;
  $('#reportForm').reset();
  $('#noiseLevel').value = 75;
  $('#noiseLevelText').textContent = '75';
  $('#browseVideo').classList.remove('hidden');
  $('#selectedVideo').classList.add('hidden');
  $('#uploadProgressWrap').classList.add('hidden');
  $('#uploadProgressBar').style.width = '0%';
  setReportLocation(19.076, 72.8777, 'Mumbai, Maharashtra');
}

/* ── Event Binding ── */

/**
 * Attach all event listeners for the Submit Report page.
 * Called once from main.js during app initialisation.
 */
export function bindReportEvents() {
  // Browse button opens file picker
  $('#browseVideo').addEventListener('click', () => $('#videoInput').click());

  // Handle file selection via picker
  $('#videoInput').addEventListener('change', (event) => setSelectedVideo(event.target.files[0]));

  // Remove selected video
  $('#removeVideo').addEventListener('click', () => {
    selectedVideo = null;
    $('#videoInput').value = '';
    $('#selectedVideo').classList.add('hidden');
    $('#browseVideo').classList.remove('hidden');
  });

  // Drag-and-drop zone
  const dropZone = $('#dropZone');
  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('dragging');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragging');
    setSelectedVideo(event.dataTransfer.files[0]);
  });

  // Noise level slider — show current dB value
  $('#noiseLevel').addEventListener('input', (event) => {
    $('#noiseLevelText').textContent = event.target.value;
  });

  // GPS button — get browser geolocation
  $('#useGps').addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by this browser.', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setReportLocation(position.coords.latitude, position.coords.longitude, '');
        showToast('Current location captured.');
      },
      () => showToast('Unable to access current location. Please select on the map.', 'error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  // Manually entering lat/lng updates the marker
  $('#latitude').addEventListener('change', () =>
    setReportLocation(Number($('#latitude').value), Number($('#longitude').value), $('#address').value)
  );
  $('#longitude').addEventListener('change', () =>
    setReportLocation(Number($('#latitude').value), Number($('#longitude').value), $('#address').value)
  );

  // Form submit
  $('#reportForm').addEventListener('submit', submitReport);
}
