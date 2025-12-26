
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Play, Volume2, ArrowRight, Trophy, AlertCircle, RotateCcw, 
  Sparkles, Timer, Shuffle, Split, Keyboard, Clock, Check, EyeOff, 
  Map as MapIcon, Skull, Calendar, Users, Dices, VolumeX, RefreshCcw, Brain, Zap, Target, Home, Swords, Plane, Compass, Plus, Star, WifiOff, Mic
} from 'lucide-react';
import { WordChallenge, HomophoneChallenge, Difficulty, GameState, ScoreData, GameVariant, AdventureLevel, AppSettings } from '../types';
import { generateWordList, generateRemedialWordList, generateHomophones, generateRemedialHomophones, generateDailyWord } from '../services/geminiService';
import { OfflineService } from '../services/offlineService';
import { GameAudio } from '../services/audioUtils';
import LiveCoachMode from './LiveCoachMode';

interface Props {
  onBack: () => void;
  settings: AppSettings;
  setHeaderConfig: (config: { title: string | null; color: string }) => void;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
}

// Helper to generate Wave SVG Data URI
const getWaveSvg = (color: string) => 
  `data:image/svg+xml,%3Csvg width='40' height='12' viewBox='0 0 40 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 6 Q 10 1 20 6 T 40 6' stroke='${encodeURIComponent(color)}' fill='none' stroke-width='4' stroke-linecap='round' stroke-linejoin='round' /%3E%3C/svg%3E`;

const WavyProgressBar = ({ progress, glow }: { progress: number; glow?: boolean }) => {
  const trackWave = getWaveSvg('#94a3b8'); // Slate-400 for better visibility in dark/light
  const progressWave = getWaveSvg('#0ea5e9'); // Primary-500

  return (
    <div className="w-full h-3 mb-8 mt-8 md:mt-0 relative">
      {/* Background Track */}
      <div 
        className="absolute inset-0 w-full h-full bg-repeat-x bg-left-center opacity-30 dark:opacity-20"
        style={{ backgroundImage: `url("${trackWave}")`, backgroundSize: '40px 12px' }}
      />
      
      {/* Progress Fill - Clipped by width */}
      <div 
        className="absolute inset-0 h-full bg-repeat-x bg-left-center transition-all duration-500 ease-out"
        style={{ 
          width: `${Math.max(5, progress)}%`, // Min width to show the cap
          backgroundImage: `url("${progressWave}")`, 
          backgroundSize: '40px 12px',
          overflow: 'hidden',
          borderRight: '1px solid transparent', // Fix for some render artifacts
          filter: glow ? 'drop-shadow(0 0 6px #38bdf8)' : 'none', // Glow effect
          transition: 'filter 0.3s ease'
        }}
      />
    </div>
  );
};

