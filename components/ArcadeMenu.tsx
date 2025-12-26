--- START OF FILE Bananyum-main/components/ArcadeMenu.tsx ---

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Keyboard, Split, Clock, EyeOff, Shuffle, Users, VolumeX, 
  Map as MapIcon, Skull, Calendar, Swords, Dices, Volume2, 
  RefreshCcw, Brain, WifiOff 
} from 'lucide-react';
import { GameVariant, AppSettings, GameState } from '../types';
import { GameAudio } from '../services/audioUtils';

interface Props {
  settings: AppSettings;
  setHeaderConfig: (config: { title: string | null; color: string }) => void;
}

// Reusing style helper from GameMode
const MenuButton = ({ icon, title, desc, onClick, color }: any) => {
    const colorVariants: Record<string, { bg: string, text: string, border: string }> = {
        blue: { bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'hover:border-blue-200 dark:hover:border-blue-800' },
        emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'hover:border-emerald-200 dark:hover:border-emerald-800' },
        amber: { bg: 'bg-amber-100 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', border: 'hover:border-amber-200 dark:hover:border-amber-800' },
        indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'hover:border-indigo-200 dark:hover:border-indigo-800' },
        purple: { bg: 'bg-purple-100 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', border: 'hover:border-purple-200 dark:hover:border-purple-800' },
        teal: { bg: 'bg-teal-100 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400', border: 'hover:border-teal-200 dark:hover:border-teal-800' },
        slate: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', border: 'hover:border-slate-300 dark:hover:border-slate-600' },
        lime: { bg: 'bg-lime-100 dark:bg-lime-900/20', text: 'text-lime-600 dark:text-lime-400', border: 'hover:border-lime-200 dark:hover:border-lime-800' },
        red: { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', border: 'hover:border-red-200 dark:hover:border-red-800' },
        orange: { bg: 'bg-orange-100 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', border: 'hover:border-orange-200 dark:hover:border-orange-800' },
        pink: { bg: 'bg-pink-100 dark:bg-pink-900/20', text: 'text-pink-600 dark:text-pink-400', border: 'hover:border-pink-200 dark:hover:border-pink-800' },
        fuchsia: { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/20', text: 'text-fuchsia-600 dark:text-fuchsia-400', border: 'hover:border-fuchsia-200 dark:hover:border-fuchsia-800' },
        cyan: { bg: 'bg-cyan-100 dark:bg-cyan-900/20', text: 'text-cyan-600 dark:text-cyan-400', border: 'hover:border-cyan-200 dark:hover:border-cyan-800' },
        rose: { bg: 'bg-rose-100 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400', border: 'hover:border-rose-200 dark:hover:border-rose-800' },
        violet: { bg: 'bg-violet-100 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400', border: 'hover:border-violet-200 dark:hover:border-violet-800' },
    };

    const styles = colorVariants[color] || colorVariants['blue'];

    return (
        <button onClick={onClick} className={`group relative p-6 rounded-3xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all text-left ${styles.border} hover:shadow-lg hover:-translate-y-1`}>
            <div className="flex items-center gap-4 mb-3">
              <div className={`p-3 rounded-xl ${styles.bg} ${styles.text}`}>
                  {icon}
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">{title}</h3>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{desc}</p>
        </button>
    );
};

