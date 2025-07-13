interface Settings {
  wpm: number;
  wordsPerDisplay: number;
}

interface MessageData {
  action: string;
  settings?: Settings;
  text?: string;
}

interface WordPosition {
  word: string;
  textNode: Text;
  startOffset: number;
  endOffset: number;
  globalIndex: number;
}

class TurboReadSpeedReader {
  private words: string[] = [];
  private wordPositions: WordPosition[] = [];
  private currentIndex: number = 0;
  private isPlaying: boolean = false;
  private settings: Settings;
  private position = { x: 100, y: 100 };
  private intervalRef: number | null = null;
  private container: HTMLElement | null = null;
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
        <div class="turboread-header">
          <h3 class="turboread-title">TurboReader</h3>
          <div class="turboread-header-controls">
            <div class="turboread-badge">Visual</div>
            <button id="close-btn" class="turboread-close-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="turboread-word-display">
          <div class="turboread-word-text">Ready to read...</div>
          <div class="turboread-word-progress">
            <input id="start-index-input" type="number" min="1" value="1" class="turboread-number-input" />
            <span> of </span>
            <span id="total-words">0</span>
            <span> words</span>
          </div>
        </div>
        
        <div class="turboread-controls">
          <div class="turboread-setting-row">
            <label class="turboread-setting-label" for="wpm-input">Words Per Minute (A/D)</label>
            <input type="number" id="wpm-input" min="50" max="1000" value="${this.settings.wpm}" class="turboread-number-input" />
          </div>

          <div class="turboread-setting-row">
            <label class="turboread-setting-label" for="words-input">Words Per Display (J/K)</label>
            <input type="number" id="words-input" min="1" max="10" value="${this.settings.wordsPerDisplay}" class="turboread-number-input" />
          </div>
          
          <div class="turboread-button-container">
            <button id="play-btn" class="turboread-btn turboread-btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5,3 19,12 5,21"></polygon>
              </svg>
              Play
            </button>
            <button id="reset-btn" class="turboread-btn turboread-btn-secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="1,4 1,10 7,10"></polyline>
                <path d="M3.51,15a9,9,0,0,0,2.13,3.09,9,9,0,0,0,13.72,0,9,9,0,0,0,0-12.72,9,9,0,0,0-9.85-2"></path>
              </svg>
              Reset
            </button>
          </div>
        </div>
        
