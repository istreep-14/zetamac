// Zetamac Coach Background Script
console.log('Zetamac Coach: Background script loaded');

// Handle installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Zetamac Coach: Extension installed');
    
    // Set default settings
    chrome.storage.sync.set({
      sheetsUrl: '',
      autoUpload: true
    });
  }
});

// Handle messages from content script (for future use)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'sessionComplete') {
    console.log('Session completed:', message.data);
    // Could add additional processing here
  }
});
