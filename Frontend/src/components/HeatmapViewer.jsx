import React, { useState } from 'react';
import { Eye, Sliders, Info, Maximize2, RefreshCw } from 'lucide-react';

export default function HeatmapViewer({ originalImage, heatmapUrl }) {
  const [opacity, setOpacity] = useState(75);
  const [viewMode, setViewMode] = useState('side-by-side'); // 'side-by-side' | 'overlay'
  const [isZoomed, setIsZoomed] = useState(false);

  const fallbackOriginal = originalImage || "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=600&q=80";

  // If no heatmap is provided (TB Negative / Normal scan)
  if (!heatmapUrl) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <Eye className="w-5 h-5 text-emerald-600" />
              <span>Original Chest Radiograph</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Normal scan: No pathological TB lesions detected.
            </p>
          </div>
          <span className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full self-start sm:self-auto">
            <span>TB Negative — Heatmap Omitted</span>
          </span>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-emerald-900">
          <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Clinical Protocol:</strong> AI Grad-CAM heatmaps are intentionally generated only for positive findings to localize suspicious lesion regions. Because this scan is <strong>TB Negative</strong>, the radiograph is clear of abnormal lesion activations.
          </p>
        </div>

        <div className="max-w-lg mx-auto space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Chest Radiograph</span>
            <span className="text-slate-400 font-mono text-[11px]">Normal Baseline</span>
          </div>
          <div className="relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden aspect-square flex items-center justify-center shadow-md">
            <img
              src={fallbackOriginal}
              alt="Normal Chest X-Ray"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      
      {/* Title & View controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Eye className="w-5 h-5 text-sky-600" />
            <span>Grad-CAM Explainable AI Heatmap</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Visual explanation of high-activation spatial features evaluated by the neural network.
          </p>
        </div>

        {/* Mode controls */}
        <div className="flex items-center space-x-3">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1 border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode('side-by-side')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === 'side-by-side'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setViewMode('overlay')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === 'overlay'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overlay View
            </button>
          </div>
        </div>
      </div>

      {/* Explanation Banner */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-sky-900">
        <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Clinical Note:</strong> The Grad-CAM heatmap highlights regions of the X-ray that contributed most to the AI model's prediction. Red/Warm zones represent highest feature importance for lesion detection.
        </p>
      </div>

      {/* Opacity slider for Overlay mode */}
      {viewMode === 'overlay' && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center space-x-4">
          <Sliders className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-700 w-32">
            Heatmap Opacity: {opacity}%
          </span>
          <input
            type="range"
            min="10"
            max="100"
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
          />
        </div>
      )}

      {/* Image Display Container */}
      <div className="space-y-4">
        {viewMode === 'side-by-side' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Original X-Ray */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Original Chest X-Ray</span>
                <span className="text-slate-400 font-mono text-[11px]">AP/PA Radiograph</span>
              </div>
              <div className="relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden aspect-square flex items-center justify-center shadow-md">
                <img
                  src={fallbackOriginal}
                  alt="Original X-Ray"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>

            {/* Grad-CAM Heatmap */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>AI Grad-CAM Heatmap</span>
                <span className="text-rose-600 font-semibold text-[11px]">Feature Activation Map</span>
              </div>
              <div className="relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden aspect-square flex items-center justify-center shadow-md">
                <img
                  src={heatmapUrl || fallbackOriginal}
                  alt="AI Grad-CAM Heatmap"
                  className="max-h-full max-w-full object-contain"
                />
                <div className="absolute top-2 right-2 bg-rose-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                  GRAD-CAM OVERLAY
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* Overlay View Mode */
          <div className="space-y-2 max-w-2xl mx-auto">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Interactive Overlay View</span>
              <span className="text-sky-600 text-[11px]">Adjust slider to blend heatmap</span>
            </div>
            
            <div className="relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden aspect-square flex items-center justify-center shadow-md">
              {/* Base image */}
              <img
                src={fallbackOriginal}
                alt="Base Chest X-Ray"
                className="absolute inset-0 w-full h-full object-contain"
              />
              {/* Heatmap overlay with opacity */}
              <img
                src={heatmapUrl || fallbackOriginal}
                alt="Heatmap Layer"
                style={{ opacity: opacity / 100 }}
                className="absolute inset-0 w-full h-full object-contain transition-opacity duration-150 pointer-events-none mix-blend-screen"
              />
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
