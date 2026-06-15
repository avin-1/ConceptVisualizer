// AnimationModal — popup with video player, progress, and controls

import { useRef, useEffect } from 'react';
import type { GenerationStatus, VideoResult } from '../types';
import { LoadingAnimation } from './LoadingAnimation';

interface Props {
  isOpen: boolean;
  isGenerating: boolean;
  generationStatus: GenerationStatus | null;
  videoResult: VideoResult | null;
  error: string | null;
  onClose: () => void;
  onGenerateAnother: () => void;
}

export function AnimationModal({
  isOpen,
  isGenerating,
  generationStatus,
  videoResult,
  error,
  onClose,
  onGenerateAnother,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Auto-play when video is ready
  useEffect(() => {
    if (videoResult && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [videoResult]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Animation Player">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <span className="modal-icon">🎬</span>
            <h2>
              {isGenerating ? 'Creating Your Animation' : videoResult ? 'Your Animation' : 'Generation Failed'}
            </h2>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
            id="modal-close-btn"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Error State */}
          {error && !isGenerating && (
            <div className="modal-error">
              <div className="error-icon">⚠️</div>
              <h3>Render Failed</h3>
              <p className="error-detail">{error}</p>
              <button
                className="btn btn--primary"
                onClick={onGenerateAnother}
                id="retry-btn"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Loading State */}
          {isGenerating && (
            <LoadingAnimation status={generationStatus} />
          )}

          {/* Video State */}
          {videoResult && !isGenerating && (
            <div className="video-container">
              <video
                ref={videoRef}
                className="video-player"
                src={videoResult.videoUrl}
                controls
                loop
                playsInline
                id="animation-video-player"
              >
                Your browser does not support the video tag.
              </video>

              <div className="video-actions">
                <a
                  href={videoResult.videoUrl}
                  download="manim_animation.mp4"
                  className="btn btn--secondary"
                  id="download-video-btn"
                >
                  ⬇️ Download Video
                </a>
                <button
                  className="btn btn--primary"
                  onClick={onGenerateAnother}
                  id="generate-another-btn"
                >
                  ✨ Generate Another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
