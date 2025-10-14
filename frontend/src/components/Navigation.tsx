'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { auth } from '@/lib/auth';

const Navigation: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const navigationItems = [
    { name: 'Add & Manage DPR', href: '#manage-dpr' },
    { name: 'Collaboration Demo', href: '/collaboration', isRoute: true }
  ];

  const handleScrollTo = (href: string) => {
    const targetId = href.substring(1); // Remove the '#' from href
    const targetElement = document.getElementById(targetId);
    
    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  const languages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
    { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' }
  ];

  const [currentLanguage, setCurrentLanguage] = useState(languages[0]);

  useEffect(() => {
    // Check authentication status on component mount and route changes
    const checkAuth = () => {
      setIsAuthenticated(auth.isAuthenticated());
    };
    checkAuth();
    // Listen for storage changes (when auth state changes in other tabs/components)
    const handleStorageChange = () => {
      checkAuth();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [pathname]);

  const handleLogout = () => {
    auth.logout();
    router.push('/');
    // Don't update state immediately - let the route change handle it
  };

  return (
    <header className="w-full fixed top-4 left-0 z-50 bg-transparent px-4">
      {/* Main Navigation */}
      <div className="bg-black/20 backdrop-blur-md border border-white/30 rounded-2xl shadow-2xl w-full">
        <div className="w-full px-8">
          <div className="flex items-center justify-between h-18">
            {/* Logo and Title Section */}
            <div className="flex items-center space-x-6">
              <div className="flex-shrink-0">
                <Link href="/" className="cursor-pointer">
                  <Image
                    src="/mdoner-logo-dark.png"
                    alt="North Eastern Development Council - Ministry of Development of North Eastern Region"
                    width={280}
                    height={84}
                    className="h-12 w-auto object-contain hover:opacity-80 transition-opacity duration-200"
                    priority
                  />
                </Link>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight">
                  AI-Powered DPR Assessment System
                </h1>
                <p className="text-xs text-gray-300">
                  Quality Assessment & Risk Prediction Portal
                </p>
              </div>
            </div>

            {/* Right Side Navigation and CTA */}
            <div className="hidden md:flex items-center space-x-8 ml-auto">
              {/* Desktop Navigation */}
              <nav className="flex items-center space-x-6">
                {navigationItems.map((item) => (
                  item.isRoute ? (
                    <Link
                      key={item.name}
                      href={item.href}
                      className="text-gray-300 hover:text-blue-300 font-medium text-sm transition-colors duration-200 relative group px-2 py-1"
                    >
                      {item.name}
                      <span className="absolute left-0 right-0 bottom-[-4px] h-0.5 bg-blue-900 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
                    </Link>
                  ) : (
                    <button
                      key={item.name}
                      onClick={() => handleScrollTo(item.href)}
                      className="text-gray-300 hover:text-blue-300 font-medium text-sm transition-colors duration-200 relative group px-2 py-1"
                    >
                      {item.name}
                      <span className="absolute left-0 right-0 bottom-[-4px] h-0.5 bg-blue-900 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
                    </button>
                  )
                ))}
              </nav>

              {/* Language Selector */}
              <div className="relative">
                <button
                  onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
                  className="flex items-center space-x-2 bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 shadow-md hover:shadow-lg border border-gray-600"
                >
                  <svg className="h-4 w-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                  <span className="font-medium">{currentLanguage.nativeName}</span>
                  <svg 
                    className={`h-4 w-4 transition-transform duration-200 ${isLanguageMenuOpen ? 'rotate-180' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isLanguageMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl z-50 border border-gray-200 overflow-hidden">
                    <div className="py-1">
                      {languages.map((language) => (
                        <button
                          key={language.code}
                          onClick={() => {
                            setCurrentLanguage(language);
                            setIsLanguageMenuOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-sm transition-all duration-200 flex items-center justify-between group ${
                            currentLanguage.code === language.code 
                              ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500' 
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <span className="font-medium">{language.nativeName}</span>
                            <span className="text-xs text-gray-500">({language.name})</span>
                          </div>
                          {currentLanguage.code === language.code && (
                            <svg className="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 px-4 py-2 bg-gray-50">
                      <p className="text-xs text-gray-500 text-center">Select your preferred language</p>
                    </div>
                  </div>
                )}
              </div>

              {/* CTA Button */}
              {isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                >
                  Logout
                </button>
              ) : (
                <Link href="/login" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200">
                  Access Portal
                </Link>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-gray-300 hover:text-blue-300 p-2"
              >
                {isMobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-black/80 backdrop-blur-md border-t border-white/20 rounded-b-2xl">
            <div className="px-4 py-3 space-y-3">
              {navigationItems.map((item) => (
                item.isRoute ? (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-gray-300 hover:text-blue-300 font-medium text-sm py-2 transition-colors duration-200 w-full text-left"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <button
                    key={item.name}
                    onClick={() => {
                      handleScrollTo(item.href);
                      setIsMobileMenuOpen(false);
                    }}
                    className="block text-gray-300 hover:text-blue-300 font-medium text-sm py-2 transition-colors duration-200 w-full text-left"
                  >
                    {item.name}
                  </button>
                )
              ))}
              {isAuthenticated ? (
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 mt-4 block text-center"
                >
                  Logout
                </button>
              ) : (
                <Link href="/login" className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 mt-4 block text-center">
                  Access Portal
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navigation;