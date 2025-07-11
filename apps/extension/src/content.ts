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

interface TextNode {
  node: Text;
  text: string;
  wordStart: number;
  wordEnd: number;
}

class TurboReadSpeedReader {
  private words: string[] = [];
  private textNodes: TextNode[] = [];
  private currentIndex: number = 0;
  private isPlaying: boolean = false;
  private settings: Settings;
  private position = { x: 100, y: 100 };
  private intervalRef: number | null = null;
  private container: HTMLElement | null = null;
  private voiceStatus: VoiceStatus = 'idle';
  private isVoiceMuted: boolean = false;
  private highlightElements: HTMLElement[] = [];
  private progressBar: HTMLElement | null = null;

  constructor(settings: Settings) {
    this.settings = settings;
    this.init();
  }

  private init(): void {
    try {
      this.createContainer();
      this.createProgressBar();
      this.setupEventListeners();
      if (this.settings.voiceMode === 'voice') {
        this.initializeVapi();
      }
    } catch (error) {
      console.error('TurboRead initialization error:', error);
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

    if (!document.getElementById('turboread-fonts')) {
      const fontLink = document.createElement('link');
      fontLink.id = 'turboread-fonts';
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Instrument+Serif:ital,wght@0,400;1,400&display=swap';
      document.head.appendChild(fontLink);
    }

    if (!document.getElementById('turboread-styles')) {
      const style = document.createElement('style');
      style.id = 'turboread-styles';
      style.textContent = `
        #turboread-speed-reader {
          position: fixed;
          z-index: 999999;
          font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
          font-family: 'Instrument Serif', serif;
          font-size: 16px;
          font-weight: 400;
          letter-spacing: -0.48px;
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

        .reading-progress {
          position: fixed;
          top: 0;
          left: 0;
          height: 3px;
          background: linear-gradient(90deg, #22c55e, #16a34a);
          z-index: 1000000;
          transition: width 0.3s ease;
          box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
        }

        .turboread-highlight {
          background-color: rgba(255, 235, 59, 0.4) !important;
          transition: background-color 0.3s ease !important;
          border-radius: 2px !important;
        }

        .turboread-current-highlight {
          background-color: rgba(255, 193, 7, 0.6) !important;
          border: 1px solid rgba(255, 193, 7, 0.8) !important;
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

  private createProgressBar(): void {
    const existing = document.getElementById('turboread-progress');
    if (existing) existing.remove();

    this.progressBar = document.createElement('div');
    this.progressBar.id = 'turboread-progress';
    this.progressBar.className = 'reading-progress';
    this.progressBar.style.width = '0%';
    document.body.appendChild(this.progressBar);
  }

  private updateProgress(): void {
    if (!this.progressBar || this.words.length === 0) return;
    
    const progress = Math.min(100, (this.currentIndex / this.words.length) * 100);
    this.progressBar.style.width = `${progress}%`;
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

  private mapTextToNodes(text: string): void {
    this.textNodes = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }
          
          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'nav', 'header', 'footer'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          if (parent.closest('#turboread-speed-reader')) {
            return NodeFilter.FILTER_REJECT;
          }
          
          const nodeText = node.textContent?.trim();
          return nodeText && nodeText.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );

    let currentWordIndex = 0;
    let node: Text | null;
    
    while (node = walker.nextNode() as Text) {
      const nodeText = node.textContent || '';
      const words = nodeText.split(/\s+/).filter(w => w.length > 0);
      
      if (words.length > 0) {
        this.textNodes.push({
          node,
          text: nodeText,
          wordStart: currentWordIndex,
          wordEnd: currentWordIndex + words.length - 1
        });
        currentWordIndex += words.length;
      }
    }
  }

  private highlightWords(startIndex: number, endIndex: number): void {
    this.clearHighlights();
    
    for (const textNode of this.textNodes) {
      if (textNode.wordEnd < startIndex || textNode.wordStart > endIndex) continue;
      
      const nodeWords = textNode.text.split(/\s+/).filter(w => w.length > 0);
      const relativeStart = Math.max(0, startIndex - textNode.wordStart);
      const relativeEnd = Math.min(nodeWords.length - 1, endIndex - textNode.wordStart);
      
      if (relativeStart <= relativeEnd) {
        this.highlightNodeWords(textNode.node, nodeWords, relativeStart, relativeEnd);
      }
    }
  }

  private highlightNodeWords(textNode: Text, words: string[], startWord: number, endWord: number): void {
    const parent = textNode.parentElement;
    if (!parent) return;

    const originalText = textNode.textContent || '';
    const beforeText = originalText.substring(0, originalText.indexOf(words[startWord]));
    const highlightText = words.slice(startWord, endWord + 1).join(' ');
    const afterText = originalText.substring(beforeText.length + highlightText.length);

    const beforeNode = beforeText ? document.createTextNode(beforeText) : null;
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'turboread-highlight turboread-current-highlight';
    highlightSpan.textContent = highlightText;
    const afterNode = afterText ? document.createTextNode(afterText) : null;

    if (beforeNode) parent.insertBefore(beforeNode, textNode);
    parent.insertBefore(highlightSpan, textNode);
    if (afterNode) parent.insertBefore(afterNode, textNode);
    
    parent.removeChild(textNode);
    this.highlightElements.push(highlightSpan);
    
    // Scroll to keep highlighted text visible
    this.scrollToHighlight(highlightSpan);
  }

  private scrollToHighlight(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const hudHeight = 400; // Approximate HUD height
    
    // Check if element is outside comfortable viewing area
    if (rect.top < 100 || rect.bottom > viewportHeight - hudHeight - 100) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }

  private clearHighlights(): void {
    this.highlightElements.forEach(element => {
      const parent = element.parentElement;
      if (parent) {
        const textNode = document.createTextNode(element.textContent || '');
        parent.replaceChild(textNode, element);
        parent.normalize();
      }
    });
    this.highlightElements = [];
  }

  private async initializeVapi(): Promise<void> {
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
      const endIndex = this.currentIndex + this.settings.wordsPerDisplay - 1;
      this.highlightWords(this.currentIndex, endIndex);
      
      this.currentIndex += this.settings.wordsPerDisplay;
      
      if (this.currentIndex >= this.words.length) {
        this.stopVisualReading();
        return;
      }
      
      this.updateProgress();
      this.updateUI();
    }, delay);

    // Highlight first words immediately
    this.highlightWords(this.currentIndex, this.currentIndex + this.settings.wordsPerDisplay - 1);
  }

  private stopVisualReading(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
    this.isPlaying = false;
    this.clearHighlights();
  }

  private startVoiceReading(): void {
    this.voiceStatus = 'connecting';
    this.updateUI();
    
    setTimeout(() => {
      this.voiceStatus = 'speaking';
      this.isPlaying = true;
      this.updateUI();
      
      // Simulate voice reading with highlighting
      const voiceDelay = (60000 / this.settings.wpm) * 3; // Slower for voice
      this.intervalRef = window.setInterval(() => {
        this.highlightWords(this.currentIndex, this.currentIndex + 2);
        this.currentIndex += 3;
        
                 if (this.currentIndex >= this.words.length) {
           this.stopVoiceReading();
           return;
         }
         
         this.updateProgress();
         this.updateUI();
      }, voiceDelay);
    }, 1000);
  }

  private stopVoiceReading(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
    this.voiceStatus = 'idle';
    this.isPlaying = false;
    this.clearHighlights();
    this.updateUI();
  }

  private reset(): void {
    this.stopVisualReading();
    this.stopVoiceReading();
    this.currentIndex = 0;
    this.isPlaying = false;
    this.clearHighlights();
    this.updateProgress();
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
    this.clearHighlights();
    if (this.container) {
      this.container.remove();
    }
    if (this.progressBar) {
      this.progressBar.remove();
      this.progressBar = null;
    }
    
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    speedReader = null; // Reset global reference
  }

  public loadText(text: string): void {
    this.words = text.split(/\s+/).filter(word => word.length > 0);
    this.currentIndex = 0;
    this.mapTextToNodes(text);
    this.updateUI();
  }
}

// Global keyboard shortcut handler
let speedReader: TurboReadSpeedReader | null = null;

document.addEventListener('keydown', (e: KeyboardEvent) => {
  // Shift+8 activates speed reader
  if (e.shiftKey && e.key === '*') {
    e.preventDefault();
    
    if (speedReader) {
      return; 
    }
    
    const defaultSettings: Settings = {
      wpm: 300,
      wordsPerDisplay: 3,
      voiceMode: 'visual'
    };
    
    speedReader = new TurboReadSpeedReader(defaultSettings);
    const text = getPageText();
    speedReader.loadText(text);
    
    console.log('TurboRead activated via Shift+8');
  }
});

// Content script message handler
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
    sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

function getPageText(): string {
  // Priority-based content detection
  const contentSelectors = [
    'article',
    'main',
    '[role="main"]',
    '.post-content, .entry-content, .content',
    '.article-body, .story-body',
    '.markdown-body, .md-content',
    '.post, .entry',
    'body'
  ];
  
  let textSource: Element | null = null;
  
  for (const selector of contentSelectors) {
    textSource = document.querySelector(selector);
    if (textSource) {
      // Verify it has substantial text content
      const textLength = (textSource.textContent || '').trim().length;
      if (textLength > 100) break;
    }
  }
  
  if (!textSource) textSource = document.body;
  
  const clonedSource = textSource.cloneNode(true) as HTMLElement;
  
  // Remove non-content elements
  const unwantedSelectors = [
    'script', 'style', 'noscript',
    'nav', 'header', 'footer', 'aside',
    '.navigation', '.menu', '.sidebar',
    '.advertisement', '.ads', '.social-share',
    '.comments', '.comment-section',
    '#turboread-speed-reader',
    '[aria-hidden="true"]'
  ];
  
  unwantedSelectors.forEach(selector => {
    const elements = clonedSource.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });
  
  const text = clonedSource.textContent || clonedSource.innerText || '';
  const cleanedText = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, ' ')
    .trim();
  
  console.log(`TurboRead: Extracted ${cleanedText.split(' ').length} words from ${textSource.tagName}`);
  return cleanedText;
}

console.log('TurboRead content script loaded - Press Shift+8 to activate speed reader'); 