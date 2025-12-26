--- START OF FILE Bananyum-main/components/GameMode.tsx ---

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Play, Volume2, ArrowRight, Trophy, AlertCircle, RotateCcw, 
  Sparkles, Timer, Check, Map as MapIcon, Skull, Dices, VolumeX, Plus, Star, Zap, Target, Home, Compass
} from 'lucide-react';
import { WordChallenge, HomophoneChallenge, Difficulty, GameState, ScoreData, GameVariant, AdventureLevel, AppSettings } from '../types';
import { generateWordList, generateRemedialWordList, generateHomophones, generateRemedialHomophones, generateDailyWord } from '../services/geminiService';
import { OfflineService } from '../services/offlineService';
import { GameAudio } from '../services/audioUtils';

interface Props {
  settings: AppSettings;
  setHeaderConfig: (config: { title: string | null; color: string }) => void;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
}

// Helper to generate Wave SVG Data URI
const getWaveSvg = (color: string) => 
  `data:image/svg+xml,%3Csvg width='40' height='12' viewBox='0 0 40 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 6 Q 10 1 20 6 T 40 6' stroke='${encodeURIComponent(color)}' fill='none' stroke-width='4' stroke-linecap='round' stroke-linejoin='round' /%3E%3C/svg%3E`;

const WavyProgressBar = ({ progress, glow }: { progress: number; glow?: boolean }) => {
  const trackWave = getWaveSvg('#94a3b8'); 
  const progressWave = getWaveSvg('#0ea5e9'); 

  return (
    <div className="w-full h-3 mb-8 mt-8 md:mt-0 relative">
      <div 
        className="absolute inset-0 w-full h-full bg-repeat-x bg-left-center opacity-30 dark:opacity-20"
        style={{ backgroundImage: `url("${trackWave}")`, backgroundSize: '40px 12px' }}
      />
      <div 
        className="absolute inset-0 h-full bg-repeat-x bg-left-center transition-all duration-500 ease-out"
        style={{ 
          width: `${Math.max(5, progress)}%`, 
          backgroundImage: `url("${progressWave}")`, 
          backgroundSize: '40px 12px',
          overflow: 'hidden',
          borderRight: '1px solid transparent', 
          filter: glow ? 'drop-shadow(0 0 6px #38bdf8)' : 'none', 
          transition: 'filter 0.3s ease'
        }}
      />
    </div>
  );
};

const GAME_TITLES: Record<string, string> = {
  CLASSIC: 'Spell by Sound',
  HOMOPHONE: 'Homophone Battle',
  SPEED: 'Speed Speller',
  MISSING_LETTER: 'Missing Letter',
  SCRAMBLE: 'Unscramble',
  SENTENCE_SPELL: 'Sentence to Spelling',
  WHISPER: 'Whisper Mode',
  ADVENTURE: 'Word Journey',
  BOSS: 'Boss Fight',
  DAILY: 'Daily Challenge',
  MULTIPLAYER: '1v1 Battle',
  WHEEL: 'Spin the Wheel',
  SILENT_LETTER: 'Silent Hunters',
  REVERSE: 'Reverse Spelling',
  MEMORY: 'Memory Flash'
};

const GAME_COLORS: Record<string, string> = {
  CLASSIC: 'blue',
  HOMOPHONE: 'emerald',
  SPEED: 'amber',
  MISSING_LETTER: 'indigo',
  SCRAMBLE: 'purple',
  SENTENCE_SPELL: 'teal',
  WHISPER: 'slate',
  ADVENTURE: 'lime',
  BOSS: 'red',
  DAILY: 'orange',
  MULTIPLAYER: 'pink',
  WHEEL: 'fuchsia',
  SILENT_LETTER: 'cyan',
  REVERSE: 'rose',
  MEMORY: 'violet'
};

