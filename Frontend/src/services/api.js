import axios from 'axios';
import { getStageInformation } from '../utils/stageData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const ENABLE_MOCK_FALLBACK = import.meta.env.VITE_ENABLE_MOCK_FALLBACK === 'true';

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
        patient_hash: data.patient_hash || `PT-HASH-${Math.random().toString(16).substring(2, 8).toUpperCase()}`,
        is_dicom: Boolean(data.is_dicom),
        dicom_metadata: data.dicom_metadata || null,
        bounding_boxes: data.bounding_boxes || [],
        heatmap_url: isPositiveResult ? (data.heatmap_base64 || data.heatmap_url || null) : null,
      },
    };
  } catch (error) {
    console.warn('Backend API connection failed. Checking fallback mode.', error?.message);

    if (ENABLE_MOCK_FALLBACK) {
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const isPositive = file ? file.name.toLowerCase().includes('pos') || Math.random() > 0.35 : true;
      const confidence = isPositive ? Number((92 + Math.random() * 7.5).toFixed(1)) : Number((90 + Math.random() * 8).toFixed(1));
      const stage = isPositive ? Math.floor(Math.random() * 3) + 1 : null;
      const predictionId = `pred_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const isDcm = file ? file.name.toLowerCase().endsWith('.dcm') : false;

      return {
        success: true,
        isMock: true,
        data: {
          prediction_id: predictionId,
          patient_hash: `PT-HASH-${Math.random().toString(16).substring(2, 10).toUpperCase()}`,
          is_dicom: isDcm,
          dicom_metadata: isDcm ? { modality: 'DX', body_part_examined: 'CHEST', view_position: 'PA', phi_sanitized: true } : null,
          prediction: isPositive ? 'TB Positive' : 'TB Negative',
          confidence: confidence,
          stage: stage,
          heatmap_url: isPositive ? generateHeatmapSvgDataUrl(true) : null,
          bounding_boxes: isPositive ? [{ x: 120, y: 95, width: 60, height: 75, relative_area: 0.089 }] : [],
          stage_info: stage ? getStageInformation(stage) : null,
          created_at: new Date().toISOString(),
        },
      };
    }

    return {
      success: false,
      error:
        error.response?.data?.detail?.message ||
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Unable to connect to AI prediction service. Please verify backend is running.',
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
    console.warn('Feedback API call failed. Checking fallback mode.', error?.message);

    if (ENABLE_MOCK_FALLBACK) {
      await new Promise((resolve) => setTimeout(resolve, 600));

      return {
        success: true,
        isMock: true,
        data: {
          status: 'success',
          message: 'Doctor override queued for Federated Retraining.',
          prediction_id: predictionId,
          true_label: trueLabel,
          confirmed_at: new Date().toISOString(),
        },
      };
    }

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

export const startFLRound = async ({ aggregation = 'FedAvg', demo = true, dp = true, simulate = false }) => {
  try {
    const response = await apiClient.post('/api/fl/round/start', {
      aggregation,
      demo,
      dp,
      simulate,
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.detail || error.message || 'Failed to start FL round',
    };
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

