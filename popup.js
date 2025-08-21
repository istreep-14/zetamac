// Popup script for Zetamac Coach
document.addEventListener('DOMContentLoaded', async () => {
  // Load current settings
  await loadSettings();
  await loadStats();
  
  // Event listeners
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  document.getElementById('test-connection').addEventListener('click', testConnection);
  document.getElementById('clear-data').addEventListener('click', clearData);
});

async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(['sheetsUrl']);
    if (result.sheetsUrl) {
      document.getElementById('sheets-url').value = result.sheetsUrl;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function saveSettings() {
  const sheetsUrl = document.getElementById('sheets-url').value.trim();
  
  try {
    await chrome.storage.sync.set({ sheetsUrl: sheetsUrl });
    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    showStatus('Error saving settings: ' + error.message, 'error');
  }
}

async function testConnection() {
  const sheetsUrl = document.getElementById('sheets-url').value.trim();
  
  if (!sheetsUrl) {
    showStatus('Please enter a Google Apps Script URL first', 'warning');
    return;
  }
  
  showStatus('Testing connection...', 'warning');
  
  try {
    const testData = {
      timestamp: new Date().toISOString(),
      gameMode: 'test',
      finalScore: 0,
      totalQuestions: 0,
      duration: 0,
      avgResponseTime: 0,
      questions: JSON.stringify([])
    };
    
    const response = await fetch(sheetsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    if (response.ok) {
      showStatus('✅ Connection successful! Test data sent to sheet.', 'success');
    } else {
      showStatus('❌ Connection failed. Status: ' + response.status, 'error');
    }
  } catch (error) {
    showStatus('❌ Connection error: ' + error.message, 'error');
  }
}

async function loadStats() {
  try {
    const result = await chrome.storage.local.get(['sessions']);
    const sessions = result.sessions || [];
    
    if (sessions.length === 0) {
      return;
    }
    
    // Calculate stats
    const totalSessions = sessions.length;
    const bestScore = Math.max(...sessions.map(s => s.finalScore || 0));
    const avgScore = Math.round(sessions.reduce((sum, s) => sum + (s.finalScore || 0), 0) / totalSessions);
    const totalQuestions = sessions.reduce((sum, s) => sum + (s.totalQuestions || 0), 0);
    
    // Update UI
    document.getElementById('total-sessions').textContent = totalSessions;
    document.getElementById('best-score').textContent = bestScore;
    document.getElementById('avg-score').textContent = avgScore;
    document.getElementById('total-questions').textContent = totalQuestions;
    
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

async function clearData() {
  if (confirm('Are you sure you want to clear all local session data? This cannot be undone.')) {
    try {
      await chrome.storage.local.remove(['sessions']);
      await loadStats(); // Refresh display
      showStatus('Local data cleared successfully', 'success');
    } catch (error) {
      showStatus('Error clearing data: ' + error.message, 'error');
    }
  }
}

function showStatus(message, type) {
  const statusEl = document.getElementById('status-message');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.style.display = 'block';
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 3000);
}
