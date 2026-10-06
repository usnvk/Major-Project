import React, { useState } from 'react';
import UploadDropzone from '../components/UploadDropzone';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { predictXray } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function UploadPage({ onPredictionSuccess }) {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [patientId, setPatientId] = useState(user?.role === 'patient' ? (user?.patient_hash || '') : '');
  const [patientName, setPatientName] = useState(user?.role === 'patient' ? (user?.name || '') : '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError(null);

    try {
      const pId = patientId.trim() || (user?.role === 'patient' ? (user?.patient_hash || user?.email) : null);
      const pName = patientName.trim() || (user?.role === 'patient' ? user?.name : null);
      const uEmail = user?.email || null;

      const response = await predictXray(selectedFile, pId, pName, uEmail);

      if (response.success && response.data) {
        onPredictionSuccess({
          file: selectedFile,
          originalImage: URL.createObjectURL(selectedFile),
          patient_id: response.data.patient_hash || pId,
          patient_name: response.data.patient_name || pName,
          ...response.data
        });
      } else {
        setError(response.error || 'Failed to complete AI prediction. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred while communicating with the AI backend service.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {isLoading ? (
        <LoadingSpinner
          title="Analyzing Chest Radiograph..."
          subtitle="Running ResNet-18 Convolutional Neural Network pipeline for Tuberculosis pulmonary feature classification and Grad-CAM spatial heatmap rendering."
        />
      ) : (
        <>
          {error && (
            <ErrorMessage
              title="Prediction Failed"
              message={error}
              onRetry={handleAnalyze}
            />
          )}

          <UploadDropzone
            selectedFile={selectedFile}
            onFileSelected={setSelectedFile}
            onClearFile={() => {
              setSelectedFile(null);
              setError(null);
            }}
            onAnalyze={handleAnalyze}
            isLoading={isLoading}
            patientId={patientId}
            setPatientId={setPatientId}
            patientName={patientName}
            setPatientName={setPatientName}
            currentUser={user}
          />
        </>
      )}
    </div>
  );
}
