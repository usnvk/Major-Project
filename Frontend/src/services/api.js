import axios from 'axios';
import { getStageInformation } from '../utils/stageData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location?.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `http://${window.location.hostname}:8000`
    : 'http://127.0.0.1:8000');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Automatically inject JWT / Session Bearer token if stored in localStorage
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('tb_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


/**
 * Resolves a relative /edge-storage/... path to an absolute backend URL for use in <img> tags.
 * Normalizes Windows backslashes, absolute filesystem paths, and direct filenames.
 */
export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  
  let clean = path.replace(/\\/g, '/');
  
  // Extract path from edge-storage or edge_storage
  const match = clean.match(/(?:edge[-_]storage\/.*)/i);
  if (match) {
    clean = match[0].replace(/^edge_storage/i, 'edge-storage');
  } else if (!clean.startsWith('/')) {
    clean = `edge-storage/inferences/${clean}`;
  }
  
  const finalPath = clean.startsWith('/') ? clean : `/${clean}`;
  return `${API_BASE_URL}${finalPath}`;
};

/**
 * Generates an SVG Data URL representing a high-contrast clinical chest X-ray
 * with anatomical rib cage, lung fields, cardiac silhouette, and Grad-CAM++ lesion overlay.
 */
export const generateClinicalCxrSvgDataUrl = ({ isPositive = true, isHeatmap = false, title = 'CHEST RADIOGRAPH (PA)' } = {}) => {
  const heatmapLayer = isHeatmap
    ? isPositive
      ? `<defs>
          <radialGradient id="heatPrimary" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ef4444" stop-opacity="0.95"/>
            <stop offset="35%" stop-color="#f97316" stop-opacity="0.80"/>
            <stop offset="70%" stop-color="#eab308" stop-opacity="0.55"/>
            <stop offset="100%" stop-color="#0284c7" stop-opacity="0.0"/>
          </radialGradient>
          <radialGradient id="heatSecondary" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#f97316" stop-opacity="0.85"/>
            <stop offset="50%" stop-color="#eab308" stop-opacity="0.50"/>
            <stop offset="100%" stop-color="#0284c7" stop-opacity="0.0"/>
          </radialGradient>
        </defs>
        <circle cx="165" cy="180" r="55" fill="url(#heatPrimary)" filter="blur(6px)"/>
        <circle cx="165" cy="180" r="28" fill="#ef4444" opacity="0.85" filter="blur(2px)"/>
        <circle cx="195" cy="230" r="38" fill="url(#heatSecondary)" filter="blur(4px)"/>
        <rect x="110" y="130" width="115" height="130" fill="none" stroke="#ef4444" stroke-width="2" stroke-dasharray="4,3" rx="6"/>
        <text x="112" y="125" fill="#f87171" font-family="monospace" font-size="11" font-weight="700">FOCI: CAVITARY INFILTRATE</text>`
      : `<circle cx="250" cy="230" r="40" fill="#22c55e" opacity="0.30" filter="blur(8px)"/>
        <text x="170" y="235" fill="#4ade80" font-family="monospace" font-size="12" font-weight="700">CLEAR LUNG FIELDS</text>`
    : '';

  const tagColor = isPositive ? '#ef4444' : '#22c55e';
  const tagText = isPositive ? 'TB POSITIVE' : 'NORMAL / CURED';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
    <rect width="500" height="500" fill="#090D16"/>
    <path d="M 250 50 L 250 450" stroke="#1E293B" stroke-width="12" opacity="0.6"/>
    <path d="M 120 110 Q 250 135 380 110" stroke="#475569" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M 240 140 Q 110 180 140 250 Q 110 320 240 380" stroke="#334155" stroke-width="4" fill="none" opacity="0.65"/>
    <path d="M 240 170 Q 130 205 155 270 Q 130 335 240 370" stroke="#334155" stroke-width="4" fill="none" opacity="0.65"/>
    <path d="M 240 200 Q 150 230 170 290 Q 150 350 240 380" stroke="#334155" stroke-width="4" fill="none" opacity="0.65"/>
    <path d="M 260 140 Q 390 180 360 250 Q 390 320 260 380" stroke="#334155" stroke-width="4" fill="none" opacity="0.65"/>
    <path d="M 260 170 Q 370 205 345 270 Q 370 335 260 370" stroke="#334155" stroke-width="4" fill="none" opacity="0.65"/>
    <path d="M 260 200 Q 350 230 330 290 Q 350 350 260 380" stroke="#334155" stroke-width="4" fill="none" opacity="0.65"/>
    <ellipse cx="175" cy="260" rx="70" ry="115" fill="#131B2E" stroke="#334155" stroke-width="2"/>
    <ellipse cx="170" cy="275" rx="55" ry="90" fill="#0E1626" opacity="0.8"/>
    <ellipse cx="325" cy="260" rx="70" ry="115" fill="#131B2E" stroke="#334155" stroke-width="2"/>
    <ellipse cx="330" cy="275" rx="55" ry="90" fill="#0E1626" opacity="0.8"/>
    <path d="M 235 230 Q 210 290 270 340 Q 285 345 295 320 Q 275 250 245 230" fill="#1E293B" opacity="0.85"/>
    <path d="M 90 385 Q 175 350 250 385" stroke="#475569" stroke-width="5" fill="none"/>
    <path d="M 250 385 Q 325 350 410 385" stroke="#475569" stroke-width="5" fill="none"/>
    ${heatmapLayer}
    <rect x="15" y="15" width="220" height="32" rx="6" fill="#000000" opacity="0.75"/>
    <text x="25" y="35" fill="#94A3B8" font-family="monospace" font-size="11" font-weight="600">${title}</text>
    <rect x="345" y="15" width="140" height="32" rx="6" fill="#000000" opacity="0.75"/>
    <text x="355" y="35" fill="${tagColor}" font-family="monospace" font-size="11" font-weight="700">${tagText}</text>
    <text x="25" y="480" fill="#64748B" font-family="monospace" font-size="10">DICOM VOI LUT 16-BIT &middot; GRAD-CAM++ LESION MAP</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/**
 * Returns a guaranteed valid image URL, falling back to a clinical CXR SVG if missing.
 */
export const resolveCxrImage = (path, isPositive = true, isHeatmap = false, title = 'CHEST RADIOGRAPH') => {
  const url = getImageUrl(path);
  if (url) return url;
  return generateClinicalCxrSvgDataUrl({ isPositive, isHeatmap, title });
};

/**
 * Generates an SVG Data URL representing a high-contrast clinical chest X-ray mock with heatmap overlay
 */
export const generateHeatmapSvgDataUrl = (isPositive = true) => {
  const highlightCircle = isPositive
    ? `<circle cx="270" cy="180" r="45" fill="url(#heatGradient)" opacity="0.85" />
       <circle cx="260" cy="190" r="25" fill="#ef4444" opacity="0.9" />`
    : `<circle cx="250" cy="200" r="15" fill="#22c55e" opacity="0.4" />`;

  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
      <defs>
        <radialGradient id="heatGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ef4444" stop-opacity="0.9"/>
          <stop offset="40%" stop-color="#f97316" stop-opacity="0.7"/>
          <stop offset="70%" stop-color="#eab308" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="500" height="500" fill="#0f172a" />
      <path d="M 250 80 L 250 420 M 170 120 C 120 180 110 320 190 380 M 330 120 C 380 180 390 320 310 380" stroke="#334155" stroke-width="8" fill="none"/>
      <ellipse cx="180" cy="240" rx="65" ry="110" fill="#1e293b" stroke="#475569" stroke-width="2"/>
      <ellipse cx="320" cy="240" rx="65" ry="110" fill="#1e293b" stroke="#475569" stroke-width="2"/>
      <ellipse cx="220" cy="280" rx="45" ry="55" fill="#0f172a" opacity="0.8" stroke="#334155" stroke-width="2"/>
      <path d="M 120 110 L 250 130 L 380 110" stroke="#64748b" stroke-width="6" fill="none"/>
      ${highlightCircle}
      <text x="20" y="470" fill="#94a3b8" font-family="sans-serif" font-size="14" font-weight="600">GRAD-CAM++ LESION LOCALIZATION</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
};

/**
 * Send X-Ray Image or DICOM for AI Prediction
 * POST /predict
 */
export const predictXray = async (file, patientId = null, patientName = null, uploadedBy = null) => {
  const formData = new FormData();
  formData.append('file', file);
  if (patientId) formData.append('patient_id', patientId);
  if (patientName) formData.append('patient_name', patientName);
  if (uploadedBy) formData.append('uploaded_by', uploadedBy);

  try {
    const response = await apiClient.post('/predict', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const data = response.data;
    const isPositiveResult = data.result === 'TB Positive';
    return {
      success: true,
      data: {
        ...data,
        prediction: data.result,
        confidence: Number((Number(data.confidence || 0) * 100).toFixed(2)),
        patient_hash: data.patient_hash || null,
        is_dicom: Boolean(data.is_dicom),
        dicom_metadata: data.dicom_metadata || null,
        bounding_boxes: data.bounding_boxes || [],
        heatmap_url: isPositiveResult
          ? (data.heatmap_base64 || (data.heatmap_url ? getImageUrl(data.heatmap_url) : null))
          : null,
        image_url: data.image_url ? getImageUrl(data.image_url) : null,
      },
    };
  } catch (error) {
    console.warn('Backend API connection failed.', error?.message);

    const errorMessage =
      error.response?.data?.detail?.message ||
      error.response?.data?.detail ||
      error.response?.data?.message ||
      'Unable to connect to AI prediction service. Please verify backend is running.';

    return {
      success: false,
      error: typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage),
    };
  }
};

/**
 * Submit Doctor Confirmation / Correction Feedback to Active Learning Queue
 * POST /feedback
 */
export const submitFeedback = async (
  predictionId,
  trueLabel,
  confirmedStage,
  doctorNotes = '',
  doctorEmail = null,
  doctorName = null
) => {
  try {
    const payload = {
      prediction_id: predictionId,
      true_label: trueLabel,
      doctor_notes: doctorNotes,
      doctor_email: doctorEmail,
      doctor_name: doctorName,
    };
    if (trueLabel === 'TB Positive') {
      payload.confirmed_stage = confirmedStage;
    }
    const response = await apiClient.post('/feedback', payload);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.warn('Feedback API call failed.', error?.message);

    return {
      success: false,
      error:
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to submit doctor diagnosis feedback.',
    };
  }
};

/**
 * Fetches real-time / benchmark federated learning and privacy metrics from the backend.
 */
export const fetchFLMetrics = async () => {
  try {
    const response = await apiClient.get('/fl-metrics');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message,
    };
  }
};

