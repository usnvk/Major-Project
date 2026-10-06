import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, X, FileText, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Binary, User } from 'lucide-react';

export default function UploadDropzone({
  onFileSelected,
  selectedFile,
  onClearFile,
  onAnalyze,
  isLoading,
  patientId,
  setPatientId,
  patientName,
  setPatientName,
  currentUser,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.dcm', '.dicom'];
  const MAX_FILE_SIZE_MB = 25;

  const validateAndSetFile = (file) => {
    setError(null);
    if (!file) return;

    const fileNameLower = file.name.toLowerCase();
    const isAllowedExt = ALLOWED_EXTENSIONS.some((ext) => fileNameLower.endsWith(ext));
    const isDicomMime = file.type === 'application/dicom' || file.type === '' || file.type === 'application/octet-stream';
    const isImageMime = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type);

    if (!isAllowedExt && !isImageMime && !isDicomMime) {
      setError('Invalid format. Please upload a Chest radiograph in DICOM (.dcm), PNG, or JPEG format.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      return;
    }

    onFileSelected(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const isDicom = selectedFile?.name?.toLowerCase().endsWith('.dcm') || selectedFile?.name?.toLowerCase().endsWith('.dicom');
  const previewUrl = selectedFile && !isDicom ? URL.createObjectURL(selectedFile) : null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      
      {/* Header instructions */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-3">
            <UploadCloud className="w-7 h-7 text-sky-600" />
            <span>Upload Chest Radiograph (CXR)</span>
          </h1>
          <p className="text-slate-600 mt-2 text-sm leading-relaxed max-w-2xl">
            Accepts clinical DICOM (.dcm) or standard radiographs (PNG, JPEG). 
            Images pass through Stage 1 HIPAA PHI anonymization, Stage 2 OOD Gatekeeper validation, and Stage 4 ResNet-18 diagnosis.
          </p>
        </div>

        {/* HIPAA Security Badge */}
        <div className="inline-flex items-center space-x-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-semibold shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>HIPAA Safe Harbor Filter Active</span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-start space-x-3 text-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Upload Error:</span> {error}
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Patient Identification Card */}
      {currentUser?.role === 'patient' ? (
        <div className="bg-[#F0FDFA] p-4 rounded-2xl border border-[#CCFBF1] flex items-center justify-between text-xs text-[#0F766E]">
          <div className="flex items-center space-x-2.5">
            <User className="w-4 h-4 text-[#0D9488]" />
            <div>
              <span className="font-bold text-[#0F172A]">{currentUser.name || 'Patient'}</span>
              <span className="text-[#64748B] ml-2">({currentUser.email})</span>
            </div>
          </div>
          <span className="font-mono text-[11px] bg-white px-2.5 py-1 rounded-lg border border-[#CCFBF1] text-[#0D9488] font-semibold">
            ID: {currentUser.patient_hash || currentUser.email}
          </span>
        </div>
      ) : (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-xs space-y-3">
          <div className="font-semibold text-slate-800 flex items-center gap-2">
            <User className="w-4 h-4 text-sky-600" />
            <span>Patient Identification & Linkage (Optional)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-600 block text-[11px] font-medium mb-1">
                Patient Full Name
              </label>
              <input
                type="text"
                value={patientName || ''}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. John Doe (Leave blank for anonymous)"
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
              />
            </div>
            <div>
              <label className="text-slate-600 block text-[11px] font-medium mb-1">
                Hospital MRN / Patient ID
              </label>
              <input
                type="text"
                value={patientId || ''}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="e.g. PT-2026-081 (Auto-generated if empty)"
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono transition"
              />
            </div>
          </div>
        </div>
      )}

      {/* Dropzone container */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
        
        {!selectedFile ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${
              isDragOver
                ? 'border-sky-500 bg-sky-50/80 scale-[1.01]'
                : 'border-slate-300 hover:border-sky-400 hover:bg-slate-50/80'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".jpg,.jpeg,.png,.dcm,.dicom"
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-4 shadow-inner border border-sky-100">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-semibold text-slate-800">
              Drag & Drop DICOM or Standard Radiograph Here
            </h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              or click to browse from PACS workstation or device
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="inline-flex items-center space-x-1.5 bg-sky-50 text-sky-700 px-3 py-1.5 rounded-lg text-xs font-medium border border-sky-200">
                <Binary className="w-3.5 h-3.5" />
                <span>DICOM (.dcm) Ingestion</span>
              </div>
              <div className="inline-flex items-center space-x-1.5 bg-slate-100 px-3 py-1.5 rounded-lg text-xs text-slate-600 font-medium border border-slate-200">
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>JPEG, PNG, WebP</span>
              </div>
              <div className="text-xs text-slate-400 font-mono">Max 25MB</div>
            </div>
          </div>
        ) : (
          /* Preview state */
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center space-x-2 text-emerald-700 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>{isDicom ? 'DICOM Medical Record Staged' : 'X-Ray Image Selected'}</span>
              </div>

              <button
                onClick={onClearFile}
                disabled={isLoading}
                className="flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-800 font-medium px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                <span>Remove File</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              
              {/* Image preview frame */}
              <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800 aspect-square max-h-[360px] flex items-center justify-center group shadow-md">
                {isDicom ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-sky-900/60 text-sky-400 flex items-center justify-center border border-sky-700/60 shadow-lg">
                      <Binary className="w-8 h-8" />
                    </div>
                    <span className="text-sm font-semibold text-white">DICOM Binary Stream Staged</span>
                    <span className="text-xs text-slate-400 font-mono">Automatic VOI LUT Windowing & PHI Anonymization on Submit</span>
                  </div>
                ) : (
                  <img
                    src={previewUrl}
                    alt="Chest X-Ray Preview"
                    className="max-h-full max-w-full object-contain"
                  />
                )}
                <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded text-[11px] text-slate-300 font-mono border border-slate-700">
                  {isDicom ? 'DICOM CR/DX' : 'RGB Matrix'}
                </div>
              </div>

              {/* File details & Action trigger */}
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">File Name:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[200px]">{selectedFile.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">File Size:</span>
                    <span className="font-mono text-slate-800">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500">Target Modality:</span>
                    <span className="font-semibold text-slate-800">Chest Radiograph (PA/AP)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Privacy Action:</span>
                    <span className="font-semibold text-emerald-600 flex items-center">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Strips PHI & Hashes ID
                    </span>
                  </div>
                </div>

                <button
                  onClick={onAnalyze}
                  disabled={isLoading}
                  className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-[#2563EB] hover:bg-[#1E40AF] disabled:bg-slate-300 shadow-xs flex items-center justify-center space-x-2 transition text-sm"
                >
                  {isLoading ? (
                    <span>Executing Pipeline Stages...</span>
                  ) : (
                    <>
                      <span>Submit for AI-Assisted TB Screening</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>

    </div>
  );
}