        <div class="turboread-instructions">
          V: voice mode • Space: play/pause • mouse/arrows: move • ESC: close
        </div>
      </div>
    `;
  }

  private applyStyles(): void {
    if (!this.container) return;

    const oldStyles = document.getElementById('turboread-styles');
    if (oldStyles) oldStyles.remove();

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
          position: fixed !important;
          z-index: 2147483647 !important;
          font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          user-select: none !important;
          pointer-events: auto !important;
        }
        
        .turboread-hud {
          width: 320px !important;
          background: linear-gradient(135deg, rgba(100, 21, 255, 0.85) 0%, rgba(88, 28, 135, 0.85) 100%) !important;
          /* Slate glass background */
          background: rgba(30, 41, 59, 0.6) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          border: 1px solid rgba(71, 85, 105, 0.3) !important;
          border-radius: 16px !important;
          padding: 20px !important;
          color: white !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2) !important;
          cursor: move !important;
          font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
        
        .turboread-header {
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          margin-bottom: 20px !important;
        }
        
        .turboread-title {
          margin: 0 !important;
          font-family: 'Instrument Serif', serif !important;
          font-size: 24px !important;
          font-weight: 700 !important;
          letter-spacing: -0.5px !important;
          color: white !important;
        }
        
        .turboread-header-controls {
          display: flex !important;
          gap: 8px !important;
        }
        
        .turboread-badge {
          background-color: rgba(31, 41, 55, 0.8);
          color: white;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
          border: 1px solid rgba(71, 85, 105, 0.6);
        }

        .turboread-close-btn {
          background: rgba(239, 68, 68, 0.15) !important;
          border: 1px solid rgba(239, 68, 68, 0.3) !important;
          color: rgb(248, 113, 113) !important;
          width: 32px !important;
          height: 32px !important;
          border-radius: 8px !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: all 0.2s ease !important;
        }
        
        .turboread-close-btn:hover {
          background: rgba(239, 68, 68, 0.25) !important;
          border-color: rgba(239, 68, 68, 0.5) !important;
          color: rgb(252, 165, 165) !important;
        }
        
        .turboread-word-display {
          min-height: 120px !important;
          background: rgba(0, 0, 0, 0.25) !important;
          background: rgba(51, 65, 85, 0.5) !important;
          border: 1px solid rgba(71, 85, 105, 0.2) !important;
          border-radius: 12px !important;
          padding: 24px !important;
          margin-bottom: 24px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: center !important;
          text-align: center !important;
        }
        
        .turboread-word-text {
          font-size: 24px !important;
          font-weight: 700 !important;
          margin-bottom: 12px !important;
          min-height: 32px !important;
          line-height: 1.2 !important;
          word-wrap: break-word !important;
          max-width: 100% !important;
          color: rgb(34, 197, 94) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        
        .turboread-word-progress {
          font-size: 14px !important;
          color: rgba(255, 255, 255, 0.7) !important;
          font-weight: 500 !important;
          background: rgba(31, 41, 55, 0.8) !important;
          padding: 6px 20px !important;
          border-radius: 8px !important;
          margin-top: 8px !important;
        }
        
        .turboread-controls {
          margin-bottom: 20px !important;
        }
        
        .turboread-setting-group {
          margin-bottom: 20px !important;
        }

        .turboread-setting-label {
          font-size: 14px !important;
          font-weight: 600 !important;
          color: rgba(255, 255, 255, 0.9) !important;
          margin-bottom: 12px !important;
          display: block !important;
        }
        
        .turboread-slider-container {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
        }
        
        .turboread-slider {
          flex: 1 !important;
          height: 6px !important;
          background: rgba(71, 85, 105, 0.4) !important;
          border-radius: 6px !important;
          outline: none !important;
          border: none !important;
          cursor: pointer !important;
          appearance: none !important;
        }
        
        .turboread-slider::-webkit-slider-thumb {
          appearance: none !important;
          width: 18px !important;
          height: 18px !important;
          background: rgb(147, 197, 253) !important; /* sky-300 */
          border-radius: 50% !important;
          cursor: pointer !important;
          border: 2px solid white !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
          transition: all 0.2s ease !important;
        }
        
        .turboread-slider::-webkit-slider-thumb:hover {
          background: rgb(96, 165, 250) !important; /* sky-400 */
          transform: scale(1.1) !important;
        }
        
        .turboread-slider-value {
          font-size: 14px !important;
          min-width: 45px !important;
          text-align: center !important;
          color: white !important;
          font-weight: 600 !important;
          background: rgba(71, 85, 105, 0.5) !important;
          padding: 6px 10px !important;
          border-radius: 8px !important;
          border: 1px solid rgba(71, 85, 105, 0.3) !important;
        }
        
        .turboread-button-container {
          display: flex !important;
          gap: 12px !important;
          justify-content: center !important;
          margin-top: 24px !important;
        }
        
        .turboread-btn {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          padding: 12px 18px !important;
          border: none !important;
          border-radius: 10px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          flex: 1 !important;
          justify-content: center !important;
          border: 1px solid transparent !important;
        }
        
        .turboread-btn-primary {
          background: rgba(34, 197, 94, 0.9) !important;
          color: white !important;
          border-color: rgba(34, 197, 94, 0.3) !important;
        }
        
        .turboread-btn-primary:hover {
          background: rgb(34, 197, 94) !important;
          border-color: rgba(34, 197, 94, 0.5) !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 8px rgba(34, 197, 94, 0.3) !important;
        }
        
        .turboread-btn-secondary {
          background: rgba(59, 130, 246, 0.9) !important;
          color: white !important;
          border-color: rgba(59, 130, 246, 0.3) !important;
        }
        
        .turboread-btn-secondary:hover {
          background: rgb(59, 130, 246) !important;
          border-color: rgba(59, 130, 246, 0.5) !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3) !important;
        }
        
        .turboread-instructions {
          text-align: center !important;
          font-size: 12px !important;
          color: rgba(255, 255, 255, 0.6) !important;
          font-weight: 500 !important;
          letter-spacing: 0.025em !important;
        }

        /* rows for settings */
        .turboread-setting-row {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 16px !important;
          margin-bottom: 20px !important;
        }
        .turboread-setting-label {
          font-size: 14px !important;
          font-weight: 600 !important;
          color: rgba(255, 255, 255, 0.9) !important;
          margin: 0 !important;
        }
        
        .turboread-reading-progress {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          height: 3px !important;
          background: linear-gradient(90deg, #22c55e, #16a34a) !important;
          z-index: 2147483646 !important;
          transition: width 0.3s ease !important;
          box-shadow: 0 0 10px rgba(34, 197, 94, 0.5) !important;
        }

        .turboread-highlight {
          background-color: rgba(255, 235, 59, 0.6) !important;
          transition: background-color 0.2s ease !important;
          border-radius: 2px !important;
          padding: 1px 2px !important;
          margin: -1px -2px !important;
        }

        .turboread-number-input {
          width: 50px !important;
          padding: 3px 4px !important;
          border-radius: 8px !important;
          border: 1px solid rgba(71, 85, 105, 0.3) !important;
          background: rgba(71, 85, 105, 0.5) !important;
          color: white !important;
          text-align: center !important;
          font-weight: 600 !important;
        }
        /* remove spin buttons */
        .turboread-number-input::-webkit-inner-spin-button,
        .turboread-number-input::-webkit-outer-spin-button {
          -webkit-appearance: none !important;
          margin: 0 !important;
        }
        .turboread-number-input {
          -moz-appearance: textfield !important; /* Firefox */
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

    const wpmInput = this.container.querySelector('#wpm-input') as HTMLInputElement;
    const wordsInput = this.container.querySelector('#words-input') as HTMLInputElement;

    const startIndexInput = this.container.querySelector('#start-index-input') as HTMLInputElement;

    playBtn?.addEventListener('click', () => this.togglePlayPause());
    resetBtn?.addEventListener('click', () => this.reset());
    closeBtn?.addEventListener('click', () => this.close());

    const handleWpmChange = (value: number) => {
      this.settings.wpm = Math.max(50, Math.min(1000, value));
      this.updateSliderValues();
      if (this.isPlaying) {
        this.stopReading();
        this.startReading();
      }
    };

    const handleWordsChange = (value: number) => {
      this.settings.wordsPerDisplay = Math.max(1, Math.min(10, value));
      this.updateSliderValues();
      this.updateUI();
    };

    wpmInput?.addEventListener('input', (e) => handleWpmChange(parseInt((e.target as HTMLInputElement).value)));
    wordsInput?.addEventListener('input', (e) => handleWordsChange(parseInt((e.target as HTMLInputElement).value)));

    startIndexInput?.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      if (!isNaN(value)) {
        this.currentIndex = Math.max(0, Math.min(this.words.length - 1, value - 1));
        this.updateProgress();
        this.updateUI();
      }
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
      // Move HUD with arrow keys
      case 'ArrowUp':
        e.preventDefault();
        this.position.y = Math.max(0, this.position.y - 25);
        this.updatePosition();
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.position.y = Math.min(window.innerHeight - 400, this.position.y + 25);
        this.updatePosition();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.position.x = Math.max(0, this.position.x - 25);
        this.updatePosition();
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.position.x = Math.min(window.innerWidth - 320, this.position.x + 25);
        this.updatePosition();
        break;
      // Adjust speed (A/D)
      case 'a':
      case 'A':
        e.preventDefault();
        this.settings.wpm = Math.max(50, this.settings.wpm - 10);
        this.updateSliderValues();
        if (this.isPlaying) {
          this.stopReading();
          this.startReading();
        }
        break;
      case 'd':
      case 'D':
        e.preventDefault();
        this.settings.wpm = Math.min(1000, this.settings.wpm + 10);
        this.updateSliderValues();
        if (this.isPlaying) {
          this.stopReading();
          this.startReading();
        }
        break;
      // Adjust words per display (H/K)
      case 'j':
      case 'J':
        e.preventDefault();
        this.settings.wordsPerDisplay = Math.max(1, this.settings.wordsPerDisplay - 1);
        this.updateSliderValues();
        this.updateUI();
        break;
      case 'k':
      case 'K':
        e.preventDefault();
        this.settings.wordsPerDisplay = Math.min(10, this.settings.wordsPerDisplay + 1);
        this.updateSliderValues();
        this.updateUI();
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
    this.progressBar.className = 'turboread-reading-progress';
    this.progressBar.style.width = '0%';
    document.body.appendChild(this.progressBar);
  }

  private updateProgress(): void {
    if (!this.progressBar || this.words.length === 0) return;
    
    const progress = Math.min(100, (this.currentIndex / this.words.length) * 100);
    this.progressBar.style.width = `${progress}%`;
  }

  private updateSliderValues(): void {
    if (!this.container) return;

    const wpmInput = this.container.querySelector('#wpm-input') as HTMLInputElement;
    const wordsInput = this.container.querySelector('#words-input') as HTMLInputElement;

    if (wpmInput) wpmInput.value = this.settings.wpm.toString();
    if (wordsInput) wordsInput.value = this.settings.wordsPerDisplay.toString();
  }

  private updateUI(): void {
    if (!this.container) return;

    const wordText = this.container.querySelector('.turboread-word-text') as HTMLElement;
    const startIndexInput = this.container.querySelector('#start-index-input') as HTMLInputElement;
    const totalWordsSpan = this.container.querySelector('#total-words') as HTMLElement;
    const playBtn = this.container.querySelector('#play-btn') as HTMLButtonElement;

    if (wordText) {
      if (this.words.length === 0) {
        wordText.textContent = 'Ready to read...';
      } else {
        const displayText = this.words.slice(this.currentIndex, this.currentIndex + this.settings.wordsPerDisplay).join(' ');
        wordText.textContent = displayText || 'Completed!';
      }
    }

    if (startIndexInput) startIndexInput.value = (this.currentIndex + 1).toString();
    if (totalWordsSpan) totalWordsSpan.textContent = this.words.length.toString();

    if (playBtn) {
      const playIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5,3 19,12 5,21"></polygon></svg>`;
      const pauseIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
      