/**
 * Checks feedback count and retraining eligibility/status.
 */
export const fetchRetrainStatus = async () => {
  try {
    const response = await apiClient.get('/retrain-status');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message,
    };
  }
};

/**
 * Inspects Active Learning Queue (Pending vs Trained Edge Cases)
 */
export const fetchActiveLearningQueue = async () => {
  try {
    const response = await apiClient.get('/active-learning/queue');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message,
    };
  }
};

/**
 * Triggers a federated retraining session across the 3 hospital nodes.
 */
export const triggerRetraining = async (force = false, rounds = 1, dp = true, mu = 0.01) => {
  try {
    const response = await apiClient.post(`/retrain?force=${force}&rounds=${rounds}&dp=${dp}&mu=${mu}`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to trigger federated retraining session.',
    };
  }
};

/**
 * ---------------------------------------------------------------------------
 * Real-World Auth & Dynamic SQLite Database Endpoints
 * ---------------------------------------------------------------------------
 */

export const loginUser = async (email, password) => {
  try {
    const response = await apiClient.post('/auth/login', { email, password });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || 'Invalid login credentials.',
    };
  }
};

export const registerUser = async (userData) => {
  try {
    const response = await apiClient.post('/auth/register', userData);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || 'Registration failed.',
    };
  }
};

