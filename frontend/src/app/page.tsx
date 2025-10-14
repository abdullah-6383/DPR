import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import HeroSection from '@/components/HeroSection';
import AboutSystem from '@/components/AboutSystem';
import Features from '@/components/Features';

export default function Home() {
  return (
    <div className="min-h-screen bg-black flex flex-col relative">
      <Navigation />
      
      {/* Main Content Area */}
      <main className="flex-grow">
        <HeroSection />
        <AboutSystem />
        <Features />
      </main>

      <Footer />
    </div>
  );
}
