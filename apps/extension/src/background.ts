// Background script for TurboRead Chrome Extension
// Handles extension lifecycle, context menus, and global functionality

interface Settings {
  wpm: number;
  wordsPerDisplay: number;
  voiceMode: 'visual' | 'voice';
  vapiPublicKey?: string;
}

class BackgroundController {
  private defaultSettings: Settings = {
    wpm: 300,
    wordsPerDisplay: 1,
    voiceMode: 'visual'
  };

  constructor() {
    this.init();
  }

  private init(): void {
    this.setupEventListeners();
    this.setupContextMenus();
    this.initializeSettings();
  }

  private setupEventListeners(): void {
    // Extension installation/update
    chrome.runtime.onInstalled.addListener((details) => {
      console.log('TurboRead extension installed/updated', details);
      
      if (details.reason === 'install') {
        this.handleFirstInstall();
      } else if (details.reason === 'update') {
        this.handleUpdate(details.previousVersion);
      }
    });

    // Extension startup
    chrome.runtime.onStartup.addListener(() => {
      console.log('TurboRead extension started');
    });

    // Handle messages from content scripts or popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Handle browser action click (when popup is not available)
    chrome.action.onClicked.addListener((tab) => {
      this.handleBrowserActionClick(tab);
    });
  }

  private async setupContextMenus(): Promise<void> {
    try {
      // Remove existing context menus
      await chrome.contextMenus.removeAll();

      // Add context menu for selected text
      chrome.contextMenus.create({
        id: 'turboread-selected',
        title: '⚡ Read with TurboRead',
        contexts: ['selection'],
        documentUrlPatterns: ['http://*/*', 'https://*/*']
      });

      // Add context menu for entire page
      chrome.contextMenus.create({
        id: 'turboread-page',
        title: '⚡ Speed Read This Page',
        contexts: ['page'],
        documentUrlPatterns: ['http://*/*', 'https://*/*']
      });

      // Handle context menu clicks
      chrome.contextMenus.onClicked.addListener((info, tab) => {
        this.handleContextMenuClick(info, tab);
      });

    } catch (error) {
      console.error('Error setting up context menus:', error);
    }
  }

  private async initializeSettings(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['turboreadSettings']);
      
      if (!result.turboreadSettings) {
        // First time setup - save default settings
        await chrome.storage.sync.set({ 
          turboreadSettings: this.defaultSettings 
        });
        console.log('Default settings initialized');
      }
    } catch (error) {
      console.error('Error initializing settings:', error);
    }
  }

  private handleFirstInstall(): void {
    console.log('Welcome to TurboRead! First time installation.');
    
    // Could show welcome page or tutorial here
    // chrome.tabs.create({ url: 'welcome.html' });
  }

  private handleUpdate(previousVersion?: string): void {
    console.log(`TurboRead updated from version ${previousVersion}`);
    
    // Handle any migration logic here if needed
    // For example, updating settings schema
  }

  private async handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): Promise<void> {
    try {
      switch (message.action) {
        case 'getSettings':
          const settings = await this.getSettings();
          sendResponse({ success: true, settings });
          break;

        case 'saveSettings':
          await this.saveSettings(message.settings);
          sendResponse({ success: true });
          break;

        case 'openPopup':
          // Could trigger popup programmatically if needed
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  private async handleBrowserActionClick(tab: chrome.tabs.Tab): Promise<void> {
    if (!tab.id) return;

    try {
      // Get current settings
      const settings = await this.getSettings();

      // Inject content script and activate speed reader
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      // Send activation message
      await chrome.tabs.sendMessage(tab.id, {
        action: 'activate',
        settings: settings
      });

    } catch (error) {
      console.error('Error handling browser action click:', error);
    }
  }

  private async handleContextMenuClick(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab): Promise<void> {
    if (!tab?.id) return;

    try {
      const settings = await this.getSettings();

      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      let action = 'activate';
      
      switch (info.menuItemId) {
        case 'turboread-selected':
          action = 'readSelected';
          break;
        case 'turboread-page':
          action = 'readPage';
          break;
      }

      // Send message to content script
      await chrome.tabs.sendMessage(tab.id, {
        action: action,
        settings: settings,
        selectedText: info.selectionText || ''
      });

    } catch (error) {
      console.error('Error handling context menu click:', error);
    }
  }

  private async getSettings(): Promise<Settings> {
    try {
      const result = await chrome.storage.sync.get(['turboreadSettings']);
      return result.turboreadSettings || this.defaultSettings;
    } catch (error) {
      console.error('Error getting settings:', error);
      return this.defaultSettings;
    }
  }

  private async saveSettings(settings: Settings): Promise<void> {
    try {
      await chrome.storage.sync.set({ turboreadSettings: settings });
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }
}

// Initialize background controller
const backgroundController = new BackgroundController();

// Export for potential future use
export default backgroundController; 