import React from 'react';
import { HeroSection } from '@/components/home/HeroSection';
import { FlywheelExplainer } from '@/components/home/FlywheelExplainer';
import { HowItWorks } from '@/components/home/HowItWorks';
import { AuditCalculator } from '@/components/home/AuditCalculator';
import { AgentDemoSandbox } from '@/components/home/AgentDemoSandbox';

export default function HomePage() {
  return (
    <div data-testid="home-page">
      <HeroSection />
      <FlywheelExplainer />
      <HowItWorks />
      <AuditCalculator />
      <AgentDemoSandbox />
    </div>
  );
}