export const logoutUser = async (email, role) => {
  try {
    const response = await apiClient.post('/auth/logout', { email, role });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: true }; // Client-side clear regardless
  }
};

export const fetchCurrentUser = async (email) => {
  try {
    const response = await apiClient.get(`/auth/me?email=${encodeURIComponent(email)}`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.detail || 'User not found' };
  }
};

export const fetchAdminInfo = async () => {
  try {
    const response = await apiClient.get('/auth/admin-info');
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: true,
      data: {
        admin_email: 'admin@pulmoscan.org',
        description: 'Primary System Administrator account.',
      },
    };
  }
};

export const fetchClinicalStats = async () => {
  try {
    const response = await apiClient.get('/analytics/clinical-stats');
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error?.message,
    };
  }
};

export const fetchScans = async (role = 'doctor', patientHash = null) => {
  try {
    let url = `/scans?role=${role}`;
    if (patientHash) {
      url += `&patient_hash=${encodeURIComponent(patientHash)}`;
    }
    const response = await apiClient.get(url);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error?.message,
    };
  }
};

export const fetchHospitals = async (role = 'admin') => {
  try {
    const response = await apiClient.get(`/hospitals?role=${encodeURIComponent(role)}`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.detail || error.message };
  }
};

export const createHospital = async (payload, role = 'admin') => {
  try {
    const response = await apiClient.post(`/hospitals?role=${encodeURIComponent(role)}`, payload);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.detail || error.message };
  }
};

export const fetchFollowUps = async (patientHash = null, role = 'doctor') => {
  try {
    let url = `/follow-ups?role=${encodeURIComponent(role)}`;
    if (patientHash) url += `&patient_hash=${encodeURIComponent(patientHash)}`;
    const response = await apiClient.get(url);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.detail || error.message };
  }
};

export const createFollowUp = async (payload, role = 'doctor') => {
  try {
    const response = await apiClient.post(`/follow-ups?role=${encodeURIComponent(role)}`, payload);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.detail || error.message };
  }
};

