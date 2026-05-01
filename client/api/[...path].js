import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const allowedMimeTypes = new Set(['video/mp4', 'video/quicktime', 'video/x-msvideo']);
const allowedExtensions = new Set(['.mp4', '.mov', '.avi']);
const reportStatuses = ['Pending', 'Under Review', 'Action Taken', 'Rejected'];
const vehicleTypes = ['Car', 'Motorcycle', 'Truck', 'Auto-rickshaw', 'Construction vehicle'];
const violationTypes = ['Excessive honking', 'Loud music', 'Construction noise', 'Vehicle revving'];
const zoneTypes = ['Residential', 'Silent zone - Hospital', 'Silent zone - School', 'Commercial'];

let supabase = null;

function getSupabase() {
	if (supabase) return supabase;

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

function json(res, statusCode, payload) {
	res.statusCode = statusCode;
	res.setHeader('Content-Type', 'application/json');
	res.end(JSON.stringify(payload));
}

function notFound(res) {
	json(res, 404, { message: 'Not found' });
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		req.on('data', (chunk) => chunks.push(chunk));
		req.on('end', () => {
			const raw = Buffer.concat(chunks).toString('utf8');
			if (!raw) {
				resolve({});
				return;
			}

			try {
				resolve(JSON.parse(raw));
			} catch {
				reject(new Error('Invalid JSON body'));
			}
		});
		req.on('error', reject);
	});
}

function stripTags(value = '') {
	return String(value).replace(/<[^>]*>/g, '').trim();
}

function createReferenceId() {
	const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
	const randomPart = randomBytes(3).toString('hex').toUpperCase();
	return `NPR-${datePart}-${randomPart}`;
}

