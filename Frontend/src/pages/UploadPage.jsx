import React, { useState } from 'react';
import UploadDropzone from '../components/UploadDropzone';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { predictXray } from '../services/api';

export default function UploadPage({ onPredictionSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await predictXray(selectedFile);

      if (response.success && response.data) {
        // Pass original file reference + prediction payload to parent state
        onPredictionSuccess({
          file: selectedFile,
          originalImage: URL.createObjectURL(selectedFile),
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
          title="Analyzing Chest X-Ray..."
          subtitle="Running ResNet-50 Convolutional Neural Network pipeline for Tuberculosis pulmonary infiltrate classification and Grad-CAM spatial heatmap rendering."
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
          />
        </>
      )}
    </div>
  );
}