export const fetchUsers = async (role = 'admin') => {
  try {
    const response = await apiClient.get(`/users?role=${encodeURIComponent(role)}`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.detail || error.message };
  }
};

export const fetchNotifications = async (role = 'doctor') => {
  try {
    const response = await apiClient.get(`/notifications?role=${encodeURIComponent(role)}`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.detail || error.message };
  }
};

export const fetchReportAnalytics = async () => {
  try {
    const response = await apiClient.get('/reports/analytics');
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.detail || error.message };
  }
};

export const fetchLiveLogs = async () => {
  try {
    const response = await apiClient.get('/logs/live');
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.detail || error.message };
  }
};

export const fetchPatientVisits = async (patientHash, role = 'doctor', viewerPatientHash = null) => {
  try {
    let url = `/patient-visits/${encodeURIComponent(patientHash)}?role=${encodeURIComponent(role)}`;
    if (viewerPatientHash) {
      url += `&viewer_patient_hash=${encodeURIComponent(viewerPatientHash)}`;
    }
    const response = await apiClient.get(url);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
};

export const createPatientVisit = async (payload, role = 'doctor') => {
  try {
    const response = await apiClient.post(
      `/patient-visits?role=${encodeURIComponent(role)}`,
      payload,
    );
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
};

export const reviewPatientVisit = async (payload, role = 'doctor') => {
  try {
    const response = await apiClient.post(
      `/patient-visits/review?role=${encodeURIComponent(role)}`,
      payload,
    );
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
};

export const fetchRecentAuditLogs = async (limit = 25) => {
  try {
    const response = await apiClient.get(`/audit/recent?limit=${limit}`);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error?.message,
    };
  }
};

export const fetchAdminSystemStats = async () => {
  try {
    const response = await apiClient.get('/admin/system-stats');
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error?.message,
    };
  }
};

/**
 * ---------------------------------------------------------------------------
 * Section 39: 3-Laptop Real-Time Federated Learning Operations API
 * ---------------------------------------------------------------------------
 */

export const startFLRound = async ({ aggregation = 'FedAvg', demo = true, dp = true, simulate = false, rounds = 1 }) => {
  try {
    const response = await apiClient.post('/api/fl/round/start', {
      aggregation,
      demo,
      dp,
      simulate,
      rounds,
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message || 'Failed to start FL round',
    };
  }
};

export const fetchFLClusterInfo = async () => {
  try {
    const response = await apiClient.get('/api/fl/cluster/info');
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.detail || error.message };
  }
};

export const cancelFLRound = async () => {
  try {
    const response = await apiClient.post('/api/fl/round/cancel');
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message || 'Failed to cancel FL round',
    };
  }
};

export const fetchFLLiveStatus = async () => {
  try {
    const response = await apiClient.get('/api/fl/live-status');
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
};

export const fetchFLNodes = async () => {
  try {
    const response = await apiClient.get('/api/fl/nodes');
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
};

export const fetchFLCurrentModel = async () => {
  try {
    const response = await apiClient.get('/api/fl/model/current');
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
};

export const fetchFLModels = async () => {
  try {
    const response = await apiClient.get('/api/fl/models');
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
};

export const fetchFLRounds = async () => {
  try {
    const response = await apiClient.get('/api/fl/rounds');
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
};

export const fetchFLEvents = async () => {
  try {
    const response = await apiClient.get('/api/fl/events');
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PATIENT TREATMENT & RECOVERY MONITORING API
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const fetchPatients = async (params = {}) => {
  try {
    const response = await apiClient.get('/patients', { params });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
};

export const fetchPatientDetails = async (patientHash) => {
  try {
    const response = await apiClient.get(`/patients/${encodeURIComponent(patientHash)}`);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
};

export const registerPatient = async (payload) => {
  try {
    const response = await apiClient.post('/patients/register', payload);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
};

export const updatePatientTreatment = async (patientHash, payload) => {
  try {
    const response = await apiClient.put(`/patients/${encodeURIComponent(patientHash)}/treatment`, payload);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
};

export const recordFollowUpVisit = async (patientHash, formData) => {
  try {
    const response = await apiClient.post(
      `/patients/${encodeURIComponent(patientHash)}/followup-visit`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
};

export const fetchPatientProgressReport = async (patientHash) => {
  try {
    const response = await apiClient.get(`/patients/${encodeURIComponent(patientHash)}/progress-report`);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
};

export const fetchDoctorRecoveryOverview = async (doctorEmail = null) => {
  try {
    const params = doctorEmail ? { doctor_email: doctorEmail } : {};
    const response = await apiClient.get('/analytics/doctor-overview', { params });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
};


