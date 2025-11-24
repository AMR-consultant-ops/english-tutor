import React, { useState, useEffect } from 'react';
import { LiveTutor } from './Components/LiveTutor';
import { TTSDrill } from './Components/TTSDrill';
import { QuickHelp } from './Components/QuickHelp';
import { ReadingPractice } from './Components/ReadingPractice';
import { VocabularyBuilder } from './Components/VocabularyBuilder';
import { UserProgressCard } from './Components/UserProgressCard';
import { AppMode } from './types';
import { POINTS } from './hooks/useProgress';
import './index.css';

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  const [isDark, setIsDark] = useState(false);

  // Initialize theme from system preference or localStorage
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const saved = localStorage.getItem('theme-preference');

    let shouldBeDark = false;

    if (saved) {
      shouldBeDark = saved === 'dark';
    } else {
      shouldBeDark = prefersDark;
    }

    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    }
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem('theme-preference');

      // Only auto-switch if user hasn't manually set a preference
      if (!saved) {
        if (e.matches) {
          document.documentElement.classList.add('dark');
          setIsDark(true);
        } else {
          document.documentElement.classList.remove('dark');
          setIsDark(false);
        }
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Toggle Theme Effect
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme-preference', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme-preference', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const renderContent = () => {
    switch (mode) {
      case AppMode.LIVE_TUTOR:
        return <LiveTutor />;

      case AppMode.READING:
        return <ReadingPractice />;

      case AppMode.DRILLS:
        return (
          <div className="h-full w-full overflow-y-auto pb-24 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
            {/* Header */}
            <header className="container-max py-8 sm:py-12">
              <h2 className="h2 bg-gradient-to-r from-blue-600 to-blue-400 dark:from-blue-400 dark:to-blue-200 bg-clip-text text-transparent">
                Herramientas & Práctica
              </h2>
              <p className="body-sm text-slate-500 dark:text-slate-400 mt-2">
                Mejora tu inglés a tu ritmo.
              </p>
            </header>

            {/* Tools Grid - Responsive */}
            <div className="container-max space-y-8 sm:space-y-12">
              <div>
                <h3 className="h3 mb-4 sm:mb-6">Pronunciación y Audio</h3>
                <TTSDrill />
              </div>

              <div>
                <h3 className="h3 mb-4 sm:mb-6">Vocabulario</h3>
                <VocabularyBuilder />
              </div>

              <div>
                <h3 className="h3 mb-4 sm:mb-6">Ayuda Rápida</h3>
                <QuickHelp />
              </div>
            </div>
          </div>
        );

      case AppMode.HOME:
      default:
        return (
          <div className="h-full w-full flex flex-col items-center justify-center p-4 sm:p-6 space-y-6 sm:space-y-8 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 overflow-y-auto transition-colors duration-300">
            {/* Logo & Branding */}
            <div className="flex flex-col items-center mt-4 mb-2 max-w-md">
              {/* Animated Logo */}
              <div className="relative w-32 sm:w-40 h-32 sm:h-40 flex items-center justify-center mb-6 group">
                {/* Glow effect - only visible in dark mode */}
                <div className="absolute inset-0 bg-blue-500/30 blur-3xl rounded-full opacity-0 dark:opacity-100 transition-opacity duration-500"></div>

                {/* Logo Circle */}
                <div className="relative w-full h-full bg-white rounded-full shadow-2xl flex items-center justify-center p-4 ring-4 ring-slate-50 dark:ring-slate-800 transition-transform duration-500 hover:scale-105">
                  <svg
                    viewBox="0 0 200 200"
                    className="w-full h-full"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="100" cy="100" r="90" stroke="#0ea5e9" strokeWidth="12" />
                    <text
                      x="100"
                      y="130"
                      textAnchor="middle"
                      fontSize="80"
                      fontWeight="900"
                      fill="#0ea5e9"
                      fontFamily="Nunito, sans-serif"
                    >
                      ES
                    </text>
                  </svg>
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="text-center mb-6">
                <h1 className="h1 text-2xl sm:text-3xl md:text-4xl tracking-tighter">
                  ENGLISH START
                </h1>
                <p className="label mt-2 sm:mt-3">Tu Tutor Personal con IA</p>
              </div>

              {/* Progress Card */}
              <UserProgressCard />
            </div>

            {/* Action Buttons - Responsive Grid */}
            <div className="w-full max-w-sm px-4 sm:px-0 space-y-3 sm:space-y-4">
              {/* Live Tutor Button */}
              <button
                onClick={() => setMode(AppMode.LIVE_TUTOR)}
                className="btn-primary w-full py-4 sm:py-5 flex items-center justify-center gap-3 text-base sm:text-lg"
                aria-label="Iniciar clase en vivo"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
                <div className="text-left">
                  <span className="block font-bold">Clase en Vivo</span>
                  <span className="text-xs opacity-75 uppercase tracking-wider">
                    +{POINTS.live} XP
                  </span>
                </div>
              </button>

              {/* Reading Practice Button */}
              <button
                onClick={() => setMode(AppMode.READING)}
                className="w-full bg-slate-200 dark:bg-blue-800 hover:bg-slate-300 dark:hover:bg-blue-700 text-blue-900 dark:text-white py-4 sm:py-5 rounded-2xl font-bold text-base sm:text-lg shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 border border-slate-300 dark:border-blue-700 focus-ring"
                aria-label="Iniciar práctica de lectura"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                <div className="text-left">
                  <span className="block font-bold">Práctica de Lectura</span>
                  <span className="text-xs opacity-75 uppercase tracking-wider">
                    +{POINTS.reading} XP
                  </span>
                </div>
              </button>

              {/* Tools & Practice Button */}
              <button
                onClick={() => setMode(AppMode.DRILLS)}
                className="w-full bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-white py-4 sm:py-5 rounded-2xl font-bold text-base sm:text-lg shadow-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center gap-3 transition-all active:scale-95 focus-ring"
                aria-label="Ir a herramientas y práctica"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="text-left">
                  <span className="block font-bold">Herramientas</span>
                  <span className="text-xs opacity-75 uppercase tracking-wider">
                    +{POINTS.vocab} XP
                  </span>
                </div>
              </button>
            </div>

            {/* Footer Credits */}
            <div className="pt-6 text-center max-w-xs mx-auto opacity-70 hover:opacity-100 transition-opacity">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                AI Tutor Beta Version <br /> Developed by Dr. Anderzon Medina Roa
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white overflow-hidden flex flex-col font-sans transition-colors duration-300">
      {/* Theme Toggle Button - Floating */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={toggleTheme}
          className="p-3 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-yellow-400 shadow-md transition-all hover:scale-110 focus-ring"
          title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Global Header */}

