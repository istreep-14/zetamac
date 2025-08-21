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

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'sendToSheets') {
    // Handle Google Sheets upload
    handleSheetsUpload(message.url, message.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep message channel open for async response
  }
  
  if (message.type === 'testConnection') {
    // Handle connection test
    handleSheetsUpload(message.url, message.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep message channel open for async response
  }
});

async function handleSheetsUpload(url, data) {
  try {
    const formData = new URLSearchParams();
    Object.keys(data).forEach(key => {
      formData.append(key, data[key]);
    });
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      return { success: true };
    } else {
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}