      playBtn.innerHTML = this.isPlaying ? `${pauseIcon} Pause` : `${playIcon} Play`;
    }

    this.updateSliderValues();
  }

  private mapWordsToDOM(text: string): void {
    this.wordPositions = [];
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

    let globalWordIndex = 0;
    let textNode: Text | null;
    
    while (textNode = walker.nextNode() as Text) {
      const nodeText = textNode.textContent || '';
      const words = nodeText.match(/\S+/g) || [];
      
      let searchIndex = 0;
      for (const word of words) {
        const wordStart = nodeText.indexOf(word, searchIndex);
        if (wordStart !== -1) {
          this.wordPositions.push({
            word,
            textNode,
            startOffset: wordStart,
            endOffset: wordStart + word.length,
            globalIndex: globalWordIndex
          });
          globalWordIndex++;
          searchIndex = wordStart + word.length;
        }
      }
    }
  }

  private highlightWords(startIndex: number, endIndex: number): void {
    this.clearHighlights();
    
    for (let i = startIndex; i <= Math.min(endIndex, this.wordPositions.length - 1); i++) {
      const wordPos = this.wordPositions[i];
      if (wordPos) {
        this.highlightSingleWord(wordPos);
      }
    }
    
    // Scroll to first highlighted word
    if (this.highlightElements.length > 0) {
      this.scrollToHighlight(this.highlightElements[0]);
    }
  }

  private highlightSingleWord(wordPos: WordPosition): void {
    const range = document.createRange();
    range.setStart(wordPos.textNode, wordPos.startOffset);
    range.setEnd(wordPos.textNode, wordPos.endOffset);
    
    try {
      const span = document.createElement('span');
      span.className = 'turboread-highlight';
      range.surroundContents(span);
      this.highlightElements.push(span);
    } catch (error) {
      // If range can't be surrounded, create a manual highlight
      const span = document.createElement('span');
      span.className = 'turboread-highlight';
      span.textContent = wordPos.word;
      
      const beforeText = wordPos.textNode.textContent?.substring(0, wordPos.startOffset) || '';
      const afterText = wordPos.textNode.textContent?.substring(wordPos.endOffset) || '';
      
      const parent = wordPos.textNode.parentNode;
      if (parent) {
        if (beforeText) parent.insertBefore(document.createTextNode(beforeText), wordPos.textNode);
        parent.insertBefore(span, wordPos.textNode);
        if (afterText) parent.insertBefore(document.createTextNode(afterText), wordPos.textNode);
        parent.removeChild(wordPos.textNode);
        this.highlightElements.push(span);
      }
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

  private scrollToHighlight(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const hudHeight = 400;
    
    if (rect.top < 100 || rect.bottom > viewportHeight - hudHeight - 100) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }

  private togglePlayPause(): void {
    if (this.words.length === 0) return;

    this.isPlaying = !this.isPlaying;
    
    if (this.isPlaying) {
      this.startReading();
    } else {
      this.stopReading();
    }
    
    this.updateUI();
  }

  private startReading(): void {
    if (this.intervalRef) return;

    const delay = 60000 / this.settings.wpm;

    // Show the first chunk immediately
    this.updateProgress();
    this.updateUI();

    this.intervalRef = window.setInterval(() => {
      this.currentIndex += this.settings.wordsPerDisplay;

      if (this.currentIndex >= this.words.length) {
        this.stopReading();
        return;
      }

      this.updateProgress();
      this.updateUI();
    }, delay);
  }

  private stopReading(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
    this.isPlaying = false;
  }

  private reset(): void {
    this.stopReading();
    this.currentIndex = 0;
    this.isPlaying = false;
    this.updateProgress();
    this.updateUI();
  }

  private close(): void {
    this.stopReading();
    if (this.container) {
      this.container.remove();
    }
    if (this.progressBar) {
      this.progressBar.remove();
      this.progressBar = null;
    }

    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    speedReader = null;
  }

  public loadText(text: string): void {
    this.words = text.split(/\s+/).filter(word => word.length > 0);
    this.currentIndex = 0;
    this.updateProgress();
    this.updateUI();
  }
}

// Global keyboard shortcut handler
let speedReader: TurboReadSpeedReader | null = null;

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.shiftKey && e.key === '*') {
    e.preventDefault();
    
    if (speedReader) {
      return; 
    }
    
    const defaultSettings: Settings = {
      wpm: 300,
      wordsPerDisplay: 3
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
      const textLength = (textSource.textContent || '').trim().length;
      if (textLength > 100) break;
    }
  }
  
  if (!textSource) textSource = document.body;
  
  const clonedSource = textSource.cloneNode(true) as HTMLElement;
  
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

console.log('TurboRead content script loaded - Press Shift+8 to activate turboreader'); 