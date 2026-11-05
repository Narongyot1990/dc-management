"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Camera, Upload, X, ScanLine, Loader2, Search, AlertCircle, Info } from 'lucide-react';

interface ContainerScannerProps {
  onScan: (containerNumber: string) => void;
  onClose: () => void;
}

export function ContainerScanner({ onScan, onClose }: ContainerScannerProps) {
  const { t } = useLanguage();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugText, setDebugText] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============= OCR LOGIC =============

  // Perform OCR using Gemini 2.5 Flash API
  const performOCR = useCallback(async (canvas: HTMLCanvasElement): Promise<string | null> => {
    try {
      console.log('🔍 Starting Gemini OCR...');
      setOcrProgress(10);

      // Convert canvas to base64
      const base64Image = canvas.toDataURL('image/jpeg', 0.95);
      setOcrProgress(30);

      console.log('📤 Sending image to Gemini API...');

      // Call our API route
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64Image }),
      });

      setOcrProgress(80);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ API error:', errorData);
        setDebugText(`API Error: ${errorData.error}\n${errorData.details || ''}`);
        return null;
      }

      const data = await response.json();
      setOcrProgress(100);

      console.log('📝 Gemini response:', data);

      if (data.containerNumber) {
        console.log('✅ Container number found:', data.containerNumber);
        return data.containerNumber;
      } else {
        console.log('❌ No container number found');
        setDebugText(data.rawResponse || 'No container number detected');
        return null;
      }
    } catch (err) {
      console.error('❌ OCR error:', err);
      setDebugText(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return null;
    } finally {
      setOcrProgress(0);
    }
  }, []);

  // Capture full frame from video
  const captureROI = useCallback((): HTMLCanvasElement | null => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Get video dimensions
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Set canvas to video size (with max resolution)
    const maxWidth = 1280;
    const maxHeight = 720;
    let width = videoWidth;
    let height = videoHeight;

    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = width * ratio;
      height = height * ratio;
    }

    canvas.width = width;
    canvas.height = height;

    // Draw full video frame to canvas
    ctx.drawImage(video, 0, 0, width, height);

    return canvas;
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
    setOcrProgress(0);
  }, []);

  // Scan frame and perform OCR
  const scanFrame = useCallback(async () => {
    const canvas = captureROI();
    if (!canvas) return;

    const containerNo = await performOCR(canvas);

    if (containerNo) {
      console.log('✅ Container found:', containerNo);
      stopCamera();
      onScan(containerNo);
    }
  }, [captureROI, performOCR, onScan, stopCamera]);

  // Start camera
  const startCamera = async () => {
    try {
      setError(null);
      setOcrProgress(0);

      console.log('Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      console.log('Camera access granted! Stream:', stream);
      pendingStreamRef.current = stream;
      setIsScanning(true);
      console.log('isScanning set to TRUE');
    } catch (err) {
      console.error('Camera error:', err);
      setError(t('scanner_error_camera'));
    }
  };

  // Manual capture function
  const handleManualCapture = useCallback(async () => {
    if (isProcessing) return; // Prevent multiple captures

    setIsProcessing(true);
    setError(null);
    await scanFrame();
    setIsProcessing(false);
  }, [isProcessing, scanFrame]);

  // Setup video stream when isScanning becomes true (NO AUTO-SCAN)
  useEffect(() => {
    const setupVideoStream = async (stream: MediaStream) => {
      if (!videoRef.current) {
        console.log('Video ref not ready yet');
        return;
      }

      console.log('Setting up video stream...');
      videoRef.current.srcObject = stream;
      streamRef.current = stream;

      videoRef.current.onloadedmetadata = async () => {
        try {
          if (videoRef.current) {
            await videoRef.current.play();
            console.log('Video playing! Ready for manual capture.');
          }
        } catch (playError) {
          console.error('Video play error:', playError);
        }
      };
    };

    if (isScanning && pendingStreamRef.current && videoRef.current) {
      console.log('Video element is now ready! Setting up stream...');
      setupVideoStream(pendingStreamRef.current);
      pendingStreamRef.current = null;
    }
  }, [isScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Handle image file upload and process directly
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setDebugText('');
    setIsProcessing(true);
    setOcrProgress(0);

    try {
      const reader = new FileReader();

      reader.onload = async (e) => {
        if (e.target?.result && canvasRef.current) {
          // Create image element to load the uploaded file
          const img = new Image();
          img.onload = async () => {
            if (!canvasRef.current) return;

            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Set canvas to image size (with max resolution)
            const maxWidth = 1280;
            const maxHeight = 720;
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = width * ratio;
              height = height * ratio;
            }

            canvas.width = width;
            canvas.height = height;

            // Draw image to canvas
            ctx.drawImage(img, 0, 0, width, height);

            console.log('📤 Processing uploaded image...');

            // Perform OCR on the image
            const containerNo = await performOCR(canvas);

            if (containerNo) {
              console.log('✅ Successfully extracted from uploaded image:', containerNo);
              onScan(containerNo);
            } else {
              setError(t('scanner_error_not_found'));
            }

            setIsProcessing(false);
          };

          img.src = e.target.result as string;
        }
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File upload error:', err);
      setError(t('scanner_error_camera'));
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    // Clear all states when closing
    setError(null);
    setDebugText('');
    setOcrProgress(0);
    setIsProcessing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
              <ScanLine className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {t('scanner_title')}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Camera Preview */}
        {isScanning && (
          <div className="relative bg-black rounded-lg overflow-hidden mb-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-64 object-cover"
              style={{ backgroundColor: '#000' }}
            />

            {/* Hidden canvas for OCR */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Loading Overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                <div className="text-center">
                  {/* Spinner Animation */}
                  <div className="relative w-20 h-20 mx-auto mb-4">
                    <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Search className="w-8 h-8 text-blue-400" />
                    </div>
                  </div>

                  {/* Progress Text */}
                  <div className="text-white">
                    <p className="text-base font-semibold mb-2">{t('scanner_processing')}</p>
                    <div className="w-48 bg-gray-700 rounded-full h-1.5 mx-auto">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-emerald-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${ocrProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-300 mt-2">{ocrProgress}%</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Debug Text Display */}
        {debugText && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg max-h-64 overflow-y-auto">
            <p className="text-xs font-semibold text-amber-800 mb-2">DEBUG - OCR Raw Text:</p>
            <pre className="text-xs text-amber-900 whitespace-pre-wrap font-mono bg-white p-2 rounded border border-amber-200">
              {debugText}
            </pre>
          </div>
        )}

        {/* Instructions */}
        {!isScanning && !error && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
              <Info className="w-4 h-4 text-blue-600" />
              <strong>{t('scanner_instruction_title')}</strong>
            </div>
            {/*<ul className="text-sm text-gray-600 space-y-1 ml-6">
              <li>• {t('scanner_instruction_1')}</li>
              <li>• {t('scanner_instruction_2')}</li>
              <li>• {t('scanner_instruction_3')}</li>
              <li>• {t('scanner_instruction_4')}</li>
            </ul>*/}
          </div>
        )}

        {/* Hidden canvas for OCR (used by both camera and file upload) */}
        {!isScanning && <canvas ref={canvasRef} className="hidden" />}

        {/* OCR Progress (for file upload) */}
        {isProcessing && ocrProgress > 0 && (
          <div className="mb-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between text-blue-800 text-sm mb-2">
                <span>Processing image...</span>
                <span>{ocrProgress}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${ocrProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {!isScanning && !isProcessing ? (
            <>
              <button
                onClick={startCamera}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                {t('scanner_open_camera')}
              </button>

              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  {t('scanner_upload_image')}
                </button>
              </div>

              <button
                onClick={handleClose}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition-colors"
              >
                {t('cancel')}
              </button>
            </>
          ) : isScanning ? (
            <>
              <button
                onClick={handleManualCapture}
                disabled={isProcessing}
                className={`w-full font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  isProcessing
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('scanner_processing')}
                  </>
                ) : (
                  <>
                    <ScanLine className="w-5 h-5" />
                    {t('scanner_capture_scan')}
                  </>
                )}
              </button>
              <button
                onClick={handleClose}
                disabled={isProcessing}
                className={`w-full font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  isProcessing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                <X className="w-5 h-5" />
                {t('scanner_stop')}
              </button>
            </>
          ) : isProcessing ? (
            <button
              disabled
              className="w-full bg-gray-400 text-white font-medium py-2.5 rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('scanner_processing')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
