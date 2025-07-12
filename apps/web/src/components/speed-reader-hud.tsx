'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, X } from 'lucide-react';

interface SpeedReaderHUDProps {
  fileId: string;
  onClose: () => void;
}

interface ParsedFileResponse {
  file: { id: string; filename: string };
  parsedText: string;
  wordCount: number;
  cached: boolean;
}

type VoiceMode = 'visual' | 'voice';
type VoiceStatus = 'idle' | 'speaking' | 'error';

export default function SpeedReaderHUD({ fileId, onClose }: SpeedReaderHUDProps) {
  const [words, setWords] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(300);
  const [rawWpmInput, setRawWpmInput] = useState('300');
  const [voiceRate, setVoiceRate] = useState(1);
  const [wordsPerDisplay, setWordsPerDisplay] = useState(1);
  const [wordPositionInput, setWordPositionInput] = useState('1');
  const [position, setPosition] = useState({ x: 300, y: 100 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [voiceMode, setVoiceMode] = useState<VoiceMode>('visual');
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // refs for managing audio state and playback position
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentChunkRef = useRef<number>(0);
  const nextChunkRef = useRef<HTMLAudioElement | null>(null);
  const audioPositionRef = useRef<number>(0);
  const chunkWordCountRef = useRef<number>(200);

  const ELEVENLABS_VOICE_ID = 'fATgBRI8wg5KkDFg8vBd';

  const generateAudioChunk = useCallback(async (chunkIndex: number, startWordIndex: number): Promise<string> => {
    const response = await fetch(`http://localhost:3001/file/${fileId}/audio/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chunkIndex,
        startWordIndex,
        voiceId: ELEVENLABS_VOICE_ID,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Audio generation failed:', response.status, errorText);
      throw new Error(`Failed to generate audio chunk: ${response.status} ${errorText}`);
    }

    return `http://localhost:3001/file/${fileId}/audio/${chunkIndex}`;
  }, [fileId, ELEVENLABS_VOICE_ID]);

  const loadAudioChunk = useCallback(async (chunkIndex: number, startWordIndex: number): Promise<HTMLAudioElement> => {
    const audioUrl = await generateAudioChunk(chunkIndex, startWordIndex);
    const audio = new Audio(audioUrl);
    audio.playbackRate = voiceRate;
    
    return new Promise((resolve, reject) => {
      audio.oncanplaythrough = () => resolve(audio);
      audio.onerror = () => reject(new Error('Failed to load audio'));
    });
  }, [generateAudioChunk, voiceRate]);

  // syncs visual word display with audio playback progress
  const updateWordPosition = useCallback(() => {
    if (!audioRef.current) return;
    
    const currentTime = audioRef.current.currentTime;
    const duration = audioRef.current.duration;
    
    if (duration > 0) {
      const progress = currentTime / duration;
      const wordsInChunk = Math.min(chunkWordCountRef.current, words.length - currentChunkRef.current * 200);
      const wordProgressInChunk = Math.floor(progress * wordsInChunk);
      const newIndex = currentChunkRef.current * 200 + wordProgressInChunk;
      
      if (newIndex < words.length) {
        setCurrentIndex(newIndex);
      }
    }
  }, [words.length]);

  // preloads first two 200-word chunks for playback
  const preloadInitialChunks = useCallback(async () => {
    if (words.length === 0) return;
    
    try {
      const firstChunk = await loadAudioChunk(0, 0);
      audioRef.current = firstChunk;
      chunkWordCountRef.current = Math.min(200, words.length);
      
      if (words.length > 200) {
        const secondChunk = await loadAudioChunk(1, 200);
        nextChunkRef.current = secondChunk;
      }
    } catch (error) {
      console.error('Preload error:', error);
      setVoiceError(`Failed to preload audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [words.length, loadAudioChunk]);

  // starts or resumes audio playback from current position
  const startVoiceReading = useCallback(async () => {
    if (words.length === 0) {
      setVoiceError('No text loaded');
      return;
    }

    setVoiceStatus('speaking');
    setVoiceError(null);

    try {
      const chunkIndex = Math.floor(currentIndex / 200);
      const startWordIndex = chunkIndex * 200;
      
      if (!audioRef.current || currentChunkRef.current !== chunkIndex) {
        const audio = await loadAudioChunk(chunkIndex, startWordIndex);
        audioRef.current = audio;
        currentChunkRef.current = chunkIndex;
        audioPositionRef.current = 0;
        chunkWordCountRef.current = Math.min(200, words.length - startWordIndex);
      }

      const audio = audioRef.current;
      audio.playbackRate = voiceRate;
      audio.currentTime = audioPositionRef.current;
      
      audio.onended = () => {
        const nextChunkIndex = chunkIndex + 1;
        const nextStartWordIndex = nextChunkIndex * 200;
        
        if (nextStartWordIndex < words.length) {
          if (nextChunkRef.current) {
            audioRef.current = nextChunkRef.current;
            currentChunkRef.current = nextChunkIndex;
            audioPositionRef.current = 0;
            chunkWordCountRef.current = Math.min(200, words.length - nextStartWordIndex);
            
            audioRef.current.playbackRate = voiceRate;
            audioRef.current.play();
            audioRef.current.ontimeupdate = () => {
              updateWordPosition();
            };

            loadAudioChunk(nextChunkIndex + 1, (nextChunkIndex + 1) * 200)
              .then(nextAudio => {
                nextChunkRef.current = nextAudio;
              })
              .catch(() => {});
          } else {
            setVoiceStatus('idle');
            setIsPlaying(false);
          }
        } else {
          setVoiceStatus('idle');
          setIsPlaying(false);
        }
      };
      
      audio.onerror = () => {
        setVoiceStatus('error');
        setVoiceError('Audio playback failed');
        setIsPlaying(false);
      };

      audio.ontimeupdate = () => {
        updateWordPosition();
      };

      await audio.play();
    } catch (error) {
      setVoiceStatus('error');
      setVoiceError(error instanceof Error ? error.message : 'Failed to generate speech');
      setIsPlaying(false);
    }
  }, [words, currentIndex, voiceRate, loadAudioChunk, updateWordPosition]);

  const stopVoiceReading = useCallback(() => {
    if (audioRef.current) {
      audioPositionRef.current = audioRef.current.currentTime;
      audioRef.current.pause();
      audioRef.current.ontimeupdate = null;
    }
    setVoiceStatus('idle');
  }, []);

  const handlePlayPause = useCallback(async () => {
    if (voiceMode === 'voice') {
      if (voiceStatus === 'speaking') {
        stopVoiceReading();
        setIsPlaying(false);
      } else if (voiceStatus === 'idle') {
        await startVoiceReading();
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  }, [voiceMode, voiceStatus, isPlaying, startVoiceReading, stopVoiceReading]);

  const handleReset = useCallback(() => {
    if (voiceMode === 'voice') stopVoiceReading();
    setIsPlaying(false);
    setCurrentIndex(0);
    setWordPositionInput('1');
    setVoiceError(null);
    audioPositionRef.current = 0;
    currentChunkRef.current = 0;
  }, [voiceMode, stopVoiceReading]);

  // handles manual word position changes and updates audio position
  const handleWordPositionChange = useCallback((value: string) => {
    setWordPositionInput(value);
    const numValue = Number(value);
    if (!isNaN(numValue) && numValue >= 1 && numValue <= words.length) {
      const newIndex = numValue - 1;
      setCurrentIndex(newIndex);
      
      if (voiceMode === 'voice') {
        const newChunkIndex = Math.floor(newIndex / 200);
        if (newChunkIndex !== currentChunkRef.current) {
          audioPositionRef.current = 0;
        } else {
          const wordsIntoChunk = newIndex - (newChunkIndex * 200);
          const wordsInChunk = Math.min(200, words.length - newChunkIndex * 200);
          audioPositionRef.current = audioRef.current ? (audioRef.current.duration * wordsIntoChunk / wordsInChunk) || 0 : 0;
        }
      }
    }
  }, [words.length, voiceMode]);

  const toggleVoiceMode = useCallback(() => {
    if (isPlaying && voiceMode === 'voice') stopVoiceReading();
    setIsPlaying(false);
    setVoiceMode((m) => (m === 'visual' ? 'voice' : 'visual'));
    setVoiceError(null);
  }, [isPlaying, voiceMode, stopVoiceReading]);

  const updateWpm = useCallback((value: number) => {
    const clamped = Math.max(50, Math.min(1000, value));
    setWpm(clamped);
    setRawWpmInput(clamped.toString());
  }, []);

  const handleWordsPerDisplayChange = useCallback((value: number) => {
    setWordsPerDisplay(Math.max(1, Math.min(10, value)));
  }, []);

  const handleDrag = useCallback(
    (e: React.MouseEvent) => {
      const offset = { x: e.clientX - position.x, y: e.clientY - position.y };
      const move = (m: MouseEvent) => {
        setPosition({
          x: Math.max(0, Math.min(window.innerWidth - 320, m.clientX - offset.x)),
          y: Math.max(0, Math.min(window.innerHeight - 400, m.clientY - offset.y)),
        });
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', () => document.removeEventListener('mousemove', move), {
        once: true,
      });
    },
    [position],
  );

  const handleWpmInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setRawWpmInput(inputValue);
    const numValue = Number(inputValue);
    if (!isNaN(numValue)) {
      setWpm(numValue);
    }
  };

  // loads text content and initializes audio chunks on mount
  useEffect(() => {
    const fetchParsedText = async () => {
      try {
        setLoading(true);
        const res = await fetch(`http://localhost:3001/file/${fileId}/parsed`);
        if (!res.ok) throw new Error('fetch failed');
        const data: ParsedFileResponse = await res.json();
        const wordArray = data.parsedText.split(/\s+/).filter(Boolean);
        setWords(wordArray);
        
        if (wordArray.length > 0) {
          preloadInitialChunks();
        }
      } catch (e) {
        setError('Failed to load text');
      } finally {
        setLoading(false);
      }
    };
    fetchParsedText();
  }, [fileId, preloadInitialChunks]);

  // handles visual mode word advancement based on wpm
  useEffect(() => {
    if (voiceMode === 'visual' && isPlaying && words.length) {
      const delay = 60000 / wpm;
      intervalRef.current = setInterval(() => {
        setCurrentIndex((p) => {
          if (p + wordsPerDisplay >= words.length) {
            setIsPlaying(false);
            return p;
          }
          return p + wordsPerDisplay;
        });
      }, delay);
    } else clearInterval(intervalRef.current as NodeJS.Timeout);
    return () => clearInterval(intervalRef.current as NodeJS.Timeout);
  }, [voiceMode, isPlaying, wpm, wordsPerDisplay, words.length]);

  useEffect(() => {
    setWordPositionInput((currentIndex + 1).toString());
  }, [currentIndex]);

  // keyboard shortcuts for controlling playback and navigation
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
          if (voiceMode === 'voice') {
            setVoiceRate(prev => Math.max(0.3, parseFloat((prev - 0.1).toFixed(1))));
          } else {
            updateWpm(Math.max(50, wpm - 10));
          }
          break;
        case 'd':
          e.preventDefault();
          if (voiceMode === 'voice') {
            setVoiceRate(prev => Math.min(4, parseFloat((prev + 0.1).toFixed(1))));
          } else {
            updateWpm(Math.min(1000, wpm + 10));
          }
          break;
        case 'h':
          e.preventDefault();
          if (voiceMode === 'visual') {
            handleWordsPerDisplayChange(Math.max(1, wordsPerDisplay - 1));
          }
          break;
        case 'k':
          e.preventDefault();
          if (voiceMode === 'visual') {
            handleWordsPerDisplayChange(Math.min(10, wordsPerDisplay + 1));
          }
          break;
        case 'v':
          e.preventDefault();
          toggleVoiceMode();
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, wpm, wordsPerDisplay, voiceMode, updateWpm, handleWordsPerDisplayChange, toggleVoiceMode]);

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

  // cleanup audio resources and animation frames on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.ontimeupdate = null;
      }
      if (nextChunkRef.current) {
        nextChunkRef.current.pause();
        nextChunkRef.current.src = '';
      }
    };
  }, []);

  // determines text display based on current mode and state
  const wordsToDisplay =
    voiceMode === 'visual'
      ? words.slice(currentIndex, currentIndex + wordsPerDisplay).join(' ')
      : voiceStatus === 'speaking'
      ? words.slice(currentIndex, currentIndex + 3).join(' ')
      : voiceStatus === 'error'
      ? 'Voice error occurred'
      : 'Ready for voice reading...';

  if (loading)
    return (
      <div
        className="fixed bg-gray-900/50 backdrop-blur-sm rounded-lg p-6 text-white shadow-2xl border border-gray-600"
        style={{ left: position.x, top: position.y, width: '300px', height: '200px' }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        </div>
      </div>
    );

  if (error)
    return (
      <div
        className="fixed bg-red-900/80 backdrop-blur-sm rounded-lg p-6 text-white shadow-2xl border border-red-600"
        style={{ left: position.x, top: position.y, width: '300px', height: '200px' }}
      >
        <p className="text-red-200">{error}</p>
      </div>
    );

  return (
    <div
      className="fixed bg-gray-900/50 rounded-lg p-4 text-white shadow-2xl border border-gray-600 select-none cursor-move"
      style={{ left: position.x, top: position.y, width: '320px', height: '420px' }}
      tabIndex={0}
      onMouseDown={(e) => {
        if (
          e.target instanceof Element &&
          (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('label'))
        )
          return;
        handleDrag(e);
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Speed Reader</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleVoiceMode}
            className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
              voiceMode === 'voice' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-600 hover:bg-gray-700'
            }`}
            title="Toggle Voice Mode (V)"
          >
            {voiceMode === 'voice' ? 'Voice' : 'Visual'}
          </button>
          <button onClick={onClose} className="hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        className={`rounded-lg p-4 mb-4 h-[120px] flex items-center justify-center ${
          voiceMode === 'voice' ? 'bg-purple-900/25' : 'bg-black/25'
        }`}
      >
        <div className="text-center w-full">
          <div
            className={`font-mono mb-2 font-bold ${
              voiceMode === 'voice' ? 'text-purple-400' : 'text-green-400'
            }`}
            style={{
              fontSize: voiceMode === 'voice' ? '1.1rem' : wordsPerDisplay > 3 ? '1rem' : '1.25rem',
              lineHeight: '1.3',
              maxHeight: '4.5em',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: '3',
              WebkitBoxOrient: 'vertical',
              wordBreak: 'break-word',
            }}
          >
            {wordsToDisplay || 'Ready to read...'}
          </div>
          <div className="text-sm text-gray-400 font-bold flex items-center justify-center gap-2">
            {words.length > 0 && voiceMode === 'visual' && (
              <>
                <input
                  type="number"
                  value={wordPositionInput}
                  onChange={(e) => handleWordPositionChange(e.target.value)}
                  onBlur={() => {
                    const num = Number(wordPositionInput);
                    if (isNaN(num) || num < 1 || num > words.length) {
                      setWordPositionInput((currentIndex + 1).toString());
                    }
                  }}
                  className="w-16 px-2 py-1 bg-gray-700 rounded text-white text-sm text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min="1"
                  max={words.length}
                />
                <span>of {words.length} words</span>
              </>
            )}
            {words.length > 0 && voiceMode === 'voice' && `Voice Mode: ${voiceStatus}`}
          </div>
        </div>
      </div>

      {voiceError && (
        <div className="bg-red-900/50 rounded p-2 mb-3 text-sm text-red-200">
          Voice Error: {voiceError}
        </div>
      )}

      <div className="space-y-2.5 flex flex-col">
        <div>
          <label className="block text-sm mb-1 font-bold text-gray-300">
            {voiceMode === 'voice' ? 'Voice Rate (0.3x – 4x, A/D)' : 'Words Per Minute (A/D)'}
          </label>
          <div className="flex items-center gap-2">
            {voiceMode === 'voice' ? (
              <input
                type="range"
                min="0.3"
                max="4"
                step="0.1"
                value={voiceRate}
                onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            ) : (
              <input
                type="range"
                min="50"
                max="1000"
                value={wpm}
                onChange={(e) => updateWpm(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            )}
            {voiceMode === 'voice' ? (
              <span className="w-16 text-center text-sm">{voiceRate.toFixed(1)}x</span>
            ) : (
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
                className="w-16 px-2 py-1 bg-gray-700 rounded text-white text-sm text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            )}
          </div>
        </div>

        {voiceMode === 'visual' && (
          <div>
            <label className="block text-sm mb-1 font-bold text-gray-300">Words Per Display (H/K)</label>
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
        )}

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={handlePlayPause}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              voiceMode === 'voice' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'
            }`}
            disabled={words.length === 0}
          >
            {(isPlaying || voiceStatus === 'speaking') ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {(isPlaying || voiceStatus === 'speaking') ? 'Pause' : 'Play'}
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

        <div className="text-sm text-white/70 text-center mt-auto pb-2 font-bold">
          {voiceMode === 'voice' 
            ? 'V: toggle mode • Space: play/pause • ESC: close'
            : 'V: voice mode • Space: play/pause • mouse/arrows: move • ESC: close'
          }
        </div>
      </div>
    </div>
  );
}