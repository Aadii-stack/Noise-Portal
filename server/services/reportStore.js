import { nanoid } from 'nanoid';
import { getDatabase } from './database.js';
import { getReportsTable, getSupabase } from './supabase.js';

const memoryReports = new Map();

function createReferenceId() {
  const date = new Date();
  const ymd = date.toISOString().slice(0, 10).replaceAll('-', '');
  return `NPR-${ymd}-${nanoid(6).toUpperCase()}`;
}

export async function createReport(report) {
  const database = getDatabase();
  const supabase = getSupabase();
  const referenceId = createReferenceId();
  const data = { ...report, referenceId, status: 'Pending' };

  if (database) {
    const result = await database.query(
      `
        insert into reports (
          reference_id,
          submitted_at,
          location,
          video_url,
          storage_path,
          vehicle_type,
          violation_type,
          zone_type,
          noise_level,
          description,
          status,
          assigned_officer,
          notes,
          citizen_contact
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        returning *
      `,
      [
        data.referenceId,
        data.submittedAt,
        data.location,
        data.videoUrl,
        data.storagePath,
        data.vehicleType,
        data.violationType,
        data.zoneType,
        data.noiseLevel,
        data.description,
        data.status,
        data.assignedOfficer,
        data.notes,
        data.citizenContact
      ]
    );
    return fromSupabaseReport(result.rows[0]);
  }

  if (supabase) {
    const { data: inserted, error } = await supabase.from(getReportsTable()).insert(toSupabaseReport(data)).select().single();
    if (error) throw error;
    return fromSupabaseReport(inserted);
  }

  const id = nanoid();
  memoryReports.set(id, { id, ...data });
  return memoryReports.get(id);
}

export async function listReports(filters = {}) {
  const database = getDatabase();
  const supabase = getSupabase();
  let reports = [];

  if (database) {
    const clauses = [];
    const values = [];
    addFilter(clauses, values, 'status', filters.status);
    addFilter(clauses, values, 'violation_type', filters.violationType);
    addFilter(clauses, values, 'zone_type', filters.zoneType);
    if (filters.from) {
      values.push(filters.from);
      clauses.push(`submitted_at >= $${values.length}`);
    }
    if (filters.to) {
      values.push(`${filters.to}T23:59:59`);
      clauses.push(`submitted_at <= $${values.length}`);
    }

    const where = clauses.length ? `where ${clauses.join(' and ')}` : '';
    const result = await database.query(`select * from reports ${where} order by submitted_at desc`, values);
    reports = result.rows.map(fromSupabaseReport);
  } else if (supabase) {
    let query = supabase.from(getReportsTable()).select('*').order('submitted_at', { ascending: false });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.violationType) query = query.eq('violation_type', filters.violationType);
    if (filters.zoneType) query = query.eq('zone_type', filters.zoneType);
    if (filters.from) query = query.gte('submitted_at', filters.from);
    if (filters.to) query = query.lte('submitted_at', `${filters.to}T23:59:59`);

    const { data, error } = await query;
    if (error) throw error;
    reports = data.map(fromSupabaseReport);
  } else {
    reports = Array.from(memoryReports.values()).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }

  return reports.filter((report) => {
    const date = new Date(report.submittedAt);
    return (
      (!filters.status || report.status === filters.status) &&
      (!filters.violationType || report.violationType === filters.violationType) &&
      (!filters.zoneType || report.zoneType === filters.zoneType) &&
      (!filters.from || date >= new Date(filters.from)) &&
      (!filters.to || date <= new Date(`${filters.to}T23:59:59`))
    );
  });
}

export async function getReport(id) {
  const database = getDatabase();
  const supabase = getSupabase();
  if (database) {
    const result = await database.query('select * from reports where id = $1 limit 1', [id]);
    return result.rows[0] ? fromSupabaseReport(result.rows[0]) : null;
  }

  if (supabase) {
    const { data, error } = await supabase.from(getReportsTable()).select('*').eq('id', id).single();
    if (error?.code === 'PGRST116') return null;
    if (error) throw error;
    return fromSupabaseReport(data);
  }
  return memoryReports.get(id) || null;
}