const GAME_TITLES: Record<GameVariant, string> = {
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

const GAME_COLORS: Record<GameVariant, string> = {
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

const GameMode: React.FC<Props> = ({ onBack, settings, setHeaderConfig, updateSettings }) => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [gameVariant, setGameVariant] = useState<GameVariant>('CLASSIC');
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
  const [inputAnimation, setInputAnimation] = useState(''); // 'animate-shake' etc.
  
  // Timer State (Speed Mode)
  const [timeLeft, setTimeLeft] = useState(60);
  const [timerActive, setTimerActive] = useState(false);

  // Special Mode States
  const [scrambledWord, setScrambledWord] = useState('');
  const [maskedWord, setMaskedWord] = useState(''); // For Missing Letter
  const [memoryVisible, setMemoryVisible] = useState(false); // For Memory Mode
  
  // Multiplayer State (Local 1v1)
  const [mpPlayerTurn, setMpPlayerTurn] = useState<1 | 2>(1);
  const [mpScores, setMpScores] = useState({ p1: 0, p2: 0 });
  const [mpRoundStats, setMpRoundStats] = useState<{
      p1?: { input: string; time: number; correct: boolean };
      p2?: { input: string; time: number; correct: boolean };
  }>({});
  const [mpStartTime, setMpStartTime] = useState(0);
  const [mpWinner, setMpWinner] = useState<'p1' | 'p2' | 'draw' | null>(null);

  // Wheel State
  const [isSpinning, setIsSpinning] = useState(false);

  // Adventure State
  const [adventureLevels, setAdventureLevels] = useState<AdventureLevel[]>([]);
  const [journeyTheme, setJourneyTheme] = useState<string>("");
  const [customTopic, setCustomTopic] = useState("");

  // Update Header Configuration
  useEffect(() => {
    if (gameState === GameState.MENU) {
      setHeaderConfig({ title: "Game Arcade", color: "primary" });
    } else {
      setHeaderConfig({ 
          title: GAME_TITLES[gameVariant], 
          color: GAME_COLORS[gameVariant] 
      });
    }
    
    // Cleanup on unmount
    return () => setHeaderConfig({ title: null, color: "primary" });
  }, [gameState, gameVariant, setHeaderConfig]);

  // Load Adventure Data from LocalStorage
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

  // Load voices
  useEffect(() => {
    const updateVoices = () => {
      const vs = window.speechSynthesis.getVoices();
      setVoices(vs);
    };
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
          if (t <= 5 && t > 0) GameAudio.playTick(); // Tick sound last 5 seconds
          if (t <= 1) {
            setTimerActive(false);
            setGameState(GameState.SUMMARY);
            GameAudio.playWin(); // End sound
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
      // Hide ~30% of letters, minimum 1
      const chars = w.split('');
      const indicesToHide = new Set<number>();
      const numToHide = Math.max(1, Math.floor(chars.length * 0.4));
      while(indicesToHide.size < numToHide) {
        indicesToHide.add(Math.floor(Math.random() * chars.length));
      }
      setMaskedWord(chars.map((c, i) => indicesToHide.has(i) ? '_' : c).join(''));
    } else if (gameVariant === 'MEMORY') {
      setMemoryVisible(true);
      setTimeout(() => setMemoryVisible(false), 2000); // Hide after 2 seconds
    } else if (gameVariant === 'MULTIPLAYER') {
        // Reset multiplayer round
        setMpPlayerTurn(1);
        setMpRoundStats({});
        setMpStartTime(Date.now());
        setMpWinner(null);
    }

  }, [currentIndex, words, gameVariant]);

  const handleGameSelect = (variant: GameVariant) => {
    GameAudio.playClick();
    
    // Modes that require difficulty selection
    const needsDifficulty = [
      'CLASSIC', 'SPEED', 'MISSING_LETTER', 'SCRAMBLE', 
      'SENTENCE_SPELL', 'WHISPER', 'SILENT_LETTER', 
      'REVERSE', 'MEMORY', 'MULTIPLAYER', 'HOMOPHONE',
      'BOSS', 'DAILY'
    ];

    setGameVariant(variant);

    if (needsDifficulty.includes(variant)) {
      setGameState(GameState.DIFFICULTY_SELECT);
    } else {
      initGame(variant, Difficulty.MEDIUM); 
    }
  };

  const playWord = useCallback((text: string, isWhisper = false) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Voice Selection Logic
    const targetLang = settings.voiceAccent === 'GB' ? 'en-GB' : 'en-US';
    
    // Filter by exact language match or partial match (some systems use underscores)
    const matchingVoices = voices.filter(v => v.lang === targetLang || v.lang.replace('_', '-').includes(targetLang));
    
    // Try to find a good voice
    let selectedVoice = matchingVoices.find(v => v.name.includes("Google") || v.name.includes("Siri") || v.name.includes("Microsoft"));
    
    if (!selectedVoice && matchingVoices.length > 0) {
        selectedVoice = matchingVoices[0];
    }
    
    // Fallback if requested accent isn't found at all
    if (!selectedVoice) {
         // Fallback to any English voice
         selectedVoice = voices.find(v => v.lang.startsWith('en'));
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = targetLang;
    }

    if (isWhisper) {
        utterance.volume = 0.3 * settings.ttsVolume; // Scale by setting
        utterance.pitch = 1.0; 
        utterance.rate = 0.6;
    } else {
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0 * settings.ttsVolume; // Scale by setting
    }
    
    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
  }, [voices, settings.ttsVolume, settings.voiceAccent]);

  // Robust Game Initialization with Auto-Fallback
  const initGame = async (variant: GameVariant, selectedDifficulty: Difficulty) => {
    GameAudio.playClick();
    setGameVariant(variant);
    setDifficulty(selectedDifficulty);
    setGameState(GameState.LOADING);
    setScore({ correct: 0, total: 0, history: [] });
    setCurrentIndex(0);
    setUserInput('');
    setFeedback('none');
    
    // Multiplayer Reset
    setMpScores({ p1: 0, p2: 0 });
    setMpRoundStats({});
    setMpWinner(null);
    
    // Determine initial mode based on settings
    let useOffline = settings.isOfflineMode;

    // Helper to fetch data based on current mode preference
    const loadData = async (offline: boolean) => {
        const count = (variant === 'SPEED' || variant === 'BOSS') ? 15 : 5;
        
        if (offline) {
             if (variant === 'HOMOPHONE') return await OfflineService.generateHomophones(selectedDifficulty, 5);
             if (variant === 'DAILY') return await OfflineService.generateDailyWord(selectedDifficulty);
             if (variant === 'BOSS') return await OfflineService.generateWordList(Difficulty.EXTREME, 10);
             // Note: Offline service might not support context 'SILENT_LETTER' perfectly, but it returns words
             return await OfflineService.generateWordList(selectedDifficulty, count);
        } else {
             if (variant === 'HOMOPHONE') return await generateHomophones(selectedDifficulty, 5);
             if (variant === 'DAILY') return await generateDailyWord(selectedDifficulty);
             if (variant === 'BOSS') return await generateWordList(selectedDifficulty, 10, 'BOSS');
             if (variant === 'SILENT_LETTER') return await generateWordList(selectedDifficulty, 5, 'SILENT_LETTER');
             return await generateWordList(selectedDifficulty, count, variant === 'ADVENTURE' ? journeyTheme : undefined);
        }
    };

    let loadedWords: WordChallenge[] | HomophoneChallenge[] = [];

    try {
        setLoadingMessage(useOffline ? "Loading offline dictionary..." : "Curating words with AI...");
        loadedWords = await loadData(useOffline);
    } catch (e) {
        console.warn("Primary data load failed", e);
        
        // --- FALLBACK LOGIC ---
        // If we were trying Online and it failed, switch to Offline automatically
        if (!useOffline) {
            setLoadingMessage("AI unavailable. Switching to Offline Mode...");
            updateSettings({ isOfflineMode: true }); // Persist the switch so subsequent games use offline immediately
            
            try {
                // Retry immediately with offline service
                loadedWords = await loadData(true);
            } catch (offlineError) {
                console.error("Critical: Offline fallback also failed", offlineError);
                setGameState(GameState.MENU);
                return;
            }
        } else {
             // If we were already offline and it failed, we can't do much
             setGameState(GameState.MENU);
             return;
        }
    }

    // Apply Loaded Data
    if (variant === 'HOMOPHONE') {
        setHomophones(loadedWords as HomophoneChallenge[]);
    } else {
        setWords(loadedWords as WordChallenge[]);
    }

    if (variant === 'SPEED') {
        setTimeLeft(60);
        setTimerActive(true);
    }

    setGameState(GameState.PLAYING);
      
    // Auto-play audio logic
    if (['CLASSIC', 'SPEED', 'WHISPER', 'REVERSE', 'ADVENTURE', 'BOSS', 'DAILY', 'SILENT_LETTER', 'MULTIPLAYER'].includes(variant)) {
        setTimeout(() => {
           if (loadedWords.length > 0) {
             // Cast to any to safely access 'word' property if it exists
             const firstItem = loadedWords[0] as any;
             if (firstItem.word) {
                 playWord(firstItem.word, variant === 'WHISPER');
             }
           }
        }, 500);
    }
  };

  // Robust Remedial Game with Auto-Fallback
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
        
        // --- FALLBACK LOGIC ---
        if (!useOffline) {
            setLoadingMessage("AI unavailable. Switching to Offline Mode...");
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

  const spinWheel = () => {
    GameAudio.playClick();
    setGameState(GameState.WHEEL_SPIN);
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
        initGame(random, Difficulty.MEDIUM);
    }, 3000);
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
      setCustomTopic(""); // Clear input
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
        initGame('ADVENTURE', level.difficulty);
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

    // --- PROGRESS TRACKING (SRS) ---
    // Record result in offline service regardless of mode to build mastery data
    OfflineService.trackProgress(targetWord, isCorrect);
    
    // SFX and Animation Trigger
    if (isCorrect) {
        GameAudio.playCorrect();
    } else {
        GameAudio.playIncorrect();
        // Trigger shake animation
        setInputAnimation('animate-shake');
        setTimeout(() => setInputAnimation(''), 500);
    }

    // --- MULTIPLAYER LOGIC ---
    if (gameVariant === 'MULTIPLAYER') {
        const timeTaken = (Date.now() - mpStartTime) / 1000;
        
        if (mpPlayerTurn === 1) {
            // End P1 Turn
            setMpRoundStats(prev => ({
                ...prev,
                p1: { input: inputToCheck, time: timeTaken, correct: isCorrect }
            }));
            setUserInput('');
            setMpPlayerTurn(2);
            setMpStartTime(Date.now());
            // Play audio again for P2
            setTimeout(() => playWord(targetWord), 200);
            return; 
        } else {
            // End P2 Turn
            const p2Stats = { input: inputToCheck, time: timeTaken, correct: isCorrect };
            const p1Stats = mpRoundStats.p1!;
            
            // Determine Winner
            let winner: 'p1' | 'p2' | 'draw' = 'draw';
            if (p1Stats.correct && !p2Stats.correct) winner = 'p1';
            else if (!p1Stats.correct && p2Stats.correct) winner = 'p2';
            else if (p1Stats.correct && p2Stats.correct) {
                // Both correct, fastest wins
                winner = p1Stats.time < p2Stats.time ? 'p1' : 'p2';
            }
            // If both wrong, draw

            setMpRoundStats(prev => ({ ...prev, p2: p2Stats }));
            setMpWinner(winner);

            if (winner === 'p1') setMpScores(s => ({ ...s, p1: s.p1 + 1 }));
            if (winner === 'p2') setMpScores(s => ({ ...s, p2: s.p2 + 1 }));
            
            GameAudio.playWin();
            setFeedback('mp_result');
            return;
        }
    }

    // --- STANDARD LOGIC ---
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
      // End of Game Checks
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

  if (gameState === GameState.MENU) {
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
            onClick={() => {
                setGameVariant('ADVENTURE');
                setGameState(GameState.ADVENTURE_MAP);
            }} 
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
  }

  // --- SPECIAL STATES ---

  if (gameState === GameState.DIFFICULTY_SELECT) {
    return (
      <div className="flex flex-col items-center animate-fade-in pb-10 min-h-[60vh] justify-center">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Select Difficulty</h2>
          <p className="text-slate-500 dark:text-slate-400">Choose your challenge level</p>
        </div>
        <div className="grid grid-cols-2 gap-4 w-full max-w-lg px-4">
          <button onClick={() => initGame(gameVariant, Difficulty.EASY)} className="p-6 rounded-2xl bg-green-50 dark:bg-green-900/30 border-2 border-green-100 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 hover:border-green-200 hover:scale-[1.02] transition-all flex flex-col items-center gap-2">
            <Star size={32} /> <span className="font-bold text-lg">Easy</span>
          </button>
          <button onClick={() => initGame(gameVariant, Difficulty.MEDIUM)} className="p-6 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-200 hover:scale-[1.02] transition-all flex flex-col items-center gap-2">
            <Zap size={32} /> <span className="font-bold text-lg">Medium</span>
          </button>
          <button onClick={() => initGame(gameVariant, Difficulty.HARD)} className="p-6 rounded-2xl bg-orange-50 dark:bg-orange-900/30 border-2 border-orange-100 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 hover:border-orange-200 hover:scale-[1.02] transition-all flex flex-col items-center gap-2">
            <Target size={32} /> <span className="font-bold text-lg">Hard</span>
          </button>
          <button onClick={() => initGame(gameVariant, Difficulty.EXTREME)} className="p-6 rounded-2xl bg-red-50 dark:bg-red-900/30 border-2 border-red-100 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 hover:border-red-200 hover:scale-[1.02] transition-all flex flex-col items-center gap-2">
            <Skull size={32} /> <span className="font-bold text-lg">Extreme</span>
          </button>
        </div>
        <button onClick={() => setGameState(GameState.MENU)} className="mt-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium">Cancel</button>
      </div>
    );
  }

  // ... (Rest of component renders are identical to previous, just ensuring logic update)
  
  if (gameState === GameState.WHEEL_SPIN) {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh]">
            <div className={`w-64 h-64 rounded-full border-8 border-primary-500 border-dashed ${isSpinning ? 'animate-spin' : ''} flex items-center justify-center bg-white dark:bg-slate-800 shadow-xl`}>
                <Dices size={64} className="text-primary-500"/>
            </div>
            <h2 className="mt-8 text-2xl font-bold text-slate-800 dark:text-white animate-pulse">Spinning...</h2>
        </div>
    );
  }

  if (gameState === GameState.ADVENTURE_MAP) {
      if (!journeyTheme || adventureLevels.length === 0) {
          return (
              <div className="flex flex-col items-center animate-fade-in w-full max-w-2xl mx-auto px-4">
                  <div className="flex w-full justify-start items-center mb-8">
                     <button onClick={() => setGameState(GameState.MENU)} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-bold flex gap-2"><RotateCcw/> Exit</button>
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
                  <button onClick={() => setGameState(GameState.MENU)} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-bold flex gap-2"><RotateCcw/> Exit Map</button>
                  <button onClick={resetJourney} className="text-lime-600 dark:text-lime-400 hover:text-lime-800 dark:hover:text-lime-300 font-bold flex gap-2 text-sm bg-lime-50 dark:bg-lime-900/20 px-3 py-1 rounded-lg"><Plus size={18}/> New Journey</button>
              </div>
              
              <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold text-slate-800 dark:text-white capitalize">{journeyTheme} Journey</h2>
                  <p className="text-slate-400 text-sm">Campaign Progress</p>
              </div>

              <div className="grid gap-6 w-full px-4 relative">
                  {/* Connector Line */}
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
             {/* Special Adventure Navigation */}
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

            <button onClick={() => initGame(gameVariant, difficulty)} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 dark:shadow-none">
              <RotateCcw size={20} /> Play Again
            </button>
            
            <button onClick={() => setGameState(GameState.MENU)} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200 dark:shadow-none">
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
        <button onClick={() => setGameState(GameState.SUMMARY)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-medium">Quit</button>
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

        {/* MISSING LETTER UI */}
          {gameVariant === 'MISSING_LETTER' && (
             <div className="mb-8 w-full px-2">
                <p className="text-sm text-slate-400 mb-4 uppercase tracking-wider">Complete the word</p>
                {/* Fixed: Added break-all, responsive text size, and responsive tracking */}
                <div className="text-2xl sm:text-3xl md:text-4xl font-mono font-bold tracking-widest md:tracking-[0.2em] text-slate-800 dark:text-white uppercase break-all">
                  {maskedWord}
                </div>
             </div>
          )}  {/* HOMOPHONE UI */}
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

// Helper components
const CheckIcon = () => <div className="p-1 bg-green-100 dark:bg-green-900/50 rounded-full text-green-600 dark:text-green-400"><Check size={16} /></div>;
const AlertIcon = () => <div className="p-1 bg-red-100 dark:bg-red-900/50 rounded-full text-red-600 dark:text-red-400"><AlertCircle size={16} /></div>;

const GameSkeleton = () => {
  const trackWave = getWaveSvg('#cbd5e1'); // Slate-300
  return (
    <div className="w-full max-w-xl mx-auto px-4 py-8 animate-pulse">
       {/* Replaces the straight bar with a wavy track for weaving effect */}
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

interface MenuButtonProps {
    icon: React.ReactNode;
    title: string;
    desc: string;
    onClick: () => void;
    color: string;
}

const MenuButton: React.FC<MenuButtonProps> = ({ icon, title, desc, onClick, color }) => {
    // Explicit color mapping to fix light mode visibility issues
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

export default GameMode;
