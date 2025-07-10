'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, X } from 'lucide-react';

interface SpeedReaderHUDProps {
  fileId: string;
  onClose: () => void;
}

interface ParsedFileResponse {
  file: {
    id: string;
    filename: string;
  };
  parsedText: string;
  wordCount: number;
  cached: boolean;
}

export default function SpeedReaderHUD({ fileId, onClose }: SpeedReaderHUDProps) {
  const [words, setWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(300);
  const [rawWpmInput, setRawWpmInput] = useState('300');
  const [wordsPerDisplay, setWordsPerDisplay] = useState(1);
  
  // HUD position and movement
  const [position, setPosition] = useState({ x: 300, y: 100 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Mouse drag handlers
  const handleDrag = useCallback((e: React.MouseEvent) => {
    const offset = { x: e.clientX - position.x, y: e.clientY - position.y };
    
    const handleMouseMove = (e: MouseEvent) => {
      const x = Math.max(0, Math.min(window.innerWidth - 320, e.clientX - offset.x));
      const y = Math.max(0, Math.min(window.innerHeight - 400, e.clientY - offset.y));
      setPosition({ x, y });
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', () => {
      document.removeEventListener('mousemove', handleMouseMove);
    }, { once: true });
  }, [position]);

  // Control functions
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const updateWpm = useCallback((value: number) => {
    const clamped = Math.max(50, Math.min(1000, value));
    setWpm(clamped);
    setRawWpmInput(clamped.toString());
  }, []);

  const handleWpmInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setRawWpmInput(inputValue);

    const numValue = Number(inputValue);
    if (!isNaN(numValue)) {
      setWpm(numValue);
    }
  };

  const handleWordsPerDisplayChange = useCallback((value: number) => {
    setWordsPerDisplay(Math.max(1, Math.min(10, value)));
  }, []);

  // Suppress extension-related console errors
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Filter out common extension errors
      const message = args[0]?.toString() || '';
      if (message.includes('browser is not defined') || 
          message.includes('Cannot read properties of undefined') ||
          message.includes('Utilities') ||
          message.includes('Translate')) {
        return; 
      }
      originalConsoleError.apply(console, args);
    };

    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  // Fetch parsed text from our API
  useEffect(() => {
    const fetchParsedText = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:3001/file/${fileId}/parsed`);
        if (!response.ok) throw new Error('Failed to fetch parsed text');
        
        const data: ParsedFileResponse = await response.json();
        const wordArray = data.parsedText.split(/\s+/).filter(word => word.length > 0);
        setWords(wordArray);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load text');
        setLoading(false);
      }
    };

    fetchParsedText();
  }, [fileId]);

  // Speed reading timer logic
  useEffect(() => {
    if (isPlaying && words.length > 0) {
      const delay = 60000 / wpm; 
      
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev + wordsPerDisplay >= words.length) {
            setIsPlaying(false);
            return prev;
          }
          return prev + wordsPerDisplay;
        });
      }, delay);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, wpm, wordsPerDisplay, words.length]);

  // Keyboard controls for HUD movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      
      const moveDistance = 25;
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setPosition(prev => ({ ...prev, y: Math.max(0, prev.y - moveDistance) }));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setPosition(prev => ({ ...prev, y: Math.min(window.innerHeight - 200, prev.y + moveDistance) }));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setPosition(prev => ({ ...prev, x: Math.max(0, prev.x - moveDistance) }));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setPosition(prev => ({ ...prev, x: Math.min(window.innerWidth - 300, prev.x + moveDistance) }));
          break;
        case 'a':
          e.preventDefault();
          updateWpm(Math.max(50, wpm - 10));
          break;
        case 'd':
          e.preventDefault();
          updateWpm(Math.min(1000, wpm + 10));
          break;
        case 'h':
          e.preventDefault();
          handleWordsPerDisplayChange(Math.max(1, wordsPerDisplay - 1));
          break;
        case 'k':
          e.preventDefault();
          handleWordsPerDisplayChange(Math.min(10, wordsPerDisplay + 1));
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, wpm, wordsPerDisplay, updateWpm, handleWordsPerDisplayChange]);

  // Global hotkey for play/pause
  useEffect(() => {
    const handleSpaceBar = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        handlePlayPause();
      }
    };

    window.addEventListener('keydown', handleSpaceBar);
    return () => window.removeEventListener('keydown', handleSpaceBar);
  }, [handlePlayPause]);

  const wordsToDisplay = words.slice(currentIndex, currentIndex + wordsPerDisplay).join(' ');

  if (loading) {
    return (
      <div 
        style={{ left: position.x, top: position.y, width: '300px', height: '200px' }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p>Loading text...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="fixed bg-red-900/80 backdrop-blur-sm rounded-lg p-6 text-white shadow-2xl border border-red-600"
        style={{ left: position.x, top: position.y, width: '300px', height: '200px' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Error</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-red-200">{error}</p>
      </div>
    );
  }

  return (
    <div 
      className="fixed bg-gray-900/50 rounded-lg p-4 text-white shadow-2xl border border-gray-600 select-none cursor-move"
      style={{ left: position.x, top: position.y, width: '320px', height: '400px' }}
      tabIndex={0}
      onMouseDown={(e) => {
        if (
          e.target instanceof Element && 
          (e.target.closest('button') || 
           e.target.closest('input') || 
           e.target.closest('select') || 
           e.target.closest('label'))
        ) return;
        handleDrag(e);
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between mb-4"
      >
        <h3 className="text-lg font-bold">Speed Reader</h3>
        <button 
          onClick={onClose}
          className="text-white hover:text-gray-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Word Display Area */}
      <div className="bg-black/25 rounded-lg p-6 mb-4 h-[120px] flex items-center justify-center overflow-hidden">
        <div className="text-center w-full">
          <div className="text-xl font-mono text-green-400 mb-2 break-words overflow-hidden text-ellipsis font-bold" style={{
            fontSize: wordsPerDisplay > 3 ? '1rem' : '1.25rem',
            lineHeight: '1.4',
            maxHeight: '4.2em',
            display: '-webkit-box',
            WebkitLineClamp: '3',
            WebkitBoxOrient: 'vertical'
          }}>
            {wordsToDisplay || 'Ready to read...'}
          </div>
          <div className="text-sm text-gray-400 font-bold">
            {words.length > 0 && `${Math.min(currentIndex + wordsPerDisplay, words.length)} of ${words.length} words`}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3 flex flex-col h-[calc(100%-180px)]">
        {/* WPM Control */}
        <div>
          <label className="block text-sm text-gray-300 mb-1 font-bold">Words Per Minute (A/D)</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="50"
              max="1000"
              value={wpm}
              onChange={(e) => updateWpm(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <input
              type="number"
              value={rawWpmInput}
              onChange={handleWpmInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const num = Number(rawWpmInput);
                  if (!isNaN(num)) {
                    updateWpm(num);
                  } else {
                    setRawWpmInput(wpm.toString());
                  }
                  e.currentTarget.blur();
                }
              }}
              onBlur={() => {
                const num = Number(rawWpmInput);
                if (!isNaN(num)) {
                  updateWpm(num);
                } else {
                  setRawWpmInput(wpm.toString());
                }
              }}
              className="w-16 px-2 py-1 bg-gray-700 rounded text-white text-sm text-center"
            />
          </div>
        </div>

        {/* Words Per Display */}
        <div>
          <label className="block text-sm text-gray-300 mb-1 font-bold">Words Per Display (H/K)</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="10"
              value={wordsPerDisplay}
              onChange={(e) => handleWordsPerDisplayChange(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <span className="w-8 text-center text-sm">{wordsPerDisplay}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={handlePlayPause}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            disabled={words.length === 0}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            disabled={words.length === 0}
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>

        {/* Instructions */}
        <div className="text-sm text-white/70 text-center mt-auto pb-2 font-bold">
          mouse or arrow keys to move • ESC to close
        </div>
      </div>
    </div>
  );
} 