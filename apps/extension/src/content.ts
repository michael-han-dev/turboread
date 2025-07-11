interface Settings {
  wpm: number;
  wordsPerDisplay: number;
  voiceMode: 'visual' | 'voice';
  vapiPublicKey?: string;
}

interface MessageData {
  action: string;
  settings?: Settings;
  text?: string;
}

type VoiceStatus = 'idle' | 'connecting' | 'speaking' | 'error';

class TurboReadSpeedReader {
  private words: string[] = [];
  private currentIndex: number = 0;
  private isPlaying: boolean = false;
  private settings: Settings;
  private position = { x: 100, y: 100 };
  private intervalRef: number | null = null;
  private container: HTMLElement | null = null;
  private voiceStatus: VoiceStatus = 'idle';
  private isVoiceMuted: boolean = false;

  constructor(settings: Settings) {
    this.settings = settings;
    this.init();
  }

  private init(): void {
    this.createContainer();
    this.setupEventListeners();
    if (this.settings.voiceMode === 'voice') {
      this.initializeVapi();
    }
  }

  private createContainer(): void {
    const existing = document.getElementById('turboread-speed-reader');
    if (existing) {
      existing.remove();
    }

    this.container = document.createElement('div');
    this.container.id = 'turboread-speed-reader';
    this.container.innerHTML = this.getHTML();
    this.applyStyles();
    
    document.body.appendChild(this.container);
    this.updatePosition();
    this.updateUI();
  }

  private getHTML(): string {
    return `
      <div class="turboread-hud">
        <div class="header">
          <h3>⚡ Speed Reader</h3>
          <div class="header-controls">
            ${this.settings.voiceMode === 'voice' ? 
              '<button id="voice-mode-btn" class="mode-btn voice-mode">Voice</button>' : 
              '<button id="voice-mode-btn" class="mode-btn visual-mode">Visual</button>'
            }
            <button id="close-btn" class="close-btn">×</button>
          </div>
        </div>
        
        <div class="word-display ${this.settings.voiceMode === 'voice' ? 'voice-display' : 'visual-display'}">
          <div class="word-text">Ready to read...</div>
          <div class="word-progress"></div>
        </div>
        
        <div class="controls">
          <div class="setting-row">
            <label>Speed (WPM)</label>
            <div class="input-group">
              <input type="range" id="wpm-slider" min="50" max="1000" value="${this.settings.wpm}">
              <input type="number" id="wpm-input" value="${this.settings.wpm}" min="50" max="1000">
            </div>
          </div>
          
          ${this.settings.voiceMode === 'visual' ? `
            <div class="setting-row">
              <label>Words per Display</label>
              <div class="input-group">
                <input type="range" id="words-slider" min="1" max="10" value="${this.settings.wordsPerDisplay}">
                <span class="value-display">${this.settings.wordsPerDisplay}</span>
              </div>
            </div>
          ` : ''}
          
          ${this.settings.voiceMode === 'voice' ? `
            <div class="setting-row">
              <button id="mute-btn" class="control-btn mute-btn">
                🔊 Live
              </button>
            </div>
          ` : ''}
          
          <div class="button-row">
            <button id="play-btn" class="control-btn primary">
              ▶️ Play
            </button>
            <button id="reset-btn" class="control-btn">
              🔄 Reset
            </button>
          </div>
        </div>
        
        <div class="instructions">
          ${this.settings.voiceMode === 'voice' ? 
            'V: toggle mode • M: mute • ESC: close' : 
            'V: voice mode • mouse/arrows: move • ESC: close'
          }
        </div>
      </div>
    `;
  }

