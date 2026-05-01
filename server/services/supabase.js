import { createClient } from '@supabase/supabase-js';

let supabase = null;

export function initSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return supabase;
}

export function getSupabase() {
  return supabase;
}

export function getReportsTable() {
  return process.env.SUPABASE_REPORTS_TABLE || 'reports';
}

export function getVideosBucket() {
  return process.env.SUPABASE_VIDEOS_BUCKET || 'noise-report-videos';
}
