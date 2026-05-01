/**
 * ──────────────────────────────────────────────
 *  i18n.js — Internationalisation (English / Hindi)
 * ──────────────────────────────────────────────
 *
 *  Stores all UI text in two languages.
 *  applyLanguage() reads data-i18n attributes from the HTML
 *  and replaces each element's text with the active translation.
 *
 *  Usage:
 *    <h1 data-i18n="heroTitle">…</h1>
 *    → JS swaps the text to the current language's "heroTitle" value.
 */

import { $, $$ } from './utils.js';

/* ── Translation strings ── */
const translations = {
  en: {
    appName: 'Noise Pollution Reporting Portal',
    submitReport: 'Submit Report',
    dashboard: 'Authority Dashboard',
    stats: 'Public Statistics',
    heroTitle: 'Report noise violations with verified video and location evidence',
    heroBody: 'Citizens can submit verified reports for excessive honking, loud music, construction noise, and vehicle revving across Mumbai.',
    startReport: 'Start Report',
    currentLocation: 'Use Current Location',
    submit: 'Submit Report',
    success: 'Report submitted. Tracking number:'
  },
  hi: {
    appName: 'ध्वनि प्रदूषण रिपोर्टिंग पोर्टल',
    submitReport: 'रिपोर्ट दर्ज करें',
    dashboard: 'अधिकारी डैशबोर्ड',
    stats: 'सार्वजनिक आंकड़े',
    heroTitle: 'वीडियो और स्थान प्रमाण के साथ ध्वनि उल्लंघन दर्ज करें',
    heroBody: 'नागरिक अत्यधिक हॉर्न, तेज संगीत, निर्माण शोर और वाहन रेविंग की रिपोर्ट जमा कर सकते हैं।',
    startReport: 'रिपोर्ट शुरू करें',
    currentLocation: 'वर्तमान स्थान लें',
    submit: 'रिपोर्ट जमा करें',
    success: 'रिपोर्ट जमा हुई। ट्रैकिंग नंबर:'
  }
};

/* ── Active language (toggles between "en" and "hi") ── */
let currentLanguage = 'en';

/** Get the current language code */
export function getLanguage() {
  return currentLanguage;
}

/** Get translated text for a given key */
export function t(key) {
  return translations[currentLanguage][key] || key;
}

/**
 * Walk through every element with a data-i18n attribute
 * and replace its text with the active language value.
 * Also updates the language toggle button label.
 */
export function applyLanguage() {
  $$('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    element.textContent = translations[currentLanguage][key] || element.textContent;
  });
  $('#languageToggle').textContent = currentLanguage === 'en' ? 'Hindi' : 'English';
}

/**
 * Switch between English and Hindi, then re-apply
 * translations to all data-i18n elements.
 */
export function toggleLanguage() {
  currentLanguage = currentLanguage === 'en' ? 'hi' : 'en';
  applyLanguage();
}
