
import React, { useState, useEffect } from 'react';
import { Gamepad2, Settings as SettingsIcon } from 'lucide-react';
import GameMode from './components/GameMode';
import SettingsModal from './components/SettingsModal';
import { AppSettings } from './types';
import { setSfxVolume, setVibrationIntensity } from './services/audioUtils';

type AppMode = 'home' | 'game';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  ttsVolume: 1.0,
  sfxVolume: 0.5,
  vibration: 'medium',
  voiceAccent: 'US',
  isOfflineMode: false // Default to online
};

const COLOR_THEMES: Record<string, string> = {
  primary: 'bg-primary-50 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300',
  blue: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  amber: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300',
  purple: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
  teal: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300',
  slate: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  lime: 'bg-lime-100 dark:bg-lime-900/50 text-lime-700 dark:text-lime-300',
  red: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
  orange: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300',
  pink: 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300',
  fuchsia: 'bg-fuchsia-100 dark:bg-fuchsia-900/50 text-fuchsia-700 dark:text-fuchsia-300',
  cyan: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300',
  rose: 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300',
  violet: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300',
};

export default function App() {
  const [mode, setMode] = useState<AppMode>('home');
  const [showSettings, setShowSettings] = useState(false);
  const [headerConfig, setHeaderConfig] = useState<{ title: string | null; color: string }>({
    title: null,
    color: 'primary'
  });
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('spellbound_settings');
    // Merge saved settings with defaults to ensure new properties exist
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  // Apply Settings Side Effects
  useEffect(() => {
    // 1. Persist
    localStorage.setItem('spellbound_settings', JSON.stringify(settings));

    // 2. Audio Utils Updates
    setSfxVolume(settings.sfxVolume);
    setVibrationIntensity(settings.vibration);

    // 3. Theme Application
    const root = window.document.documentElement;
    const isDark = 
      settings.theme === 'dark' || 
      (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

  }, [settings]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const handleGoHome = () => {
    setMode('home');
    setHeaderConfig({ title: null, color: 'primary' });
  };

  const activeThemeClass = COLOR_THEMES[headerConfig.color] || COLOR_THEMES['primary'];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-primary-200 dark:selection:bg-primary-900 transition-colors duration-300">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={handleGoHome}
          >
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary-700 to-secondary-700 dark:from-primary-400 dark:to-secondary-400 bg-clip-text text-transparent">
              Bananyum
            </h1>
          </div>
          
          <nav className="flex items-center gap-3">
             <button 
              onClick={() => setMode('game')}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${mode === 'game' ? activeThemeClass : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              {headerConfig.title || 'Game Arcade'}
            </button>
             <button 
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Settings"
            >
              <SettingsIcon size={20} />
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {mode === 'home' && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 animate-fade-in py-8">
            <div className="text-center space-y-4 max-w-2xl">
              <h2 className="text-5xl md:text-7xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                Master Spelling with <span className="text-primary-600 dark:text-primary-400">AI</span>
              </h2>
            </div>

            {/* Video Tutorial Section */}
            <div 
              className="relative w-full max-w-[320px] md:max-w-[400px] aspect-square bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-primary-500/10 border-4 border-white dark:border-slate-800 group transition-all hover:scale-[1.02] isolate transform-gpu" 
              style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
            >
                <iframe 
                    src="https://streamable.com/e/apx9s7?autoplay=1&loop=1"
                    className="w-full h-full object-cover"
                    allow="autoplay; fullscreen"
                    title="Tutorial"
                ></iframe>
            </div>

            <div className="w-full max-w-xl">
              <div 
                onClick={() => setMode('game')}
                className="group cursor-pointer bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-2xl hover:shadow-primary-100/50 dark:hover:shadow-primary-900/20 transition-all duration-300 flex flex-col items-center text-center"
              >
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                  <Gamepad2 size={40} />
                </div>
                <h3 className="text-3xl font-bold text-slate-800 dark:text-white mb-10">Enter Game Arcade</h3>
                
                <span className="w-full max-w-[300px] py-6 text-2xl bg-primary-600 text-white rounded-full font-bold shadow-xl shadow-primary-300/50 dark:shadow-none group-hover:bg-primary-700 group-hover:scale-105 transition-all">
                    Start Playing
                </span>
              </div>
            </div>
          </div>
        )}

        {mode === 'game' && <GameMode onBack={handleGoHome} settings={settings} setHeaderConfig={setHeaderConfig} updateSettings={updateSettings} />}
      </main>

      {/* Settings Modal Overlay */}
      {showSettings && (
        <SettingsModal 
          settings={settings} 
          updateSettings={updateSettings} 
          onClose={() => setShowSettings(false)} 
        />
      )}
    </div>
  );
}