const ArcadeMenu: React.FC<Props> = ({ settings, setHeaderConfig }) => {
  const navigate = useNavigate();
  const [isSpinning, setIsSpinning] = useState(false);
  
  useEffect(() => {
    setHeaderConfig({ title: "Game Arcade", color: "primary" });
  }, [setHeaderConfig]);

  const handleGameSelect = (variant: GameVariant) => {
    GameAudio.playClick();
    navigate(`/play/${variant}`);
  };

  const spinWheel = () => {
    GameAudio.playClick();
    setIsSpinning(true);
    const variants: GameVariant[] = ['CLASSIC', 'SPEED', 'HOMOPHONE', 'SCRAMBLE', 'MISSING_LETTER', 'REVERSE', 'WHISPER', 'SILENT_LETTER'];
    
    // Play clicking sound during spin
    let spins = 0;
    const interval = setInterval(() => {
        if(spins < 10) GameAudio.playTick();
        spins++;
    }, 200);

    setTimeout(() => {
        clearInterval(interval);
        setIsSpinning(false);
        const random = variants[Math.floor(Math.random() * variants.length)];
        GameAudio.playWin();
        navigate(`/play/${random}`);
    }, 3000);
  };

  if (isSpinning) {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh]">
            <div className={`w-64 h-64 rounded-full border-8 border-primary-500 border-dashed animate-spin flex items-center justify-center bg-white dark:bg-slate-800 shadow-xl`}>
                <Dices size={64} className="text-primary-500"/>
            </div>
            <h2 className="mt-8 text-2xl font-bold text-slate-800 dark:text-white animate-pulse">Spinning...</h2>
        </div>
    );
  }

  return (
    <div className="flex flex-col items-center animate-fade-in pb-10">
      <div className="text-center space-y-4 mb-8">
        <div className="flex items-center justify-center gap-2">
            <h2 className="text-4xl font-bold text-slate-800 dark:text-white transition-colors">Game Arcade</h2>
            {settings.isOfflineMode && (
                <div className="bg-slate-200 dark:bg-slate-700 text-slate-500 text-xs px-2 py-1 rounded-full flex items-center gap-1 font-bold">
                    <WifiOff size={12} /> OFFLINE
                </div>
            )}
        </div>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">15 ways to master English spelling.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-5xl px-4">
        <MenuButton icon={<Keyboard size={24}/>} title="Spell by Sound" desc="Listen and spell. The classic mode." color="blue" onClick={() => handleGameSelect('CLASSIC')} />
        <MenuButton icon={<Split size={24}/>} title="Homophone Battle" desc="Their, There, or They're?" color="emerald" onClick={() => handleGameSelect('HOMOPHONE')} />
        <MenuButton icon={<Clock size={24}/>} title="Speed Speller" desc="60 seconds. How fast are you?" color="amber" onClick={() => handleGameSelect('SPEED')} />
        <MenuButton icon={<EyeOff size={24}/>} title="Missing Letter" desc="Fill in the blanks: E_TR_ORD_NARY" color="indigo" onClick={() => handleGameSelect('MISSING_LETTER')} />
        <MenuButton icon={<Shuffle size={24}/>} title="Unscramble" desc="Rearrange letters to find the word." color="purple" onClick={() => handleGameSelect('SCRAMBLE')} />
        <MenuButton icon={<Users size={24}/>} title="Sentence to Spelling" desc="Identify the target word in a sentence." color="teal" onClick={() => handleGameSelect('SENTENCE_SPELL')} />
        <MenuButton icon={<VolumeX size={24}/>} title="Whisper Mode" desc="Quiet, distorted audio. Listen closely." color="slate" onClick={() => handleGameSelect('WHISPER')} />
        <MenuButton 
          icon={<MapIcon size={24}/>} 
          title="Word Journey" 
          desc="Travel through a topic of your choice." 
          color="lime" 
          onClick={() => handleGameSelect('ADVENTURE')} 
        />
        <MenuButton icon={<Skull size={24}/>} title="Boss Fight" desc="Survive 10 extremely hard words." color="red" onClick={() => handleGameSelect('BOSS')} />
        <MenuButton icon={<Calendar size={24}/>} title="Daily Challenge" desc="One unique word every day." color="orange" onClick={() => handleGameSelect('DAILY')} />
        <MenuButton icon={<Swords size={24}/>} title="1v1 Battle" desc="Local turn-based speed duel." color="pink" onClick={() => handleGameSelect('MULTIPLAYER')} />
        <MenuButton icon={<Dices size={24}/>} title="Spin the Wheel" desc="Random category selection." color="fuchsia" onClick={spinWheel} />
        <MenuButton icon={<Volume2 size={24}/>} title="Silent Hunters" desc="Knight, Psychology, Gnaw." color="cyan" onClick={() => handleGameSelect('SILENT_LETTER')} />
        <MenuButton icon={<RefreshCcw size={24}/>} title="Reverse Spelling" desc="Type the word backwards!" color="rose" onClick={() => handleGameSelect('REVERSE')} />
        <MenuButton icon={<Brain size={24}/>} title="Memory Flash" desc="See it for 2s, then spell it." color="violet" onClick={() => handleGameSelect('MEMORY')} />
      </div>
    </div>
  );
};

export default ArcadeMenu;