export async function getPublicStats() {
  const reports = await listReports();
  const byViolationType = {
    'Excessive honking': 0,
    'Loud music': 0,
    'Construction noise': 0,
    'Vehicle revving': 0
  };
  const byStatus = {
    Pending: 0,
    'Under Review': 0,
    'Action Taken': 0,
    Rejected: 0
  };

  let totalNoise = 0;
  let reportsWithNoise = 0;
  let highestNoiseLevel = 0;

  reports.forEach((report) => {
    if (report.violationType in byViolationType) {
      byViolationType[report.violationType] += 1;
    }
    if (report.status in byStatus) {
      byStatus[report.status] += 1;
    }
    if (Number.isFinite(Number(report.noiseLevel))) {
      const level = Number(report.noiseLevel);
      totalNoise += level;
      reportsWithNoise += 1;
      highestNoiseLevel = Math.max(highestNoiseLevel, level);
    }
  });

  return {
    totalReports: reports.length,
    byViolationType,
    byStatus,
    averageNoiseLevel: reportsWithNoise ? Math.round(totalNoise / reportsWithNoise) : 0,
    highestNoiseLevel
  };
}

export async function updateReport(id, updates) {
  const database = getDatabase();
  const supabase = getSupabase();
  if (database) {
    const mapped = toSupabaseReport(updates);
    const entries = Object.entries(mapped);
    if (!entries.length) return getReport(id);

    const assignments = entries.map(([key], index) => `${key} = $${index + 2}`);
    const result = await database.query(
      `update reports set ${assignments.join(', ')} where id = $1 returning *`,
      [id, ...entries.map(([, value]) => value)]
    );
    return result.rows[0] ? fromSupabaseReport(result.rows[0]) : null;
  }

  if (supabase) {
    const { data, error } = await supabase
      .from(getReportsTable())
      .update(toSupabaseReport(updates))
      .eq('id', id)
      .select()
      .single();
    if (error?.code === 'PGRST116') return null;
    if (error) throw error;
    return fromSupabaseReport(data);
  }

  const existing = memoryReports.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  memoryReports.set(id, updated);
  return updated;
}

function addFilter(clauses, values, column, value) {
  if (!value) return;
  values.push(value);
  clauses.push(`${column} = $${values.length}`);
}

function toSupabaseReport(report) {
  const mapped = {};
  if ('referenceId' in report) mapped.reference_id = report.referenceId;
  if ('submittedAt' in report) mapped.submitted_at = report.submittedAt;
  if ('location' in report) mapped.location = report.location;
  if ('videoUrl' in report) mapped.video_url = report.videoUrl;
  if ('storagePath' in report) mapped.storage_path = report.storagePath;
  if ('vehicleType' in report) mapped.vehicle_type = report.vehicleType;
  if ('violationType' in report) mapped.violation_type = report.violationType;
  if ('zoneType' in report) mapped.zone_type = report.zoneType;
  if ('noiseLevel' in report) mapped.noise_level = report.noiseLevel;
  if ('description' in report) mapped.description = report.description;
  if ('status' in report) mapped.status = report.status;
  if ('assignedOfficer' in report) mapped.assigned_officer = report.assignedOfficer;
  if ('notes' in report) mapped.notes = report.notes;
  if ('citizenContact' in report) mapped.citizen_contact = report.citizenContact;
  return mapped;
}

function fromSupabaseReport(row) {
  return {
    id: row.id,
    referenceId: row.reference_id,
    submittedAt: row.submitted_at,
    location: row.location,
    videoUrl: row.video_url,
    storagePath: row.storage_path || '',
    vehicleType: row.vehicle_type,
    violationType: row.violation_type,
    zoneType: row.zone_type,
    noiseLevel: row.noise_level,
    description: row.description || '',
    status: row.status || 'Pending',
    assignedOfficer: row.assigned_officer || '',
    notes: row.notes || '',
    citizenContact: row.citizen_contact || ''
  };
}
