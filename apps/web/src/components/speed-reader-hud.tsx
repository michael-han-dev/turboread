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
  // Core state
  const [words, setWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(300);
  const [wordsPerDisplay, setWordsPerDisplay] = useState(1);
  
  // HUD position and movement
  const [position, setPosition] = useState({ x: 300, y: 100 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for cleanup and keyboard handling
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hudRef = useRef<HTMLDivElement>(null);

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
      // Only handle arrow keys when HUD is focused or no other input is focused
      if (document.activeElement?.tagName === 'INPUT') return;
      
      const moveDistance = 10;
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
        case 'Escape':
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Control functions
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const handleWpmChange = (value: number) => {
    setWpm(Math.max(50, Math.min(1000, value))); 
  };

  const handleWordsPerDisplayChange = (value: number) => {
    setWordsPerDisplay(Math.max(1, Math.min(10, value)));
  };

  // Get current words to display
  const getCurrentWords = () => {
    return words.slice(currentIndex, currentIndex + wordsPerDisplay).join(' ');
  };

  if (loading) {
    return (
      <div 
        className="fixed bg-gray-900/80 backdrop-blur-sm rounded-lg p-6 text-white shadow-2xl border border-gray-600"
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
      ref={hudRef}
      className="fixed bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 text-white shadow-2xl border border-gray-600 select-none"
      style={{ left: position.x, top: position.y, width: '320px', minHeight: '280px' }}
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Speed Reader</h3>
        <button 
          onClick={onClose}
          className="text-white hover:text-gray-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Word Display Area */}
      <div className="bg-black/50 rounded-lg p-6 mb-4 min-h-[80px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-mono text-green-400 mb-2">
            {getCurrentWords() || 'Ready to read...'}
          </div>
          <div className="text-sm text-gray-400">
            {words.length > 0 && `${currentIndex + 1}-${Math.min(currentIndex + wordsPerDisplay, words.length)} of ${words.length} words`}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3">
        {/* WPM Control */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Words Per Minute</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="50"
              max="1000"
              value={wpm}
              onChange={(e) => handleWpmChange(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <input
              type="number"
              min="50"
              max="1000"
              value={wpm}
              onChange={(e) => handleWpmChange(Number(e.target.value))}
              className="w-16 px-2 py-1 bg-gray-700 rounded text-white text-sm text-center"
            />
          </div>
        </div>

        {/* Words Per Display */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Words Per Display</label>
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
        <div className="flex items-center justify-center gap-2 pt-2">
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
      </div>

      {/* Instructions */}
      <div className="mt-3 text-xs text-gray-400 text-center">
        Use arrow keys to move • ESC to close
      </div>
    </div>
  );
} 