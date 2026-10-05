import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, X, FileText, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function UploadDropzone({ onFileSelected, selectedFile, onClearFile, onAnalyze, isLoading }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
  const MAX_FILE_SIZE_MB = 15;

  const validateAndSetFile = (file) => {
    setError(null);
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Invalid file format. Please upload a valid JPG, JPEG, or PNG Chest X-ray image.');
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

  const previewUrl = selectedFile ? URL.createObjectURL(selectedFile) : null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      
      {/* Header instructions */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-3">
          <UploadCloud className="w-7 h-7 text-sky-600" />
          <span>Upload Chest X-Ray</span>
        </h1>
        <p className="text-slate-600 mt-2 leading-relaxed">
          Upload a patient's DICOM or standard chest radiograph image (AP/PA view). 
          The deep learning model will evaluate pulmonary infiltrates, calculate prediction confidence, detect disease stage, and render Grad-CAM heatmaps.
        </p>
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
              accept=".jpg,.jpeg,.png"
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-4 shadow-inner border border-sky-100">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-semibold text-slate-800">
              Drag & Drop Chest X-Ray Image Here
            </h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              or click to browse from your device
            </p>

            <div className="inline-flex items-center space-x-2 bg-slate-100 px-4 py-2 rounded-lg text-xs text-slate-600 font-medium border border-slate-200">
              <ImageIcon className="w-4 h-4 text-slate-500" />
              <span>Supported formats: JPG, JPEG, PNG (Max 15MB)</span>
            </div>
          </div>
        ) : (
          /* Preview state */
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center space-x-2 text-emerald-700 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>X-Ray Image Selected Successfully</span>
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
                <img
                  src={previewUrl}
                  alt="Chest X-Ray Preview"
                  className="max-h-full max-w-full object-contain"
                />
                <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded text-[11px] text-slate-300 font-mono border border-slate-700">
                  DICOM Preview Mode
                </div>
              </div>

              {/* File details card */}
              <div className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                  Image Metadata
                </h4>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-slate-200">
                    <span className="text-slate-500">File Name:</span>
                    <span className="font-mono text-slate-800 truncate max-w-[180px]" title={selectedFile.name}>
                      {selectedFile.name}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-200">
                    <span className="text-slate-500">File Size:</span>
                    <span className="font-mono text-slate-800">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-slate-200">
                    <span className="text-slate-500">MIME Type:</span>
                    <span className="font-mono text-slate-800">{selectedFile.type || 'image/jpeg'}</span>
                  </div>

                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Pre-processing Status:</span>
                    <span className="text-emerald-600 font-medium">Ready for Inference</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="w-full text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 font-medium py-2 px-3 rounded-lg transition-colors"
                  >
                    Replace Image
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".jpg,.jpeg,.png"
                    className="hidden"
                  />
                </div>
              </div>

            </div>

            {/* Action button */}
            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={onAnalyze}
                disabled={isLoading}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold px-8 py-3.5 rounded-xl shadow-lg shadow-sky-600/25 hover:shadow-sky-600/40 transition-all disabled:opacity-50"
              >
                <span>{isLoading ? 'Processing AI Pipeline...' : 'Analyze X-Ray Image'}</span>
                {!isLoading && <ArrowRight className="w-5 h-5" />}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
