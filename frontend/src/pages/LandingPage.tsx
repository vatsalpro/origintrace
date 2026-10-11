import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { HeroSection } from '../components/landing/HeroSection';
import { TrustStrip } from '../components/landing/TrustStrip';
import { FeatureSection } from '../components/landing/FeatureSection';
import { WorkflowSection } from '../components/landing/WorkflowSection';
import { FinalCTA } from '../components/landing/FinalCTA';
import { LandingFooter } from '../components/landing/LandingFooter';
import { Investigation } from '../types';

interface LandingPageProps {
  investigations?: Investigation[];
  selectedInvestigationId?: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  investigations = [],
  selectedInvestigationId
}) => {
  const navigate = useNavigate();
  const hasActiveCases = investigations.length > 0;
  const targetRoute = hasActiveCases ? '/dashboard' : '/new';
  const continueLabel = 'Continue Investigation';

  const handleContinue = () => {
    navigate(targetRoute);
  };

  return (
    <div className="landing-page min-h-screen bg-[#F8FAFC] text-[#14243A] font-sans selection:bg-blue-100 selection:text-blue-900 relative">
      {/* Subtle Ambient Background Gradient */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/50 via-[#F8FAFC] to-[#EEF3F8]" />

      {/* 1. Navigation Bar */}
      <LandingNavbar onContinue={handleContinue} continueLabel={continueLabel} />

      {/* 2. Hero Section with 3D Detective Scene */}
      <HeroSection onContinue={handleContinue} continueLabel={continueLabel} />

      {/* 3. Trust & Capability Strip */}
      <TrustStrip />

      {/* 4. Feature Section */}
      <FeatureSection />

      {/* 5. Three-Step Investigation Workflow */}
      <WorkflowSection />

      {/* 6. Final Call to Action */}
      <FinalCTA onContinue={handleContinue} continueLabel={continueLabel} />

      {/* 7. Footer */}
      <LandingFooter onContinue={handleContinue} continueLabel={continueLabel} />
    </div>
  );
};

export default LandingPage;
