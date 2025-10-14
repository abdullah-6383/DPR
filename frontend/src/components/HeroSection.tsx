'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { AuroraBackground } from '@/components/ui/aurora-background';
import { FlipWordsSimple } from '@/components/ui/flip-words-simple';

export default function HeroSection() {
  // Core languages for Northeast India
  const northEastLanguages = [
    "English", // English
    "हिंदी", // Hindi
    "অসমীয়া", // Assamese
    "বাংলা" // Bengali
  ];

  return (
    <AuroraBackground id="home" className="h-screen w-full">
      <motion.div
        initial={{ opacity: 0.0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.3,
          duration: 0.8,
          ease: "easeInOut",
        }}
        className="relative flex flex-col gap-8 items-center justify-center px-6 h-full w-full z-10 pt-16"
      >
        {/* Main Headline */}
        <div className="space-y-8 text-center max-w-4xl">
          <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight space-y-2">
            <div className="block">DPR ASSESSMENT IN</div>
            <div className="flex justify-center items-center min-h-[5rem] lg:min-h-[6rem] py-2">
              <FlipWordsSimple 
                words={northEastLanguages} 
                duration={1200}
                className="bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 bg-clip-text text-transparent font-bold text-6xl lg:text-8xl text-center leading-normal"
                style={{ 
                  fontFamily: 'var(--font-poppins), var(--font-bengali), var(--font-devanagari), system-ui, sans-serif',
                  fontFeatureSettings: '"kern" 1, "liga" 1',
                  lineHeight: '1.1'
                }}
              />
            </div>
            <div className="block">MADE SIMPLE</div>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            AI-powered project evaluation supporting all Northeast Indian languages and communities
          </p>
        </div>

        {/* Action Button */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-6"
        >
          <Link 
            href="/login"
            className="inline-flex items-center justify-center px-8 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            Start Assessment
            <ArrowRightIcon className="w-5 h-5 ml-2" />
          </Link>
        </motion.div>


      </motion.div>
    </AuroraBackground>
  );
}