function normalizeReport(data) {
	return {
		referenceId: data.referenceId,
		submittedAt: data.submittedAt ? new Date(data.submittedAt).toISOString() : new Date().toISOString(),
		location: {
			latitude: Number(data.location?.latitude),
			longitude: Number(data.location?.longitude),
			address: data.location?.address || ''
		},
		videoUrl: data.videoUrl,
		storagePath: data.storagePath || '',
		vehicleType: data.vehicleType,
		violationType: data.violationType,
		zoneType: data.zoneType,
		noiseLevel: Number(data.noiseLevel),
		description: data.description || '',
		status: data.status || 'Pending',
		assignedOfficer: data.assignedOfficer || '',
		notes: data.notes || '',
		citizenContact: data.citizenContact || ''
	};
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

function getReportsTable() {
	return process.env.SUPABASE_REPORTS_TABLE || 'reports';
}

function getVideosBucket() {
	return process.env.SUPABASE_VIDEOS_BUCKET || 'noise-report-videos';
}

async function ensurePublicBucket(client, bucketName) {
	const { data, error } = await client.storage.getBucket(bucketName);

	if (error) {
		const message = String(error.message || '').toLowerCase();
		const status = String(error.statusCode || error.status || '');

		if (status === '404' || message.includes('not found')) {
			const { error: createError } = await client.storage.createBucket(bucketName, { public: true });
			if (createError) throw createError;
			return;
		}

		throw error;
	}

	if (!data?.public) {
		const { error: updateError } = await client.storage.updateBucket(bucketName, { public: true });
		if (updateError) throw updateError;
	}
}

function getBearerToken(req) {
	const header = req.headers.authorization || '';
	return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function requireAuth(req, res) {
	const token = getBearerToken(req);
	if (!token) {
		json(res, 401, { message: 'Authentication token required' });
		return null;
	}

	try {
		return jwt.verify(token, process.env.JWT_SECRET || 'local-development-secret');
	} catch {
		json(res, 401, { message: 'Invalid or expired token' });
		return null;
	}
}

async function handleLogin(req, res) {
	const body = await readBody(req);
	const email = String(body.email || '').trim().toLowerCase();
	const password = String(body.password || '');
	const officerEmail = String(process.env.OFFICER_EMAIL || '').trim().toLowerCase();
	const officerPassword = String(process.env.OFFICER_PASSWORD || '');

	if (!email || !password) {
		json(res, 400, { message: 'Invalid login input' });
		return;
	}

	if (email !== officerEmail || password !== officerPassword) {
		json(res, 401, { message: 'Invalid officer credentials' });
		return;
	}

	const token = jwt.sign(
		{ sub: 'officer-1', email: officerEmail, role: 'officer' },
		process.env.JWT_SECRET || 'local-development-secret',
		{ expiresIn: '8h' }
	);

	json(res, 200, { token, user: { email: officerEmail, role: 'officer' } });
}

async function handleUploadSession(req, res) {
	const body = await readBody(req);
	const fileName = String(body.fileName || '').trim();
	const mimeType = String(body.mimeType || '').trim();
	const size = Number(body.size);

	if (!fileName || !mimeType) {
		json(res, 400, { message: 'Video file metadata is required.' });
		return;
	}

	if (!allowedMimeTypes.has(mimeType)) {
		json(res, 400, { message: 'Only MP4, MOV, and AVI videos are allowed.' });
		return;
	}

	if (Number.isFinite(size) && size > 100 * 1024 * 1024) {
		json(res, 400, { message: 'Video must be 100MB or smaller.' });
		return;
	}

	const client = getSupabase();
	if (!client) {
		json(res, 503, { message: 'Supabase storage must be configured for video uploads.' });
		return;
	}

	await ensurePublicBucket(client, getVideosBucket());

	const extension = (() => {
		const existing = fileName.includes('.') ? `.${fileName.split('.').pop().toLowerCase()}` : '';
		if (allowedExtensions.has(existing)) return existing;
		if (mimeType === 'video/quicktime') return '.mov';
		if (mimeType === 'video/x-msvideo') return '.avi';
		return '.mp4';
	})();

	const storagePath = `noise-reports/${Date.now()}-${randomBytes(4).toString('hex')}${extension}`;
	const { data, error } = await client.storage.from(getVideosBucket()).createSignedUploadUrl(storagePath);
	if (error) {
		json(res, 500, { message: error.message || 'Could not create upload session' });
		return;
	}

	json(res, 201, {
		videoUrl: client.storage.from(getVideosBucket()).getPublicUrl(storagePath).data.publicUrl,
		storagePath,
		signedUrl: data.signedUrl,
		token: data.token,
		cacheControl: '3600',
		upsert: false
	});
}

function buildStats(reports) {
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

	for (const report of reports) {
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
	}

	return {
		totalReports: reports.length,
		byViolationType,
		byStatus,
		averageNoiseLevel: reportsWithNoise ? Math.round(totalNoise / reportsWithNoise) : 0,
		highestNoiseLevel
	};
}

async function listReports(client, filters = {}) {
	let query = client.from(getReportsTable()).select('*').order('submitted_at', { ascending: false });
	if (filters.status) query = query.eq('status', filters.status);
	if (filters.violationType) query = query.eq('violation_type', filters.violationType);
	if (filters.zoneType) query = query.eq('zone_type', filters.zoneType);
	if (filters.from) query = query.gte('submitted_at', filters.from);
	if (filters.to) query = query.lte('submitted_at', `${filters.to}T23:59:59`);

	const { data, error } = await query;
	if (error) throw error;
	return (data || []).map(fromSupabaseReport);
}

async function handleReportsGet(req, res, path, url) {
	const user = requireAuth(req, res);
	if (!user) return;

	const client = getSupabase();
	if (!client) {
		json(res, 503, { message: 'Supabase is not configured.' });
		return;
	}

	const segments = path.split('/').filter(Boolean);
	if (segments.length === 1) {
		const filters = {
			status: url.searchParams.get('status') || '',
			violationType: url.searchParams.get('violationType') || '',
			zoneType: url.searchParams.get('zoneType') || '',
			from: url.searchParams.get('from') || '',
			to: url.searchParams.get('to') || ''
		};
		const reports = await listReports(client, filters);
		json(res, 200, { reports });
		return;
	}

	if (segments.length === 2) {
		const id = segments[1];
		const { data, error } = await client.from(getReportsTable()).select('*').eq('id', id).single();
		if (error?.code === 'PGRST116') {
			json(res, 404, { message: 'Report not found' });
			return;
		}
		if (error) {
			json(res, 500, { message: error.message || 'Failed to load report' });
			return;
		}
		json(res, 200, { report: fromSupabaseReport(data) });
		return;
	}

	json(res, 404, { message: 'Not found' });
}

async function handleReportsPost(req, res) {
	const body = await readBody(req);
	const required = [body.videoUrl, body.vehicleType, body.violationType, body.zoneType, body.location?.latitude, body.location?.longitude];
	if (required.some((value) => value === undefined || value === null || value === '')) {
		json(res, 400, { message: 'Report validation failed' });
		return;
	}

	if (!/^https?:\/\//i.test(String(body.videoUrl))) {
		json(res, 400, { message: 'Report validation failed' });
		return;
	}

	if (!vehicleTypes.includes(String(body.vehicleType))) {
		json(res, 400, { message: 'Report validation failed' });
		return;
	}

	if (!violationTypes.includes(String(body.violationType))) {
		json(res, 400, { message: 'Report validation failed' });
		return;
	}

	if (!zoneTypes.includes(String(body.zoneType))) {
		json(res, 400, { message: 'Report validation failed' });
		return;
	}

	const client = getSupabase();
	if (!client) {
		json(res, 503, { message: 'Supabase is not configured.' });
		return;
	}

	const report = normalizeReport({
		...body,
		referenceId: createReferenceId(),
		submittedAt: body.submittedAt || new Date().toISOString(),
		description: stripTags(body.description),
		citizenContact: stripTags(body.citizenContact),
		location: {
			...body.location,
			address: stripTags(body.location?.address)
		}
	});

	const payload = toSupabaseReport({
		...report,
		status: 'Pending'
	});

	const { data, error } = await client.from(getReportsTable()).insert(payload).select().single();
	if (error) {
		json(res, 500, { message: error.message || 'Failed to create report' });
		return;
	}

	json(res, 201, fromSupabaseReport(data));
}

async function handleReportsPatch(req, res, path) {
	const user = requireAuth(req, res);
	if (!user) return;

	const body = await readBody(req);
	const id = path.split('/').filter(Boolean)[1];
	if (!id) {
		json(res, 400, { message: 'Report id is required' });
		return;
	}

	const updates = {};
	if (body.status && reportStatuses.includes(body.status)) updates.status = body.status;
	if (typeof body.assignedOfficer === 'string') updates.assigned_officer = stripTags(body.assignedOfficer);
	if (typeof body.notes === 'string') updates.notes = stripTags(body.notes);

	const client = getSupabase();
	if (!client) {
		json(res, 503, { message: 'Supabase is not configured.' });
		return;
	}

	const { data, error } = await client.from(getReportsTable()).update(updates).eq('id', id).select().single();
	if (error?.code === 'PGRST116') {
		json(res, 404, { message: 'Report not found' });
		return;
	}
	if (error) {
		json(res, 500, { message: error.message || 'Failed to update report' });
		return;
	}

	json(res, 200, { report: fromSupabaseReport(data) });
}

async function handleReportsPublicStats(req, res) {
	if (req.method !== 'GET') {
		notFound(res);
		return;
	}

	const client = getSupabase();
	if (!client) {
		json(res, 503, { message: 'Supabase is not configured.' });
		return;
	}

	const reports = await listReports(client, {});
	json(res, 200, { stats: buildStats(reports) });
}

export default async function handler(req, res) {
	try {
		const url = new URL(req.url, 'http://localhost');
		const path = url.pathname.replace(/^\/api/, '') || '/';

		if (req.method === 'GET' && (path === '/health' || path === '/api/health')) {
			json(res, 200, { ok: true, service: 'noise-portal-api' });
			return;
		}

		if (path === '/auth/login' && req.method === 'POST') {
			await handleLogin(req, res);
			return;
		}

		if (path === '/upload/video' && req.method === 'POST') {
			await handleUploadSession(req, res);
			return;
		}

		if (path === '/reports/stats/public') {
			await handleReportsPublicStats(req, res);
			return;
		}

		if (path === '/reports' && req.method === 'POST') {
			await handleReportsPost(req, res);
			return;
		}

		if (path === '/reports' && req.method === 'GET') {
			await handleReportsGet(req, res, '/reports', url);
			return;
		}

		if (path.startsWith('/reports/') && req.method === 'GET') {
			await handleReportsGet(req, res, path, url);
			return;
		}

		if (path.startsWith('/reports/') && req.method === 'PATCH') {
			await handleReportsPatch(req, res, path);
			return;
		}

		notFound(res);
	} catch (error) {
		json(res, 500, { message: error.message || 'Server error' });
	}
}