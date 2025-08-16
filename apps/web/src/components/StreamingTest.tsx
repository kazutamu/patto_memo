import React, { useState, useCallback } from 'react';
import { useStreamingAnalysis } from '../hooks/useStreamingAnalysis';

export function StreamingTest() {
  const [testImage, setTestImage] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('Describe what you see in this image in detail.');
  
  const {
    analyzeStream,
    isAnalyzing,
    currentText,
    lastProcessingTime,
    error,
    reset
  } = useStreamingAnalysis({
    onChunk: (text) => console.log('New chunk:', text),
    onComplete: (fullText, processingTime) => 
      console.log('Analysis complete:', { fullText, processingTime }),
    onError: (error) => console.error('Stream error:', error),
  });

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        setTestImage(base64);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleAnalyze = useCallback(() => {
    if (testImage) {
      analyzeStream(testImage, prompt, 'default');
    }
  }, [testImage, prompt, analyzeStream]);

  const handleReset = useCallback(() => {
    reset();
    setTestImage('');
    setPrompt('Describe what you see in this image in detail.');
  }, [reset]);

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '800px', 
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h2>Ollama Streaming Test</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="image-upload" style={{ display: 'block', marginBottom: '10px' }}>
          Select an image:
        </label>
        <input
          id="image-upload"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ marginBottom: '10px' }}
        />
        
        {testImage && (
          <div style={{ marginTop: '10px' }}>
            <img 
              src={`data:image/jpeg;base64,${testImage}`} 
              alt="Test" 
              style={{ maxWidth: '300px', maxHeight: '200px', objectFit: 'contain' }}
            />
          </div>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="prompt" style={{ display: 'block', marginBottom: '10px' }}>
          Prompt:
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          style={{ 
            width: '100%', 
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={handleAnalyze}
          disabled={!testImage || isAnalyzing}
          style={{
            padding: '10px 20px',
            backgroundColor: isAnalyzing ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isAnalyzing ? 'not-allowed' : 'pointer',
            marginRight: '10px'
          }}
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze with Streaming'}
        </button>
        
        <button
          onClick={handleReset}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reset
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          Error: {error}
        </div>
      )}

      {isAnalyzing && (
        <div style={{
          padding: '10px',
          backgroundColor: '#d1ecf1',
          color: '#0c5460',
          border: '1px solid #bee5eb',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          Analyzing image... Stream will appear below.
        </div>
      )}

      {currentText && (
        <div style={{
          padding: '15px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <h4>Streaming Analysis:</h4>
          <p style={{ 
            whiteSpace: 'pre-wrap',
            margin: 0,
            lineHeight: '1.5'
          }}>
            {currentText}
            {isAnalyzing && <span style={{ animation: 'blink 1s infinite' }}>|</span>}
          </p>
          
          {lastProcessingTime && (
            <small style={{ color: '#6c757d', marginTop: '10px', display: 'block' }}>
              Processing time: {lastProcessingTime.toFixed(2)}s
            </small>
          )}
        </div>
      )}

      <style>
        {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        `}
      </style>
    </div>
  );
}