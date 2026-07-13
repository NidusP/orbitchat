'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/contexts/i18n-context';

interface WelcomeStep {
  title: string;
  subtitle: string;
  description: string;
}

interface WelcomeGuideProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function WelcomeGuide({ onComplete, onSkip }: WelcomeGuideProps) {
  const { t } = useI18n();
  const steps = useMemo<WelcomeStep[]>(
    () => [
      {
        title: t('onboarding.steps.step1.title'),
        subtitle: t('onboarding.steps.step1.subtitle'),
        description: t('onboarding.steps.step1.description'),
      },
      {
        title: t('onboarding.steps.step2.title'),
        subtitle: t('onboarding.steps.step2.subtitle'),
        description: t('onboarding.steps.step2.description'),
      },
      {
        title: t('onboarding.steps.step3.title'),
        subtitle: t('onboarding.steps.step3.subtitle'),
        description: t('onboarding.steps.step3.description'),
      },
    ],
    [t]
  );
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const progressLabel = useMemo(
    () => t('onboarding.progress', { current: currentStep + 1, total: steps.length }),
    [currentStep, steps.length, t]
  );

  function handleNext(): void {
    if (isLastStep) {
      onComplete();
      return;
    }

    setCurrentStep((value) => value + 1);
  }

  return (
    <div
      className="onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      data-testid="onboarding-welcome"
    >
      <section className="onboarding-panel card">
        <p className="onboarding-progress">{progressLabel}</p>
        <h2 id="onboarding-title" className="onboarding-title">
          {step.title}
        </h2>
        <p className="onboarding-subtitle">{step.subtitle}</p>
        <p className="onboarding-description">{step.description}</p>

        <div className="onboarding-actions">
          <button type="button" className="btn btn-secondary" onClick={onSkip}>
            {t('onboarding.skip')}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleNext}>
            {isLastStep ? t('onboarding.start') : t('onboarding.next')}
          </button>
        </div>
      </section>
    </div>
  );
}
