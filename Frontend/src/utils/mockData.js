// Default mock initial patient scan history
export const INITIAL_PATIENT_HISTORY = [
  {
    id: "1001",
    predictionId: "12345",
    patientId: "PT-1001",
    patientName: "Robert Chen",
    scanDate: "2026-08-20",
    result: "TB Positive",
    confidence: 96.4,
    stage: 2,
    doctorConfirmed: true,
    doctorLabel: "TB Positive",
    notes: "Infiltrates present in right upper lobe. Verified by Dr. Jenkins.",
    heatmapUrl: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "1002",
    predictionId: "12346",
    patientId: "PT-1002",
    patientName: "Elena Rostova",
    scanDate: "2026-08-18",
    result: "TB Negative",
    confidence: 91.2,
    stage: null,
    doctorConfirmed: true,
    doctorLabel: "TB Negative",
    notes: "Clear lung fields, normal vascular mark. Confirmed negative.",
    heatmapUrl: null
  },
  {
    id: "1003",
    predictionId: "12347",
    patientId: "PT-1003",
    patientName: "Marcus Vance",
    scanDate: "2026-08-15",
    result: "TB Positive",
    confidence: 88.7,
    stage: 1,
    doctorConfirmed: true,
    doctorLabel: "TB Positive",
    notes: "Early stage lesion in apical segment.",
    heatmapUrl: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: "1004",
    predictionId: "12348",
    patientId: "PT-1004",
    patientName: "Sarah Miller",
    scanDate: "2026-08-12",
    result: "TB Negative",
    confidence: 97.8,
    stage: null,
    doctorConfirmed: true,
    doctorLabel: "TB Negative",
    notes: "Routine pre-employment screening clean.",
    heatmapUrl: null
  },
  {
    id: "1005",
    predictionId: "12349",
    patientId: "PT-1005",
    patientName: "David Okafor",
    scanDate: "2026-08-10",
    result: "TB Positive",
    confidence: 94.1,
    stage: 3,
    doctorConfirmed: false,
    doctorLabel: null,
    notes: "Extensive involvement. Pending second opinion.",
    heatmapUrl: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=600&q=80"
  }
];

export const INITIAL_STATS = {
  totalScans: 120,
  positiveCases: 32,
  negativeCases: 88,
  recentScans: 10
};

export const RECENT_ACTIVITIES = [
  {
    id: 1,
    patientId: "PT-1001",
    action: "Analyzed",
    result: "TB Positive – Stage 2",
    time: "2 hours ago",
    status: "positive"
  },
  {
    id: 2,
    patientId: "PT-1002",
    action: "Analyzed",
    result: "TB Negative",
    time: "5 hours ago",
    status: "negative"
  },
  {
    id: 3,
    patientId: "PT-1003",
    action: "Diagnosis Confirmed",
    result: "Confirmed TB Positive",
    time: "1 day ago",
    status: "confirmed"
  },
  {
    id: 4,
    patientId: "PT-1004",
    action: "Report Exported",
    result: "TB Negative Clean Report",
    time: "2 days ago",
    status: "neutral"
  }
];
