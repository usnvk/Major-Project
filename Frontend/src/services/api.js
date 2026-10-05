import axios from 'axios';
import { getStageInformation } from '../utils/stageData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const ENABLE_MOCK_FALLBACK = import.meta.env.VITE_ENABLE_MOCK_FALLBACK === 'true';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
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
      <!-- Background thorax frame -->
      <rect width="500" height="500" fill="#0f172a" />
      
      <!-- Ribcage & Lung fields mock simulation -->
      <path d="M 250 80 L 250 420 M 170 120 C 120 180 110 320 190 380 M 330 120 C 380 180 390 320 310 380" stroke="#334155" stroke-width="8" fill="none"/>
      
      <!-- Left & Right Lung Field Translucency -->
      <ellipse cx="180" cy="240" rx="65" ry="110" fill="#1e293b" stroke="#475569" stroke-width="2"/>
      <ellipse cx="320" cy="240" rx="65" ry="110" fill="#1e293b" stroke="#475569" stroke-width="2"/>
      
      <!-- Rib Structures -->
      <path d="M 250 150 Q 180 160 140 180 M 250 150 Q 320 160 360 180" stroke="#475569" stroke-width="4" fill="none" opacity="0.6"/>
      <path d="M 250 200 Q 170 215 130 240 M 250 200 Q 330 215 370 240" stroke="#475569" stroke-width="4" fill="none" opacity="0.6"/>
      <path d="M 250 250 Q 165 270 135 300 M 250 250 Q 335 270 365 300" stroke="#475569" stroke-width="4" fill="none" opacity="0.6"/>
      
      <!-- Heart Shadow -->
      <ellipse cx="220" cy="280" rx="45" ry="55" fill="#0f172a" opacity="0.8" stroke="#334155" stroke-width="2"/>
      
      <!-- Clavicles & Spine -->
      <path d="M 120 110 L 250 130 L 380 110" stroke="#64748b" stroke-width="6" fill="none"/>
      
      <!-- Grad-CAM Highlight Layer -->
      ${highlightCircle}
      
      <text x="20" y="470" fill="#94a3b8" font-family="sans-serif" font-size="14" font-weight="600">GRAD-CAM AI HEATMAP ANALYSIS</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
};

/**
 * Send X-Ray Image for AI Prediction
 * POST /predict
 */
export const predictXray = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

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
        // Only provide Grad-CAM heatmap if the result is TB Positive
        heatmap_url: isPositiveResult ? (data.heatmap_base64 || data.heatmap_url || null) : null,
      },
    };
  } catch (error) {
    console.warn('Backend API connection failed or unreachable. Checking fallback mode.', error?.message);

    if (ENABLE_MOCK_FALLBACK) {
      // Simulate realistic AI network latency (1.5 seconds)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Deterministic simulation based on file name/size or pseudo-random
      const isPositive = file ? file.name.toLowerCase().includes('pos') || Math.random() > 0.35 : true;
      const confidence = isPositive ? Number((92 + Math.random() * 7.5).toFixed(1)) : Number((90 + Math.random() * 8).toFixed(1));
      const stage = isPositive ? Math.floor(Math.random() * 3) + 1 : null;
      const predictionId = `pred_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      return {
        success: true,
        isMock: true,
        data: {
          prediction_id: predictionId,
          prediction: isPositive ? 'TB Positive' : 'TB Negative',
          confidence: confidence,
          stage: stage,
          // If TB Negative, no heatmap is generated
          heatmap_url: isPositive ? generateHeatmapSvgDataUrl(true) : null,
          stage_info: stage ? getStageInformation(stage) : null,
          created_at: new Date().toISOString()
        }
      };
    }

    return {
      success: false,
      error:
        error.response?.data?.detail?.message ||
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Unable to connect to AI prediction service. Please verify backend connection.',
    };
  }
};

/**
 * Submit Doctor Confirmation / Correction Feedback
 * POST /feedback
 */
export const submitFeedback = async (predictionId, trueLabel, confirmedStage) => {
  try {
    const payload = {
      prediction_id: predictionId,
      true_label: trueLabel,
    };
    if (trueLabel === 'TB Positive') {
      payload.confirmed_stage = confirmedStage;
    }
    const response = await apiClient.post('/feedback', {
      ...payload,
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.warn('Feedback API call failed. Checking fallback mode.', error?.message);

    if (ENABLE_MOCK_FALLBACK) {
      await new Promise((resolve) => setTimeout(resolve, 800));

      return {
        success: true,
        isMock: true,
        data: {
          status: 'success',
          message: 'Doctor confirmation successfully recorded in medical audit log.',
          prediction_id: predictionId,
          true_label: trueLabel,
          confirmed_at: new Date().toISOString()
        }
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
    console.warn('FL Metrics API fetch failed; client will use benchmark data.', error?.message);
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
    console.warn('Retrain status check failed.', error?.message);
    return {
      success: false,
      error: error?.message,
    };
  }
};

/**
 * Triggers a federated retraining session across the 3 hospital nodes.
 */
export const triggerRetraining = async (force = false, rounds = 1, dp = true) => {
  try {
    const response = await apiClient.post(`/retrain?force=${force}&rounds=${rounds}&dp=${dp}`);
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