  private applyStyles(): void {
    if (!this.container) return;
    if (!document.getElementById('turboread-styles')) {
      const style = document.createElement('style');
      style.id = 'turboread-styles';
      style.textContent = `
        #turboread-speed-reader {
          position: fixed;
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          user-select: none;
          pointer-events: auto;
        }
        
        .turboread-hud {
          width: 320px;
          background: rgba(17, 24, 39, 0.95);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(75, 85, 99, 0.5);
          border-radius: 12px;
          padding: 16px;
          color: white;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
          cursor: move;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        .header-controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        
        .mode-btn {
          padding: 4px 8px;
          border: none;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .voice-mode {
          background: rgba(147, 51, 234, 0.3);
          color: #c4b5fd;
        }
        
        .visual-mode {
          background: rgba(75, 85, 99, 0.3);
          color: #d1d5db;
        }
        
        .close-btn {
          background: rgba(239, 68, 68, 0.2);
          border: none;
          color: #fca5a5;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
        }
        
        .word-display {
          min-height: 100px;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
        }
        
        .visual-display {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.2);
        }
        
        .voice-display {
          background: rgba(147, 51, 234, 0.1);
          border: 1px solid rgba(147, 51, 234, 0.2);
        }
        
        .word-text {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 8px;
          min-height: 32px;
          line-height: 1.2;
          word-wrap: break-word;
          max-width: 100%;
        }
        
        .word-progress {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
        }
        
        .controls {
          margin-bottom: 12px;
        }
        
        .setting-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        
        .setting-row label {
          font-size: 12px;
          font-weight: 500;
        }
        
        .input-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .input-group input[type="range"] {
          width: 100px;
        }
        
        .input-group input[type="number"] {
          width: 50px;
          padding: 2px 4px;
          background: rgba(75, 85, 99, 0.3);
          border: 1px solid rgba(75, 85, 99, 0.5);
          border-radius: 4px;
          color: white;
          font-size: 11px;
          text-align: center;
        }
        
        .value-display {
          font-size: 11px;
          min-width: 20px;
          text-align: center;
        }
        
        .button-row {
          display: flex;
          gap: 8px;
          justify-content: center;
        }
        
        .control-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          background: rgba(75, 85, 99, 0.3);
          color: white;
          border: 1px solid rgba(75, 85, 99, 0.5);
        }
        
        .control-btn:hover {
          background: rgba(75, 85, 99, 0.5);
        }
        
        .control-btn.primary {
          background: rgba(34, 197, 94, 0.3);
          border-color: rgba(34, 197, 94, 0.5);
          color: #86efac;
        }
        
        .control-btn.primary:hover {
          background: rgba(34, 197, 94, 0.5);
        }
        
        .mute-btn {
          width: 100%;
          margin-bottom: 8px;
        }
        
        .instructions {
          text-align: center;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.6);
          font-weight: 500;
        }
      `;
      document.head.appendChild(style);
    }
  }

  private setupEventListeners(): void {
    if (!this.container) return;

    this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));

    const playBtn = this.container.querySelector('#play-btn') as HTMLButtonElement;
    const resetBtn = this.container.querySelector('#reset-btn') as HTMLButtonElement;
    const closeBtn = this.container.querySelector('#close-btn') as HTMLButtonElement;
    const voiceModeBtn = this.container.querySelector('#voice-mode-btn') as HTMLButtonElement;
    const muteBtn = this.container.querySelector('#mute-btn') as HTMLButtonElement;

    const wpmSlider = this.container.querySelector('#wpm-slider') as HTMLInputElement;
    const wpmInput = this.container.querySelector('#wpm-input') as HTMLInputElement;
    const wordsSlider = this.container.querySelector('#words-slider') as HTMLInputElement;

    playBtn?.addEventListener('click', () => this.togglePlayPause());
    resetBtn?.addEventListener('click', () => this.reset());
    closeBtn?.addEventListener('click', () => this.close());
    voiceModeBtn?.addEventListener('click', () => this.toggleVoiceMode());
    muteBtn?.addEventListener('click', () => this.toggleMute());

    wpmSlider?.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      this.settings.wpm = value;
      if (wpmInput) wpmInput.value = value.toString();
    });

    wpmInput?.addEventListener('change', (e) => {
      const value = Math.max(50, Math.min(1000, parseInt((e.target as HTMLInputElement).value) || 300));
      this.settings.wpm = value;
      if (wpmSlider) wpmSlider.value = value.toString();
      (e.target as HTMLInputElement).value = value.toString();
    });

    wordsSlider?.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      this.settings.wordsPerDisplay = value;
      this.updateUI();
    });

    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handleMouseDown(e: MouseEvent): void {
    if ((e.target as Element).closest('button') || (e.target as Element).closest('input')) {
      return;
    }

    const startX = e.clientX - this.position.x;
    const startY = e.clientY - this.position.y;

    const handleMouseMove = (e: MouseEvent) => {
      this.position.x = Math.max(0, Math.min(window.innerWidth - 320, e.clientX - startX));
      this.position.y = Math.max(0, Math.min(window.innerHeight - 400, e.clientY - startY));
      this.updatePosition();
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.container || document.activeElement?.tagName === 'INPUT') return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        this.togglePlayPause();
        break;
      case 'Escape':
        this.close();
        break;
      case 'v':
      case 'V':
        this.toggleVoiceMode();
        break;
      case 'm':
      case 'M':
        if (this.settings.voiceMode === 'voice') {
          this.toggleMute();
        }
        break;
    }
  }

  private updatePosition(): void {
    if (this.container) {
      this.container.style.left = `${this.position.x}px`;
      this.container.style.top = `${this.position.y}px`;
    }
  }

  private updateUI(): void {
    if (!this.container) return;

    const wordText = this.container.querySelector('.word-text') as HTMLElement;
    const wordProgress = this.container.querySelector('.word-progress') as HTMLElement;
    const playBtn = this.container.querySelector('#play-btn') as HTMLButtonElement;
    const wordsDisplay = this.container.querySelector('.value-display') as HTMLElement;

    if (wordText) {
      if (this.words.length === 0) {
        wordText.textContent = 'Ready to read...';
      } else {
        const displayText = this.settings.voiceMode === 'visual' 
          ? this.words.slice(this.currentIndex, this.currentIndex + this.settings.wordsPerDisplay).join(' ')
          : this.voiceStatus === 'speaking' 
            ? `Speaking: "${this.words.slice(this.currentIndex, this.currentIndex + 10).join(' ')}..."`
            : this.voiceStatus === 'connecting'
              ? 'Connecting to voice...'
              : 'Ready for voice reading...';
        
        wordText.textContent = displayText || 'Ready to read...';
      }
    }

    if (wordProgress && this.words.length > 0) {
      if (this.settings.voiceMode === 'visual') {
        wordProgress.textContent = `${Math.min(this.currentIndex + this.settings.wordsPerDisplay, this.words.length)} of ${this.words.length} words`;
      } else {
        wordProgress.textContent = `Voice Mode: ${this.voiceStatus}`;
      }
    }

    if (playBtn) {
      playBtn.textContent = (this.isPlaying || this.voiceStatus === 'speaking') ? '⏸️ Pause' : '▶️ Play';
    }

    if (wordsDisplay) {
      wordsDisplay.textContent = this.settings.wordsPerDisplay.toString();
    }
  }

  private async initializeVapi(): Promise<void> {
    //TEST AFTER, SIMULATE THIS NOW
    console.log('Voice mode initialized (simulated)');
  }

  private togglePlayPause(): void {
    if (this.words.length === 0) return;

    if (this.settings.voiceMode === 'voice') {
      if (this.voiceStatus === 'speaking') {
        this.stopVoiceReading();
      } else if (this.voiceStatus === 'idle') {
        this.startVoiceReading();
      }
    } else {
      this.isPlaying = !this.isPlaying;
      
      if (this.isPlaying) {
        this.startVisualReading();
      } else {
        this.stopVisualReading();
      }
    }
    
    this.updateUI();
  }

  private startVisualReading(): void {
    if (this.intervalRef) return;

    const delay = 60000 / this.settings.wpm;
    
    this.intervalRef = window.setInterval(() => {
      this.currentIndex += this.settings.wordsPerDisplay;
      
      if (this.currentIndex >= this.words.length) {
        this.stopVisualReading();
        return;
      }
      
      this.updateUI();
    }, delay);
  }

  private stopVisualReading(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
    this.isPlaying = false;
  }

  private startVoiceReading(): void {
    this.voiceStatus = 'connecting';
    this.updateUI();
    
    setTimeout(() => {
      this.voiceStatus = 'speaking';
      this.isPlaying = true;
      this.updateUI();
    }, 1000);
  }

  private stopVoiceReading(): void {
    this.voiceStatus = 'idle';
    this.isPlaying = false;
    this.updateUI();
  }

  private reset(): void {
    this.stopVisualReading();
    this.stopVoiceReading();
    this.currentIndex = 0;
    this.isPlaying = false;
    this.updateUI();
  }

  private toggleVoiceMode(): void {
    alert('Voice mode requires Vapi API key configuration. This is a demonstration of visual mode.');
  }

  private toggleMute(): void {
    this.isVoiceMuted = !this.isVoiceMuted;
    const muteBtn = this.container?.querySelector('#mute-btn') as HTMLButtonElement;
    if (muteBtn) {
      muteBtn.textContent = this.isVoiceMuted ? '🔇 Muted' : '🔊 Live';
    }
  }

  private close(): void {
    this.stopVisualReading();
    this.stopVoiceReading();
    if (this.container) {
      this.container.remove();
    }
    
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
  }

  public loadText(text: string): void {
    this.words = text.split(/\s+/).filter(word => word.length > 0);
    this.currentIndex = 0;
    this.updateUI();
  }
}

