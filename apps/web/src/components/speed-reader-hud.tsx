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
  const [position, setPosition] = useState({ x: 300, y: 100 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [voiceMode, setVoiceMode] = useState<VoiceMode>('visual');
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
  const ELEVENLABS_VOICE_ID = 'fATgBRI8wg5KkDFg8vBd';

  const startVoiceReading = useCallback(async () => {
    if (!ELEVENLABS_API_KEY) {
      setVoiceError('ElevenLabs API key not configured');
      return;
    }
    if (words.length === 0) {
      setVoiceError('No text loaded');
      return;
    }

    // Get text chunk - limit to reasonable size for TTS
    const textChunk = words.slice(currentIndex, currentIndex + 100).join(' ');
    if (!textChunk.trim()) {
      setVoiceError('No text to read');
      return;
    }

    setVoiceStatus('speaking');
    setVoiceError(null);

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: textChunk,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const audioBlob = await response.blob();
      
      if (audioBlob.size === 0) {
        throw new Error('Empty audio response');
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audioRef.current = audio;
      
      audio.onended = () => {
        setVoiceStatus('idle');
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setVoiceStatus('error');
        setVoiceError('Audio playback failed');
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.playbackRate = voiceRate;
      await audio.play();
    } catch (error) {
      setVoiceStatus('error');
      setVoiceError(error instanceof Error ? error.message : 'Failed to generate speech');
      setIsPlaying(false);
    }
  }, [words, currentIndex, voiceRate, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID]);

  const stopVoiceReading = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
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
    setVoiceError(null);
  }, [voiceMode, stopVoiceReading]);

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

  useEffect(() => {
    const fetchParsedText = async () => {
      try {
        setLoading(true);
        const res = await fetch(`http://localhost:3001/file/${fileId}/parsed`);
        if (!res.ok) throw new Error('fetch failed');
        const data: ParsedFileResponse = await res.json();
        setWords(data.parsedText.split(/\s+/).filter(Boolean));
      } catch (e) {
        setError('Failed to load text');
      } finally {
        setLoading(false);
      }
    };
    fetchParsedText();
  }, [fileId]);

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

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const wordsToDisplay =
    voiceMode === 'visual'
      ? words.slice(currentIndex, currentIndex + wordsPerDisplay).join(' ')
      : voiceStatus === 'speaking'
      ? `Speaking: "${words.slice(currentIndex, currentIndex + 10).join(' ')}..."`
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
        className={`rounded-lg p-6 mb-4 h-[120px] flex items-center justify-center ${
          voiceMode === 'voice' ? 'bg-purple-900/25' : 'bg-black/25'
        }`}
      >
        <div className="text-center w-full">
          <div
            className={`text-xl font-mono mb-2 font-bold ${
              voiceMode === 'voice' ? 'text-purple-400' : 'text-green-400'
            }`}
            style={{
              fontSize: wordsPerDisplay > 3 ? '1rem' : '1.25rem',
              lineHeight: '1.4',
              maxHeight: '4.2em',
              display: '-webkit-box',
              WebkitLineClamp: '3',
              WebkitBoxOrient: 'vertical',
            }}
          >
            {wordsToDisplay || 'Ready to read...'}
          </div>
          <div className="text-sm text-gray-400 font-bold">
            {words.length > 0 && voiceMode === 'visual' && `${Math.min(currentIndex + wordsPerDisplay, words.length)} of ${words.length} words`}
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
                className="w-16 px-2 py-1 bg-gray-700 rounded text-white text-sm text-center"
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