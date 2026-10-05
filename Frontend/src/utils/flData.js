/**
 * flData.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Simulated Federated Learning metrics for the FL Monitor page.
 * These values mimic what Opacus + Flower would log during a real
 * multi-round federated training session with 3 hospital clients and
 * Differential Privacy enabled (noise_multiplier=1.0, max_grad_norm=1.0).
 *
 * In production: replace these with a GET /fl-metrics backend endpoint
 * that reads the logs written by Model/src/federated/client.py and server.py.
 */

/** Per-round global model metrics (FedAvg aggregation result) */
export const FL_ROUND_METRICS = [
  { round: 1,  accuracy: 61.2, loss: 0.721, epsilon: 0.42, delta: 1e-5, clients: 3, duration_s: 42 },
  { round: 2,  accuracy: 67.4, loss: 0.634, epsilon: 0.71, delta: 1e-5, clients: 3, duration_s: 39 },
  { round: 3,  accuracy: 72.1, loss: 0.578, epsilon: 0.98, delta: 1e-5, clients: 3, duration_s: 41 },
  { round: 4,  accuracy: 75.8, loss: 0.521, epsilon: 1.24, delta: 1e-5, clients: 2, duration_s: 44 },
  { round: 5,  accuracy: 78.3, loss: 0.481, epsilon: 1.48, delta: 1e-5, clients: 3, duration_s: 40 },
  { round: 6,  accuracy: 80.9, loss: 0.443, epsilon: 1.71, delta: 1e-5, clients: 3, duration_s: 38 },
  { round: 7,  accuracy: 82.5, loss: 0.412, epsilon: 1.93, delta: 1e-5, clients: 3, duration_s: 43 },
  { round: 8,  accuracy: 84.1, loss: 0.385, epsilon: 2.14, delta: 1e-5, clients: 3, duration_s: 37 },
  { round: 9,  accuracy: 85.6, loss: 0.361, epsilon: 2.34, delta: 1e-5, clients: 2, duration_s: 46 },
  { round: 10, accuracy: 86.8, loss: 0.342, epsilon: 2.53, delta: 1e-5, clients: 3, duration_s: 39 },
];

/** Per-client accuracy for the latest round */
export const CLIENT_STATS = [
  {
    id: 'client-1',
    label: 'Hospital A – SIT Tumakuru',
    samples: 420,
    accuracy: 87.2,
    loss: 0.338,
    status: 'completed',
    lastRound: 10,
    color: '#0ea5e9',
  },
  {
    id: 'client-2',
    label: 'Hospital B – Bengaluru Hosp.',
    samples: 310,
    accuracy: 85.9,
    loss: 0.351,
    status: 'completed',
    lastRound: 10,
    color: '#8b5cf6',
  },
  {
    id: 'client-3',
    label: 'Hospital C – Mysuru PHC',
    samples: 280,
    accuracy: 86.1,
    loss: 0.344,
    status: 'completed',
    lastRound: 10,
    color: '#10b981',
  },
];

/** Centralized baseline for comparison */
export const CENTRALIZED_BASELINE = {
  accuracy: 88.4,
  loss: 0.312,
  note: 'Centralized ResNet-18 (all data pooled, no privacy)',
};

/** DP configuration used in Step 1 */
export const DP_CONFIG = {
  mechanism: 'Gaussian',
  noise_multiplier: 1.0,
  max_grad_norm: 1.0,
  delta: 1e-5,
  epsilon_target: 3.0,
};

/** Aggregation configuration */
export const FL_CONFIG = {
  strategy: 'FedAvg',
  total_rounds: 10,
  clients_per_round: 3,
  local_epochs: 2,
  batch_size: 32,
  optimizer: 'Adam',
  framework: 'Flower (flwr)',
  privacy: 'Opacus DP-SGD',
};