// Content script message handler
let speedReader: TurboReadSpeedReader | null = null;

chrome.runtime.onMessage.addListener((message: MessageData, sender, sendResponse) => {
  try {
    switch (message.action) {
      case 'activate':
        if (message.settings) {
          speedReader = new TurboReadSpeedReader(message.settings);
          const text = getPageText();
          speedReader.loadText(text);
          sendResponse({ success: true });
        }
        break;
        
      case 'readSelected':
        if (message.settings) {
          const selectedText = window.getSelection()?.toString() || getPageText();
          speedReader = new TurboReadSpeedReader(message.settings);
          speedReader.loadText(selectedText);
          sendResponse({ success: true });
        }
        break;
        
      case 'readPage':
        if (message.settings) {
          const pageText = getPageText();
          speedReader = new TurboReadSpeedReader(message.settings);
          speedReader.loadText(pageText);
          sendResponse({ success: true });
        }
        break;
    }
  } catch (error) {
    console.error('TurboRead error:', error);
    sendResponse({ success: false, error: error.message });
  }
});

function getPageText(): string {
  // Extract readable text from the page
  const article = document.querySelector('article');
  const main = document.querySelector('main');
  const content = document.querySelector('.content, .post-content, .entry-content');
  
  let textSource = article || main || content || document.body;
  
  const scripts = textSource.querySelectorAll('script, style, nav, header, footer, aside');
  scripts.forEach(el => el.remove());
  
  const text = textSource.textContent || textSource.innerText || '';
  return text.replace(/\s+/g, ' ').trim();
}

// Initialize if needed
console.log('TurboRead content script loaded'); 