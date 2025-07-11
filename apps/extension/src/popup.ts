interface Settings {
  wpm: number;
  wordsPerDisplay: number;
}

interface MessageData {
  action: string;
  settings?: Settings;
  text?: string;
}

class PopupController {
  private settings: Settings = {
    wpm: 300,
    wordsPerDisplay: 1
  };

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadSettings();
    this.setupEventListeners();
    this.updateUI();
  }

  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['turboreadSettings']);
      if (result.turboreadSettings) {
        this.settings = { ...this.settings, ...result.turboreadSettings };
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      await chrome.storage.sync.set({ turboreadSettings: this.settings });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  private setupEventListeners(): void {
    // Main action buttons
    const activateBtn = document.getElementById('activateReader') as HTMLButtonElement;
    const selectTextBtn = document.getElementById('selectText') as HTMLButtonElement;
    const readPageBtn = document.getElementById('readPage') as HTMLButtonElement;

    // Settings inputs
    const wpmInput = document.getElementById('wpmSetting') as HTMLInputElement;
    const wordsInput = document.getElementById('wordsSetting') as HTMLInputElement;

    // Button event listeners
    activateBtn?.addEventListener('click', () => this.activateSpeedReader());
    selectTextBtn?.addEventListener('click', () => this.readSelectedText());
    readPageBtn?.addEventListener('click', () => this.readFullPage());

    // Settings event listeners
    wpmInput?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      this.settings.wpm = Math.max(50, Math.min(1000, parseInt(target.value) || 300));
      this.saveSettings();
    });

    wordsInput?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      this.settings.wordsPerDisplay = Math.max(1, Math.min(10, parseInt(target.value) || 1));
      this.saveSettings();
    });


  }

  private updateUI(): void {
    // Update input values
    const wpmInput = document.getElementById('wpmSetting') as HTMLInputElement;
    const wordsInput = document.getElementById('wordsSetting') as HTMLInputElement;

    if (wpmInput) wpmInput.value = this.settings.wpm.toString();
    if (wordsInput) wordsInput.value = this.settings.wordsPerDisplay.toString();
  }

  private async sendMessageToContentScript(message: MessageData): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id) {
        this.showStatus('No active tab found', 'error');
        return;
      }

      // Inject content script if not already present
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      // Send message to content script
      await chrome.tabs.sendMessage(tab.id, message);
      
    } catch (error) {
      console.error('Error sending message to content script:', error);
      this.showStatus('Failed to activate speed reader', 'error');
    }
  }

  private async activateSpeedReader(): Promise<void> {
    this.showStatus('Activating speed reader...', 'success');
    
    await this.sendMessageToContentScript({
      action: 'activate',
      settings: this.settings
    });

    // Close popup after activation
    setTimeout(() => window.close(), 500);
  }

  private async readSelectedText(): Promise<void> {
    this.showStatus('Reading selected text...', 'success');
    
    await this.sendMessageToContentScript({
      action: 'readSelected',
      settings: this.settings
    });

    setTimeout(() => window.close(), 500);
  }

  private async readFullPage(): Promise<void> {
    this.showStatus('Reading full page...', 'success');
    
    await this.sendMessageToContentScript({
      action: 'readPage',
      settings: this.settings
    });

    setTimeout(() => window.close(), 500);
  }

  private showStatus(message: string, type: 'success' | 'error'): void {
    const statusElement = document.getElementById('status');
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    statusElement.classList.remove('hidden');

    // Hide status after 3 seconds
    setTimeout(() => {
      statusElement.classList.add('hidden');
    }, 3000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
}); 