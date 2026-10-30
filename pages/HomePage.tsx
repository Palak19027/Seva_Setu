import { useEffect } from 'react';
import { useLocation } from '@/lib/navigation';
import { HeroSection } from '@/components/home/HeroSection';
import { CategoryGrid } from '@/components/home/CategoryGrid';
import { ImpactStats } from '@/components/home/ImpactStats';
import { HowItWorks } from '@/components/home/HowItWorks';
import { AboutSection, TestimonialsSection } from '@/components/home/AboutAndTestimonials';

export default function HomePage() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.replace('#', ''))?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  return (
    <>
      <HeroSection />
      <CategoryGrid />
      <ImpactStats />
      <HowItWorks />
      <AboutSection />
      <TestimonialsSection />
    </>
  );
}
