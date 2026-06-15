// LoadingAnimation — step-by-step progress for animation generation

import type { GenerationStep, GenerationStatus } from '../types';

interface Props {
  status: GenerationStatus | null;
}

interface Step {
  id: GenerationStep;
  label: string;
  description: string;
}

const STEPS: Step[] = [
  {
    id: 'generating_code',
    label: 'Writing Manim Code',
    description: 'AI is composing your animation...',
  },
  {
    id: 'code_ready',
    label: 'Code Ready',
    description: 'Starting render engine...',
  },
  {
    id: 'rendering',
    label: 'Rendering Animation',
    description: 'Manim is drawing your video (20–60s)...',
  },
  {
    id: 'done',
    label: 'Animation Complete!',
    description: 'Your video is ready to play.',
  },
];

const STEP_ORDER: GenerationStep[] = ['generating_code', 'code_ready', 'rendering', 'done'];

function getStepStatus(step: Step, currentStep: GenerationStep): 'done' | 'active' | 'pending' {
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  const stepIndex = STEP_ORDER.indexOf(step.id);
  if (stepIndex < currentIndex) return 'done';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

export function LoadingAnimation({ status }: Props) {
  const currentStep = status?.step ?? 'generating_code';

  return (
    <div className="loading-animation">
      <div className="loading-title">
        <div className="loading-spinner" />
        <span>Generating Your Animation</span>
      </div>

      <div className="steps-list">
        {STEPS.map((step) => {
          const stepStatus = getStepStatus(step, currentStep);
          return (
            <div key={step.id} className={`step step--${stepStatus}`}>
              <div className="step-icon">
                {stepStatus === 'done' && <span className="step-check">✓</span>}
                {stepStatus === 'active' && <div className="step-pulse" />}
                {stepStatus === 'pending' && <div className="step-dot" />}
              </div>
              <div className="step-text">
                <span className="step-label">{step.label}</span>
                {stepStatus === 'active' && (
                  <span className="step-desc">{status?.message || step.description}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {currentStep === 'rendering' && (
        <div className="render-warning">
          <span>⏳</span>
          <span>Rendering takes 20–90 seconds. Please wait...</span>
        </div>
      )}
    </div>
  );
}
