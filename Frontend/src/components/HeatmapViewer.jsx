import React, { useState } from 'react';
import { Eye, Sliders, Info, Maximize2, Layers, Cpu, Compass } from 'lucide-react';

export default function HeatmapViewer({ originalImage, heatmapUrl }) {
  const [opacity, setOpacity] = useState(70);
  const [viewTab, setViewTab] = useState('overlay'); // 'original' | 'heatmap' | 'overlay'

  const fallbackOriginal = originalImage || 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=600&q=80';

  // If no heatmap is provided (Normal / TB Negative finding)
  if (!heatmapUrl) {
    return (
      <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E2E8F0] gap-2">
          <div>
            <h3 className="text-base font-bold text-[#0F172A] flex items-center space-x-2">
              <Eye className="w-4 h-4 text-[#16A34A]" />
              <span>Original Chest Radiograph</span>
            </h3>
            <p className="text-xs text-[#64748B]">Normal screening: No suspicious pathological lesion regions localized.</p>
          </div>
          <span className="text-xs font-semibold bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7] px-2.5 py-0.5 rounded-full">
            Clear Baseline
          </span>
        </div>

        <div className="max-w-md mx-auto space-y-2">
          <div className="relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden aspect-square flex items-center justify-center shadow-xs">
            <img src={fallbackOriginal} alt="Normal Chest X-Ray" className="max-h-full max-w-full object-contain" />
          </div>
          <p className="text-[11px] text-[#64748B] text-center italic">
            AI attention visualization. Not a definitive indication of pathology.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
      
      {/* Title & Tab Controls (Section 18) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-[#0F172A]">AI Explainability</h3>
            <span className="text-xs font-mono font-medium text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#DBEAFE]">
              Grad-CAM
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Spatial attention feature localization evaluated by neural layer embeddings.
          </p>
        </div>

        {/* View Mode Tabs: [ Original ] [ Heatmap ] [ Overlay ] (Section 18) */}
        <div className="flex items-center space-x-1 p-1 bg-slate-100 rounded-xl border border-[#E2E8F0] text-xs font-medium self-start sm:self-auto">
          <button
            onClick={() => setViewTab('original')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              viewTab === 'original'
                ? 'bg-white text-[#2563EB] font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Original
          </button>
          <button
            onClick={() => setViewTab('heatmap')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              viewTab === 'heatmap'
                ? 'bg-white text-[#2563EB] font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Heatmap
          </button>
          <button
            onClick={() => setViewTab('overlay')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              viewTab === 'overlay'
                ? 'bg-white text-[#2563EB] font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Overlay
          </button>
        </div>
      </div>

      {/* Opacity slider for Overlay mode */}
      {viewTab === 'overlay' && (
        <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] flex items-center space-x-3 text-xs">
          <Sliders className="w-3.5 h-3.5 text-[#64748B]" />
          <span className="font-medium text-[#0F172A] w-32">Overlay Opacity: {opacity}%</span>
          <input
            type="range"
            min="10"
            max="100"
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
          />
        </div>
      )}

      {/* Main Radiograph Display Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Left: Radiograph Workspace */}
        <div className="md:col-span-2 space-y-2">
          <div className="relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden aspect-4/3 flex items-center justify-center shadow-xs">
            {/* Base Image */}
            <img
              src={fallbackOriginal}
              alt="Original Radiograph"
              className={`max-h-full max-w-full object-contain ${viewTab === 'heatmap' ? 'hidden' : 'block'}`}
            />

            {/* Heatmap Layer */}
            {viewTab === 'heatmap' && (
              <img
                src={heatmapUrl}
                alt="Grad-CAM Activation"
                className="max-h-full max-w-full object-contain"
              />
            )}

            {/* Overlay Layer */}
            {viewTab === 'overlay' && (
              <img
                src={heatmapUrl}
                alt="Grad-CAM Overlay"
                style={{ opacity: opacity / 100 }}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-screen"
              />
            )}
          </div>

          {/* Clinical Disclaimer (Section 18) */}
          <div className="text-[11px] text-[#64748B] bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0] flex items-center space-x-2">
            <Info className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
            <span>AI attention visualization. Not a definitive indication of pathology.</span>
          </div>
        </div>

        {/* Right: Grad-CAM Metadata Details (Section 18) */}
        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] space-y-3 text-xs">
          <span className="text-[10px] uppercase font-bold text-[#64748B] block">Activation Metadata</span>

          <div className="space-y-2.5">
            <div>
              <span className="text-[#64748B] text-[11px] block">Highlighted Region</span>
              <span className="font-semibold text-[#0F172A] flex items-center gap-1 mt-0.5">
                <Compass className="w-3.5 h-3.5 text-[#2563EB]" /> Upper Lung Field (Apical Zone)
              </span>
            </div>

            <div>
              <span className="text-[#64748B] text-[11px] block">Model Architecture</span>
              <span className="font-mono font-semibold text-[#0F172A] mt-0.5 block">ResNet-18 v2.1</span>
            </div>

            <div>
              <span className="text-[#64748B] text-[11px] block">Spatial Activation Scale</span>
              <div className="mt-1 flex items-center space-x-1.5">
                <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-blue-500 via-amber-400 to-red-500" />
                <span className="text-[10px] font-mono text-[#64748B]">0.94 max</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E2E8F0] text-[11px] text-[#64748B] leading-relaxed">
              Warm zones identify pixel clusters where convolutional feature maps produced maximum activation for TB positive classification.
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