const GameMode: React.FC<Props> = ({ settings, setHeaderConfig, updateSettings }) => {
  const { variant } = useParams<{ variant: string }>();
  const navigate = useNavigate();
  const gameVariant = (variant as GameVariant) || 'CLASSIC';

  const [gameState, setGameState] = useState<GameState>(GameState.DIFFICULTY_SELECT);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.EASY);
  
  // Content State
  const [words, setWords] = useState<WordChallenge[]>([]);
  const [homophones, setHomophones] = useState<HomophoneChallenge[]>([]);
  
  // Gameplay State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState<ScoreData>({ correct: 0, total: 0, history: [] });
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'incorrect' | 'mp_result'>('none');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [inputAnimation, setInputAnimation] = useState(''); 
  
  // Timer State (Speed Mode)
  const [timeLeft, setTimeLeft] = useState(60);
  const [timerActive, setTimerActive] = useState(false);

  // Special Mode States
  const [scrambledWord, setScrambledWord] = useState('');
  const [maskedWord, setMaskedWord] = useState(''); 
  const [memoryVisible, setMemoryVisible] = useState(false); 
  
  // Multiplayer State
  const [mpPlayerTurn, setMpPlayerTurn] = useState<1 | 2>(1);
  const [mpScores, setMpScores] = useState({ p1: 0, p2: 0 });
  const [mpRoundStats, setMpRoundStats] = useState<{
      p1?: { input: string; time: number; correct: boolean };
      p2?: { input: string; time: number; correct: boolean };
  }>({});
  const [mpStartTime, setMpStartTime] = useState(0);
  const [mpWinner, setMpWinner] = useState<'p1' | 'p2' | 'draw' | null>(null);

  // Adventure State
  const [adventureLevels, setAdventureLevels] = useState<AdventureLevel[]>([]);
  const [journeyTheme, setJourneyTheme] = useState<string>("");
  const [customTopic, setCustomTopic] = useState("");

  // Initial Setup based on variant
  useEffect(() => {
    // If it's ADVENTURE, go straight to map if data exists, or setup
    if (gameVariant === 'ADVENTURE') {
        const savedLevels = localStorage.getItem('spellbound_levels');
        if (savedLevels) {
             setGameState(GameState.ADVENTURE_MAP);
        } else {
             setGameState(GameState.ADVENTURE_MAP); // Will show create screen
        }
    } 
    // If it doesn't need difficulty, start immediately
    else if (!['CLASSIC', 'SPEED', 'MISSING_LETTER', 'SCRAMBLE', 'SENTENCE_SPELL', 'WHISPER', 'SILENT_LETTER', 'REVERSE', 'MEMORY', 'MULTIPLAYER', 'HOMOPHONE', 'BOSS', 'DAILY'].includes(gameVariant)) {
        initGame(Difficulty.MEDIUM);
    } 
    // Otherwise show difficulty select (default state)
  }, [gameVariant]);

  // Update Header
  useEffect(() => {
    setHeaderConfig({ 
        title: GAME_TITLES[gameVariant] || 'Game', 
        color: GAME_COLORS[gameVariant] || 'primary'
    });
    return () => setHeaderConfig({ title: null, color: "primary" });
  }, [gameVariant, setHeaderConfig]);

  // Load Adventure Data
  useEffect(() => {
    const savedLevels = localStorage.getItem('spellbound_levels');
    const savedTheme = localStorage.getItem('spellbound_theme');
    
    if (savedLevels && savedTheme) {
        setAdventureLevels(JSON.parse(savedLevels));
        setJourneyTheme(savedTheme);
    }
  }, []);

  // Save Adventure Data
  useEffect(() => {
    if (adventureLevels.length > 0 && journeyTheme) {
        localStorage.setItem('spellbound_levels', JSON.stringify(adventureLevels));
        localStorage.setItem('spellbound_theme', journeyTheme);
    }
  }, [adventureLevels, journeyTheme]);

  // Voice State
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const updateVoices = () => setVoices(window.speechSynthesis.getVoices());
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // Timer Logic
  useEffect(() => {
    let interval: number;
    if (timerActive && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 5 && t > 0) GameAudio.playTick(); 
          if (t <= 1) {
            setTimerActive(false);
            setGameState(GameState.SUMMARY);
            GameAudio.playWin(); 
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  // Challenge Generators & Reset Logic
  useEffect(() => {
    if (!words[currentIndex]) return;
    const w = words[currentIndex].word;

    if (gameVariant === 'SCRAMBLE') {
      const shuffled = w.toUpperCase().split('').sort(() => Math.random() - 0.5).join('');
      setScrambledWord(shuffled === w.toUpperCase() ? w.toUpperCase().split('').reverse().join('') : shuffled);
    } else if (gameVariant === 'MISSING_LETTER') {
      const chars = w.split('');
      const indicesToHide = new Set<number>();
      const numToHide = Math.max(1, Math.floor(chars.length * 0.4));
      while(indicesToHide.size < numToHide) {
        indicesToHide.add(Math.floor(Math.random() * chars.length));
      }
      setMaskedWord(chars.map((c, i) => indicesToHide.has(i) ? '_' : c).join(''));
    } else if (gameVariant === 'MEMORY') {
      setMemoryVisible(true);
      setTimeout(() => setMemoryVisible(false), 2000); 
    } else if (gameVariant === 'MULTIPLAYER') {
        setMpPlayerTurn(1);
        setMpRoundStats({});
        setMpStartTime(Date.now());
        setMpWinner(null);
    }
  }, [currentIndex, words, gameVariant]);


  const playWord = useCallback((text: string, isWhisper = false) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = settings.voiceAccent === 'GB' ? 'en-GB' : 'en-US';
    const matchingVoices = voices.filter(v => v.lang === targetLang || v.lang.replace('_', '-').includes(targetLang));
    let selectedVoice = matchingVoices.find(v => v.name.includes("Google") || v.name.includes("Siri") || v.name.includes("Microsoft"));
    if (!selectedVoice && matchingVoices.length > 0) selectedVoice = matchingVoices[0];
    if (!selectedVoice) selectedVoice = voices.find(v => v.lang.startsWith('en'));

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = targetLang;
    }

    if (isWhisper) {
        utterance.volume = 0.3 * settings.ttsVolume; 
        utterance.pitch = 1.0; 
        utterance.rate = 0.6;
    } else {
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0 * settings.ttsVolume; 
    }
    
    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    window.speechSynthesis.speak(utterance);
  }, [voices, settings.ttsVolume, settings.voiceAccent]);

  const initGame = async (selectedDifficulty: Difficulty) => {
    GameAudio.playClick();
    setDifficulty(selectedDifficulty);
    setGameState(GameState.LOADING);
    setScore({ correct: 0, total: 0, history: [] });
    setCurrentIndex(0);
    setUserInput('');
    setFeedback('none');
    
    setMpScores({ p1: 0, p2: 0 });
    setMpRoundStats({});
    setMpWinner(null);
    
    let useOffline = settings.isOfflineMode;

    const loadData = async (offline: boolean) => {
        const count = (gameVariant === 'SPEED' || gameVariant === 'BOSS') ? 15 : 5;
        
        if (offline) {
             if (gameVariant === 'HOMOPHONE') return await OfflineService.generateHomophones(selectedDifficulty, 5);
             if (gameVariant === 'DAILY') return await OfflineService.generateDailyWord(selectedDifficulty);
             if (gameVariant === 'BOSS') return await OfflineService.generateWordList(Difficulty.EXTREME, 10);
             return await OfflineService.generateWordList(selectedDifficulty, count);
        } else {
             if (gameVariant === 'HOMOPHONE') return await generateHomophones(selectedDifficulty, 5);
             if (gameVariant === 'DAILY') return await generateDailyWord(selectedDifficulty);
             if (gameVariant === 'BOSS') return await generateWordList(selectedDifficulty, 10, 'BOSS');
             if (gameVariant === 'SILENT_LETTER') return await generateWordList(selectedDifficulty, 5, 'SILENT_LETTER');
             return await generateWordList(selectedDifficulty, count, gameVariant === 'ADVENTURE' ? journeyTheme : undefined);
        }
    };

    let loadedWords: WordChallenge[] | HomophoneChallenge[] = [];

    try {
        setLoadingMessage(useOffline ? "Loading offline dictionary..." : "Curating words with AI...");
        loadedWords = await loadData(useOffline);
    } catch (e) {
        console.warn("Primary data load failed", e);
        if (!useOffline) {
            setLoadingMessage("AI unavailable. Switching to Offline Mode...");
            updateSettings({ isOfflineMode: true }); 
            try {
                loadedWords = await loadData(true);
            } catch (offlineError) {
                console.error("Critical: Offline fallback also failed", offlineError);
                navigate('/arcade');
                return;
            }
        } else {
             navigate('/arcade');
             return;
        }
    }

    if (gameVariant === 'HOMOPHONE') {
        setHomophones(loadedWords as HomophoneChallenge[]);
    } else {
        setWords(loadedWords as WordChallenge[]);
    }

    if (gameVariant === 'SPEED') {
        setTimeLeft(60);
        setTimerActive(true);
    }

    setGameState(GameState.PLAYING);
      
    if (['CLASSIC', 'SPEED', 'WHISPER', 'REVERSE', 'ADVENTURE', 'BOSS', 'DAILY', 'SILENT_LETTER', 'MULTIPLAYER'].includes(gameVariant)) {
        setTimeout(() => {
           const firstItem = loadedWords[0] as any;
           if (firstItem.word) {
               playWord(firstItem.word, gameVariant === 'WHISPER');
           }
        }, 500);
    }
  };

  const startRemedialGame = async () => {
    GameAudio.playClick();
    const missedWords = score.history.filter(h => !h.isCorrect).map(h => h.word);
    if (missedWords.length === 0) return;

    setGameState(GameState.LOADING);
    setLoadingMessage("Analyzing mistakes...");
    setScore({ correct: 0, total: 0, history: [] });
    setCurrentIndex(0);
    setUserInput('');
    setFeedback('none');
    
    let useOffline = settings.isOfflineMode;

    const loadRemedialData = async (offline: boolean) => {
         if (gameVariant === 'HOMOPHONE') {
            return offline 
               ? await OfflineService.generateHomophones(difficulty, 5)
               : await generateRemedialHomophones(missedWords, 5);
         } else {
            return offline
               ? await OfflineService.generateRemedialWordList(missedWords, 5)
               : await generateRemedialWordList(missedWords, 5);
         }
    };

    try {
        const data = await loadRemedialData(useOffline);
        if (gameVariant === 'HOMOPHONE') {
            setHomophones(data as HomophoneChallenge[]);
        } else {
            setWords(data as WordChallenge[]);
            if (gameVariant !== 'MEMORY' && gameVariant !== 'SCRAMBLE' && gameVariant !== 'MISSING_LETTER') {
                setTimeout(() => playWord((data[0] as WordChallenge).word), 500);
            }
        }
        setGameState(GameState.PLAYING);
    } catch (e) {
        console.warn("Remedial generation failed", e);
        if (!useOffline) {
            updateSettings({ isOfflineMode: true });
            try {
                const data = await loadRemedialData(true);
                if (gameVariant === 'HOMOPHONE') {
                    setHomophones(data as HomophoneChallenge[]);
                } else {
                    setWords(data as WordChallenge[]);
                    if (gameVariant !== 'MEMORY' && gameVariant !== 'SCRAMBLE' && gameVariant !== 'MISSING_LETTER') {
                        setTimeout(() => playWord((data[0] as WordChallenge).word), 500);
                    }
                }
                setGameState(GameState.PLAYING);
            } catch (offlineErr) {
                setGameState(GameState.SUMMARY);
            }
        } else {
            setGameState(GameState.SUMMARY);
        }
    }
  };

  const startNewJourney = (theme: string) => {
      GameAudio.playClick();
      const newLevels: AdventureLevel[] = [
          { id: 'l1', name: `Beginner ${theme}`, difficulty: Difficulty.EASY, isUnlocked: true, isCompleted: false, theme },
          { id: 'l2', name: `${theme} Explorer`, difficulty: Difficulty.MEDIUM, isUnlocked: false, isCompleted: false, theme },
          { id: 'l3', name: `Master of ${theme}`, difficulty: Difficulty.HARD, isUnlocked: false, isCompleted: false, theme },
          { id: 'l4', name: `Legend of ${theme}`, difficulty: Difficulty.EXTREME, isUnlocked: false, isCompleted: false, theme }
      ];
      setAdventureLevels(newLevels);
      setJourneyTheme(theme);
      setCustomTopic(""); 
  };

  const resetJourney = () => {
      GameAudio.playClick();
      setAdventureLevels([]);
      setJourneyTheme("");
      localStorage.removeItem('spellbound_levels');
      localStorage.removeItem('spellbound_theme');
  };

  const handleLevelSelect = (levelId: string) => {
    GameAudio.playClick();
    const level = adventureLevels.find(l => l.id === levelId);
    if (level && level.isUnlocked) {
        initGame(level.difficulty);
    }
  };

  const handleSubmit = (overrideInput?: string) => {
    const inputToCheck = overrideInput !== undefined ? overrideInput : userInput;
    const targetWord = gameVariant === 'HOMOPHONE' ? homophones[currentIndex].correctWord : words[currentIndex].word;
    
    let isCorrect = false;
    if (gameVariant === 'HOMOPHONE') {
      isCorrect = inputToCheck.toLowerCase() === targetWord.toLowerCase();
    } else if (gameVariant === 'REVERSE') {
      isCorrect = inputToCheck.toLowerCase() === targetWord.toLowerCase().split('').reverse().join('');
    } else {
      isCorrect = inputToCheck.trim().toLowerCase() === targetWord.toLowerCase();
    }

    OfflineService.trackProgress(targetWord, isCorrect);
    
    if (isCorrect) {
        GameAudio.playCorrect();
    } else {
        GameAudio.playIncorrect();
        setInputAnimation('animate-shake');
        setTimeout(() => setInputAnimation(''), 500);
    }

    if (gameVariant === 'MULTIPLAYER') {
        const timeTaken = (Date.now() - mpStartTime) / 1000;
        if (mpPlayerTurn === 1) {
            setMpRoundStats(prev => ({
                ...prev,
                p1: { input: inputToCheck, time: timeTaken, correct: isCorrect }
            }));
            setUserInput('');
            setMpPlayerTurn(2);
            setMpStartTime(Date.now());
            setTimeout(() => playWord(targetWord), 200);
            return; 
        } else {
            const p2Stats = { input: inputToCheck, time: timeTaken, correct: isCorrect };
            const p1Stats = mpRoundStats.p1!;
            let winner: 'p1' | 'p2' | 'draw' = 'draw';
            if (p1Stats.correct && !p2Stats.correct) winner = 'p1';
            else if (!p1Stats.correct && p2Stats.correct) winner = 'p2';
            else if (p1Stats.correct && p2Stats.correct) {
                winner = p1Stats.time < p2Stats.time ? 'p1' : 'p2';
            }
            setMpRoundStats(prev => ({ ...prev, p2: p2Stats }));
            setMpWinner(winner);
            if (winner === 'p1') setMpScores(s => ({ ...s, p1: s.p1 + 1 }));
            if (winner === 'p2') setMpScores(s => ({ ...s, p2: s.p2 + 1 }));
            GameAudio.playWin();
            setFeedback('mp_result');
            return;
        }
    }

    setScore(prev => ({
      ...prev,
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
      history: [...prev.history, { word: targetWord, userSpelling: inputToCheck, isCorrect }]
    }));

    if (gameVariant === 'SPEED') {
      setUserInput('');
      if (currentIndex < words.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setTimeout(() => playWord(words[currentIndex + 1].word), 200);
      } else {
        setTimerActive(false);
        setGameState(GameState.SUMMARY);
        GameAudio.playWin();
      }
    } else {
      setFeedback(isCorrect ? 'correct' : 'incorrect');
    }
  };

  const nextWord = () => {
    GameAudio.playClick();
    const maxIndex = gameVariant === 'HOMOPHONE' ? homophones.length : words.length;
    
    if (currentIndex < maxIndex - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserInput('');
      setFeedback('none');
      setMpWinner(null);
      const nextW = words[currentIndex + 1]?.word;
      if (nextW && ['CLASSIC', 'SPEED', 'WHISPER', 'REVERSE', 'ADVENTURE', 'BOSS', 'DAILY', 'SILENT_LETTER', 'MULTIPLAYER'].includes(gameVariant)) {
        setTimeout(() => playWord(nextW, gameVariant === 'WHISPER'), 500);
      }
    } else {
      let unlocked = false;
      if (gameVariant === 'ADVENTURE' && score.correct >= Math.floor(score.total * 0.8)) {
          const currentLevelIdx = adventureLevels.findIndex(l => l.difficulty === difficulty);
          if (currentLevelIdx !== -1 && currentLevelIdx < adventureLevels.length - 1) {
              const newLevels = [...adventureLevels];
              newLevels[currentLevelIdx].isCompleted = true;
              newLevels[currentLevelIdx + 1].isUnlocked = true;
              setAdventureLevels(newLevels);
              unlocked = true;
              GameAudio.playLevelUp();
          }
      }
      if (!unlocked) GameAudio.playWin();
      setGameState(GameState.SUMMARY);
    }
  };

  // --- RENDERERS ---

  if (gameState === GameState.DIFFICULTY_SELECT) {
    return (
      <div className="flex flex-col items-center animate-fade-in pb-10 min-h-[60vh] justify-center">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Select Difficulty</h2>
          <p className="text-slate-500 dark:text-slate-400">Choose your challenge level</p>
        </div>
        <div className="grid grid-cols-2 gap-4 w-full max-w-lg px-4">
          <button onClick={() => initGame(Difficulty.EASY)} className="p-6 rounded-2xl bg-green-50 dark:bg-green-900/30 border-2 border-green-100 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 hover:border-green-200 hover:scale-[1.02] transition-all flex flex-col items-center gap-2">
            <Star size={32} /> <span className="font-bold text-lg">Easy</span>
          </button>
          <button onClick={() => initGame(Difficulty.MEDIUM)} className="p-6 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-200 hover:scale-[1.02] transition-all flex flex-col items-center gap-2">
            <Zap size={32} /> <span className="font-bold text-lg">Medium</span>
          </button>
          <button onClick={() => initGame(Difficulty.HARD)} className="p-6 rounded-2xl bg-orange-50 dark:bg-orange-900/30 border-2 border-orange-100 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 hover:border-orange-200 hover:scale-[1.02] transition-all flex flex-col items-center gap-2">
            <Target size={32} /> <span className="font-bold text-lg">Hard</span>
          </button>
          <button onClick={() => initGame(Difficulty.EXTREME)} className="p-6 rounded-2xl bg-red-50 dark:bg-red-900/30 border-2 border-red-100 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 hover:border-red-200 hover:scale-[1.02] transition-all flex flex-col items-center gap-2">
            <Skull size={32} /> <span className="font-bold text-lg">Extreme</span>
          </button>
        </div>
        <button onClick={() => navigate('/arcade')} className="mt-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium">Cancel</button>
      </div>
    );
  }

  if (gameState === GameState.ADVENTURE_MAP) {
      if (!journeyTheme || adventureLevels.length === 0) {
          return (
              <div className="flex flex-col items-center animate-fade-in w-full max-w-2xl mx-auto px-4">
                  <div className="flex w-full justify-start items-center mb-8">
                     <button onClick={() => navigate('/arcade')} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-bold flex gap-2"><RotateCcw/> Exit</button>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 w-full text-center">
                      <div className="w-20 h-20 bg-lime-100 dark:bg-lime-900/30 text-lime-600 dark:text-lime-400 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Compass size={40} />
                      </div>
                      <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Create Your Journey</h2>
                      <p className="text-slate-500 dark:text-slate-400 mb-8">
                        {settings.isOfflineMode 
                            ? "In Offline Mode, generic adventures are created based on difficulty." 
                            : "Enter a topic to generate a custom 4-level campaign."}
                      </p>

                      <input 
                        type="text" 
                        value={customTopic}
                        onChange={(e) => setCustomTopic(e.target.value)}
                        placeholder="e.g., Harry Potter, Ocean, Cooking..."
                        disabled={settings.isOfflineMode}
                        className="w-full text-center text-xl font-bold border-b-2 border-slate-200 dark:border-slate-600 py-3 mb-8 focus:outline-none focus:border-lime-500 bg-transparent text-slate-800 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      />

                      <div className="flex flex-wrap justify-center gap-3 mb-8">
                          {['Space', 'Forest', 'Magic', 'Dinosaurs', 'Ocean', 'Technology'].map(topic => (
                              <button 
                                key={topic} 
                                onClick={() => startNewJourney(topic)}
                                className="px-4 py-2 rounded-full bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-lime-50 dark:hover:bg-lime-900/30 hover:text-lime-700 dark:hover:text-lime-400 transition-colors border border-slate-200 dark:border-slate-600"
                              >
                                  {topic}
                              </button>
                          ))}
                      </div>

                      <button 
                        onClick={() => { if(customTopic || settings.isOfflineMode) startNewJourney(customTopic || "Classic"); }}
                        disabled={!customTopic && !settings.isOfflineMode}
                        className="w-full bg-lime-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-lime-200 dark:shadow-none hover:bg-lime-700 transition-all disabled:opacity-50 disabled:shadow-none"
                      >
                          Start Adventure
                      </button>
                  </div>
              </div>
          );
      }

      // MAP VIEW
      return (
          <div className="flex flex-col items-center animate-fade-in w-full max-w-4xl mx-auto">
              <div className="flex w-full justify-between items-center mb-8 px-4">
                  <button onClick={() => navigate('/arcade')} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-bold flex gap-2"><RotateCcw/> Exit Map</button>
                  <button onClick={resetJourney} className="text-lime-600 dark:text-lime-400 hover:text-lime-800 dark:hover:text-lime-300 font-bold flex gap-2 text-sm bg-lime-50 dark:bg-lime-900/20 px-3 py-1 rounded-lg"><Plus size={18}/> New Journey</button>
              </div>
              
              <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-slate-800 dark:text-white capitalize">{journeyTheme} Journey</h2>
                  <p className="text-slate-400 text-sm">Campaign Progress</p>
              </div>

              <div className="grid gap-6 w-full px-4 relative">
                  <div className="absolute left-1/2 top-10 bottom-10 w-1 bg-slate-200 dark:bg-slate-700 -translate-x-1/2 hidden md:block z-0 rounded-full"></div>

                  {adventureLevels.map((level, idx) => (
                      <button 
                        key={level.id}
                        disabled={!level.isUnlocked}
                        onClick={() => handleLevelSelect(level.id)}
                        className={`relative z-10 w-full p-6 md:p-8 rounded-3xl text-left transition-all group ${level.isUnlocked ? 'bg-white dark:bg-slate-800 shadow-lg hover:scale-[1.02] cursor-pointer' : 'bg-slate-50 dark:bg-slate-900 opacity-80 cursor-not-allowed'} border-2 ${level.isCompleted ? 'border-lime-400' : 'border-slate-100 dark:border-slate-700'}`}
                      >
                          <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                  <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center shrink-0 ${level.isUnlocked ? 'bg-lime-100 dark:bg-lime-900/30 text-lime-600 dark:text-lime-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600'}`}>
                                      {level.isCompleted ? <Check size={24}/> : level.isUnlocked ? <Play size={24}/> : <Timer size={24}/>}
                                  </div>
                                  <div>
                                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Level {idx + 1}</div>
                                      <h3 className={`text-lg md:text-2xl font-bold ${level.isUnlocked ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>{level.name}</h3>
                                      <p className="text-slate-500 dark:text-slate-500 text-sm">{level.difficulty} Difficulty</p>
                                  </div>
                              </div>
                              
                              {level.isUnlocked && !level.isCompleted && (
                                  <ArrowRight className="text-lime-500 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-2" />
                              )}
                          </div>
                      </button>
                  ))}
              </div>
          </div>
      );
  }

  if (gameState === GameState.LOADING) {
    return <GameSkeleton />;
  }

  // --- SUMMARY SCREEN ---
  if (gameState === GameState.SUMMARY) {
    const isMP = gameVariant === 'MULTIPLAYER';
    const hasMistakes = score.history.some(h => !h.isCorrect);

    return (
      <div className="w-full max-w-2xl mx-auto p-6 animate-fade-in-up">
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-700 text-center mb-8 transition-colors">
          <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center mx-auto mb-6 animate-pop">
            <Trophy size={40} />
          </div>
          
          {isMP ? (
             <>
               <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Battle Finished!</h2>
               <div className="flex justify-center gap-8 my-6">
                 <div className="text-center">
                    <div className="text-sm text-slate-400 uppercase font-bold">Player 1</div>
                    <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">{mpScores.p1}</div>
                    <div className="text-xs text-slate-400">Wins</div>
                 </div>
                 <div className="text-center">
                    <div className="text-sm text-slate-400 uppercase font-bold">Player 2</div>
                    <div className="text-4xl font-bold text-pink-600 dark:text-pink-400">{mpScores.p2}</div>
                    <div className="text-xs text-slate-400">Wins</div>
                 </div>
               </div>
               <p className="text-xl font-bold text-slate-800 dark:text-white mb-6">
                 {mpScores.p1 > mpScores.p2 ? "Player 1 Wins!" : mpScores.p2 > mpScores.p1 ? "Player 2 Wins!" : "It's a Draw!"}
               </p>
             </>
          ) : (
             <>
               <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">
                 {gameVariant === 'BOSS' && score.correct === score.total ? "BOSS DEFEATED!" : "Challenge Complete!"}
               </h2>
               <p className="text-slate-500 dark:text-slate-400 mb-6">You scored {score.correct} out of {score.total}</p>
             </>
          )}

          {!isMP && (
             <div className="space-y-3 mb-8 text-left max-h-[400px] overflow-y-auto pr-2">
               {score.history.map((item, idx) => (
                 <div key={idx} className={`p-4 rounded-xl flex items-center justify-between border ${item.isCorrect ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'}`}>
                   <div>
                     <span className="font-bold text-slate-700 dark:text-slate-200 block">{item.word}</span>
                     {!item.isCorrect && <span className="text-sm text-red-500 dark:text-red-400">You wrote: {item.userSpelling}</span>}
                   </div>
                   {item.isCorrect ? <CheckIcon /> : <AlertIcon />}
                 </div>
               ))}
             </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
             {gameVariant === 'ADVENTURE' && (
                 <>
                  <button onClick={() => setGameState(GameState.ADVENTURE_MAP)} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-lime-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-lime-700 transition-colors shadow-lg shadow-lime-200 dark:shadow-none">
                      <MapIcon size={20} /> Return to Map
                  </button>
                  {score.correct >= Math.floor(score.total * 0.8) && (
                      <div className="w-full text-center text-green-600 dark:text-green-400 font-bold animate-bounce mt-2">Level Unlocked!</div>
                  )}
                 </>
             )}

             {hasMistakes && !isMP && (
              <button onClick={startRemedialGame} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500 text-white px-8 py-3 rounded-full font-semibold hover:bg-amber-600 transition-colors shadow-lg shadow-amber-200 dark:shadow-none">
                <Sparkles size={20} /> Practice Mistakes
              </button>
            )}

            <button onClick={() => initGame(difficulty)} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 dark:shadow-none">
              <RotateCcw size={20} /> Play Again
            </button>
            
            <button onClick={() => navigate('/arcade')} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200 dark:shadow-none">
              <Home size={20} /> Arcade Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- GAMEPLAY UI ---

  const isHomophone = gameVariant === 'HOMOPHONE';
  const currentChallenge = isHomophone ? homophones[currentIndex] : words[currentIndex];
  
  if (!currentChallenge) return null;

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 animate-fade-in relative">
      <div className="absolute top-4 left-4 md:left-0 z-10">
        <button onClick={() => navigate('/arcade')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-medium">Quit</button>
      </div>

      {gameVariant === 'SPEED' && (
        <div className="absolute top-4 right-4 md:right-0 flex items-center gap-2 text-amber-600 dark:text-amber-500 font-bold text-xl z-10">
           <Timer size={24} /> <span>{timeLeft}s</span>
        </div>
      )}

      {gameVariant !== 'SPEED' && (
        <WavyProgressBar 
            progress={((currentIndex) / (isHomophone ? homophones.length : words.length)) * 100} 
            glow={feedback === 'correct'}
        />
      )}
      
      <div className={`bg-white dark:bg-slate-800 rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 p-8 border border-slate-100 dark:border-slate-700 mt-10 relative overflow-hidden transition-all duration-300 ${feedback === 'correct' ? 'border-green-200 dark:border-green-800 shadow-green-100 dark:shadow-none' : ''}`}>
        {gameVariant === 'BOSS' && <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>}
        
        <div className="text-center mb-8">
          
          {/* HEADER & AUDIO */}
          {(gameVariant === 'CLASSIC' || gameVariant === 'SPEED' || gameVariant === 'WHISPER' || gameVariant === 'BOSS' || gameVariant === 'REVERSE' || gameVariant === 'DAILY' || gameVariant === 'SILENT_LETTER' || gameVariant === 'ADVENTURE' || gameVariant === 'MISSING_LETTER' || gameVariant === 'MULTIPLAYER') && (
            <>
              {gameVariant === 'ADVENTURE' && <div className="text-xs font-bold text-lime-600 dark:text-lime-400 uppercase mb-4">{(currentChallenge as WordChallenge).definition.slice(0,30)}...</div>}
              {gameVariant === 'BOSS' && <div className="text-xs font-bold text-red-600 uppercase mb-4 tracking-widest animate-pulse">BOSS BATTLE</div>}
              {gameVariant === 'DAILY' && <div className="text-xs font-bold text-orange-600 uppercase mb-4">{new Date().toDateString()}</div>}
              
              <div className="flex justify-center gap-4 mb-6">
                <button 
                  onClick={() => playWord((currentChallenge as WordChallenge).word, gameVariant === 'WHISPER')}
                  disabled={isPlayingAudio}
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                    isPlayingAudio 
                      ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 scale-110' 
                      : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg hover:shadow-primary-500/30'
                  }`}
                >
                  {gameVariant === 'WHISPER' ? <VolumeX size={32}/> : <Volume2 size={32} />}
                </button>
              </div>
              <p className="text-sm text-slate-400 mb-6">{gameVariant === 'WHISPER' ? "Listen carefully..." : "Tap to listen"}</p>
            </>
          )}

          {/* SCRAMBLE UI */}
          {gameVariant === 'SCRAMBLE' && (
             <div className="mb-8">
                <p className="text-sm text-slate-400 mb-4 uppercase tracking-wider">Unscramble This</p>
                <div className="flex justify-center gap-2 flex-wrap">
                  {scrambledWord.split('').map((char, i) => (
                    <div key={i} className="w-12 h-14 bg-purple-50 dark:bg-purple-900/30 border-b-4 border-purple-200 dark:border-purple-800 rounded-lg flex items-center justify-center text-2xl font-bold text-purple-700 dark:text-purple-300 animate-pop" style={{ animationDelay: `${i * 0.05}s` }}>{char}</div>
                  ))}
                </div>
                <button onClick={() => playWord((currentChallenge as WordChallenge).word)} className="text-xs text-primary-500 mt-4 hover:underline">Hear Word</button>
             </div>
          )}

          {/* MISSING LETTER UI */}
          {gameVariant === 'MISSING_LETTER' && (
             <div className="mb-8">
                <p className="text-sm text-slate-400 mb-4 uppercase tracking-wider">Complete the word</p>
                <div className="text-3xl md:text-4xl font-mono font-bold tracking-widest break-all text-center text-slate-800 dark:text-white uppercase">{maskedWord}</div>
             </div>
          )}

          {/* MEMORY UI */}
          {gameVariant === 'MEMORY' && (
             <div className="mb-8 h-24 flex items-center justify-center">
                {memoryVisible ? (
                    <div className="text-4xl font-bold text-slate-800 dark:text-white animate-pulse">{(currentChallenge as WordChallenge).word}</div>
                ) : (
                    <div className="text-slate-400 italic">Type from memory...</div>
                )}
             </div>
          )}

          {/* SENTENCE SPELL UI */}
          {gameVariant === 'SENTENCE_SPELL' && (
              <div className="mb-8">
                  <p className="text-lg text-slate-700 dark:text-slate-200">{(currentChallenge as WordChallenge).exampleSentence.replace(new RegExp(`\\b${(currentChallenge as WordChallenge).word}\\b`, 'gi'), '_______')}</p>
                  <p className="text-xs text-slate-400 mt-4">Type the missing word</p>
                  <button onClick={() => playWord((currentChallenge as WordChallenge).exampleSentence)} className="text-xs text-primary-500 mt-2 hover:underline">Hear Sentence</button>
              </div>
          )}

          {/* HOMOPHONE UI */}
          {gameVariant === 'HOMOPHONE' && (
             <div className="mb-8">
               <div className="text-xl font-medium text-slate-700 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">{(currentChallenge as HomophoneChallenge).sentence}</div>
               <p className="text-sm text-slate-400 mt-2">Definition: {(currentChallenge as HomophoneChallenge).definition}</p>
             </div>
          )}

           {/* MULTIPLAYER UI */}
           {gameVariant === 'MULTIPLAYER' && (
             <div className="mb-8">
                 <div className="flex justify-center items-center gap-4 mb-4">
                     <div className={`px-4 py-2 rounded-full transition-all ${mpPlayerTurn === 1 ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 opacity-50'}`}>Player 1</div>
                     <div className="text-slate-300 font-bold">VS</div>
                     <div className={`px-4 py-2 rounded-full transition-all ${mpPlayerTurn === 2 ? 'bg-pink-600 text-white shadow-lg shadow-pink-200 dark:shadow-none' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 opacity-50'}`}>Player 2</div>
                 </div>
                 <div className="text-center text-sm font-medium text-slate-500">
                     {mpPlayerTurn === 1 ? "Player 1: Listen and type!" : "Player 2: Your turn!"}
                 </div>
             </div>
          )}

          {/* INPUT AREA */}

          {(feedback === 'none' || (gameVariant === 'MULTIPLAYER' && feedback !== 'mp_result')) && !memoryVisible ? (
            <div className={`space-y-4 ${inputAnimation}`}>
              {gameVariant === 'HOMOPHONE' ? (
                 <div className="grid grid-cols-2 gap-4">
                    {(currentChallenge as HomophoneChallenge).options.map((opt) => (
                      <button key={opt} onClick={() => handleSubmit(opt)} className="p-4 rounded-xl border-2 border-slate-100 dark:border-slate-700 font-bold text-lg text-slate-700 dark:text-slate-200 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all">{opt}</button>
                    ))}
                 </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && userInput && handleSubmit()}
                    placeholder={gameVariant === 'REVERSE' ? "Type backwards..." : gameVariant === 'SCRAMBLE' ? "Unscramble..." : "Type the word..."}
                    autoComplete="off"
                    autoCorrect="off"
                    className="w-full text-center text-3xl font-bold border-b-2 border-slate-200 dark:border-slate-700 py-2 focus:outline-none focus:border-primary-500 bg-transparent text-slate-800 dark:text-white placeholder-slate-300 dark:placeholder-slate-600"
                    autoFocus
                  />
                  <button onClick={() => handleSubmit()} disabled={!userInput} className="w-full bg-slate-900 dark:bg-slate-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50 hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors">
                    {gameVariant === 'MULTIPLAYER' ? (mpPlayerTurn === 1 ? 'Next Player' : 'Finish Round') : 'Check Answer'}
                  </button>
                </>
              )}
            </div>
          ) : feedback === 'mp_result' ? (
              // MULTIPLAYER RESULTS SCREEN
              <div className="animate-fade-in-up">
                  <div className="mb-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border border-slate-100 dark:border-slate-700">
                      <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Round Result</div>
                      
                      <div className="flex justify-between items-center mb-2">
                          <span className={`font-bold ${mpWinner === 'p1' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>Player 1</span>
                          <div className="text-right">
                              <div className={mpRoundStats.p1?.correct ? 'text-green-500' : 'text-red-500'}>{mpRoundStats.p1?.correct ? 'Correct' : 'Wrong'}</div>
                              <div className="text-xs text-slate-400">{mpRoundStats.p1?.time.toFixed(2)}s</div>
                          </div>
                      </div>
                      
                      <div className="w-full h-px bg-slate-200 dark:bg-slate-700 my-2"></div>

                      <div className="flex justify-between items-center">
                          <span className={`font-bold ${mpWinner === 'p2' ? 'text-pink-600 dark:text-pink-400' : 'text-slate-400'}`}>Player 2</span>
                          <div className="text-right">
                              <div className={mpRoundStats.p2?.correct ? 'text-green-500' : 'text-red-500'}>{mpRoundStats.p2?.correct ? 'Correct' : 'Wrong'}</div>
                              <div className="text-xs text-slate-400">{mpRoundStats.p2?.time.toFixed(2)}s</div>
                          </div>
                      </div>

                      <div className="mt-6 text-xl font-bold text-center">
                          {mpWinner === 'p1' ? <span className="text-blue-600 dark:text-blue-400">Player 1 Wins Point!</span> : 
                           mpWinner === 'p2' ? <span className="text-pink-600 dark:text-pink-400">Player 2 Wins Point!</span> : 
                           <span className="text-slate-500">Draw!</span>}
                      </div>
                  </div>
                   <button onClick={nextWord} className="w-full inline-flex justify-center items-center gap-2 bg-slate-900 dark:bg-slate-700 text-white px-8 py-3 rounded-full font-semibold hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors shadow-lg">
                    Next Round <ArrowRight size={20} />
                  </button>
              </div>
          ) : feedback !== 'none' ? (
            <div className="animate-pop relative">
              <div className={`text-2xl font-bold mb-2 ${feedback === 'correct' ? 'text-green-500' : 'text-red-500'}`}>
                {feedback === 'correct' ? 'Correct!' : 'Incorrect'}
              </div>
              <div className="text-slate-500 dark:text-slate-400 mb-6 text-lg">
                The answer was <span className="font-bold text-slate-800 dark:text-white capitalize">
                  {isHomophone ? (currentChallenge as HomophoneChallenge).correctWord.toLowerCase() : (currentChallenge as WordChallenge).word.toLowerCase()}
                </span>
                {gameVariant === 'REVERSE' && <div className="text-sm mt-1 text-rose-500">(Reverse: {(currentChallenge as WordChallenge).word.split('').reverse().join('')})</div>}
              </div>
              <button onClick={nextWord} className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-primary-700 transition-colors shadow-lg hover:shadow-primary-500/30">
                Next Challenge <ArrowRight size={20} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const CheckIcon = () => <div className="p-1 bg-green-100 dark:bg-green-900/50 rounded-full text-green-600 dark:text-green-400"><Check size={16} /></div>;
const AlertIcon = () => <div className="p-1 bg-red-100 dark:bg-red-900/50 rounded-full text-red-600 dark:text-red-400"><AlertCircle size={16} /></div>;

const GameSkeleton = () => {
  const trackWave = getWaveSvg('#cbd5e1'); 
  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 animate-pulse">
       <div className="w-full h-3 mb-8 relative opacity-50">
           <div 
             className="absolute inset-0 w-full h-full bg-repeat-x" 
             style={{ backgroundImage: `url("${trackWave}")`, backgroundSize: '40px 12px' }} 
           />
       </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-700 shadow-sm mt-10">
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 bg-slate-200 dark:bg-slate-700 rounded-full" />
        </div>
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mx-auto mb-6" />
        <div className="space-y-4">
          <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl w-full" />
          <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl w-full" />
        </div>
      </div>
    </div>
  );
};

export default GameMode;