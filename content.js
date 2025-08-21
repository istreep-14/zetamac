// Zetamac Coach Content Script - Fixed Version
console.log('Zetamac Coach: Content script loaded');

class ZetamacCoach {
  constructor() {
    this.gameState = {
      isPlaying: false,
      currentScore: 0,
      startTime: null,
      sessionData: null,
      questionCount: 0,
      lastQuestionTime: null,
      previousQuestion: '' // Track previous question to avoid duplicates
    };
    
    this.config = {
      pollInterval: 200, // Check game state every 200ms
      notificationDuration: 3000 // Auto-dismiss after 3s
    };
    
    this.init();
  }
  
  init() {
    this.createUI();
    this.startMonitoring();
    this.loadSettings();
  }
  
  createUI() {
    // Recording indicator
    this.recordingDot = document.createElement('div');
    this.recordingDot.id = 'zetamac-recording-dot';
    this.recordingDot.innerHTML = '● Recording';
    this.recordingDot.style.display = 'none';
    document.body.appendChild(this.recordingDot);
    
    // Notification container
    this.notificationContainer = document.createElement('div');
    this.notificationContainer.id = 'zetamac-notification';
    document.body.appendChild(this.notificationContainer);
  }
  
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['sheetsUrl', 'autoUpload']);
      this.sheetsUrl = result.sheetsUrl;
      this.autoUpload = result.autoUpload !== false; // Default to true
      console.log('Zetamac Coach: Settings loaded', { sheetsUrl: !!this.sheetsUrl, autoUpload: this.autoUpload });
    } catch (error) {
      console.log('Zetamac Coach: No settings found, first run');
    }
  }
  
  startMonitoring() {
    setInterval(() => {
      this.checkGameState();
    }, this.config.pollInterval);
  }
  
  checkGameState() {
    const timer = document.querySelector('#timer');
    const score = document.querySelector('#nbrs');
    const question = document.querySelector('#question');
    
    if (!timer || !score || !question) {
      console.log('Zetamac Coach: Required elements not found', { 
        timer: !!timer, 
        score: !!score, 
        question: !!question 
      });
      return;
    }
    
    const timerValue = parseInt(timer.textContent) || 0;
    const scoreValue = parseInt(score.textContent) || 0;
    const questionText = question.textContent.trim();
    
    // Game started - timer is counting down and greater than 0
    if (timerValue > 0 && timerValue < 120 && !this.gameState.isPlaying) {
      this.startGame(timerValue, scoreValue, questionText);
    }
    
    // Game ended - timer reached 0 while we were playing
    if (timerValue === 0 && this.gameState.isPlaying) {
      this.endGame(scoreValue);
    }
    
    // Question answered - score increased or question changed
    if (this.gameState.isPlaying && 
        (scoreValue > this.gameState.currentScore || 
         (questionText !== this.gameState.previousQuestion && questionText !== ''))) {
      this.questionAnswered(scoreValue, questionText);
    }
    
    // Update current state
    if (this.gameState.isPlaying) {
      this.gameState.currentScore = scoreValue;
      this.gameState.previousQuestion = questionText;
    }
  }
  
  startGame(timer, score, question) {
    console.log('Zetamac Coach: Game started', { timer, score, question });
    
    const now = Date.now();
    this.gameState.isPlaying = true;
    this.gameState.startTime = now;
    this.gameState.currentScore = score;
    this.gameState.questionCount = 0;
    this.gameState.lastQuestionTime = now;
    this.gameState.previousQuestion = question;
    
    // Initialize session data
    this.gameState.sessionData = {
      startTime: this.gameState.startTime,
      gameMode: this.detectGameMode(),
      questions: [],
      duration: timer * 1000, // Convert to milliseconds
      initialScore: score
    };
    
    // Show recording indicator
    this.recordingDot.style.display = 'block';
    
    // Log first question if exists
    if (question && question !== '') {
      this.questionAnswered(score, question);
    }
  }
  
  questionAnswered(newScore, questionText) {
    if (!questionText || questionText === '') {
      return; // Skip empty questions
    }
    
    const now = Date.now();
    const responseTime = now - this.gameState.lastQuestionTime;
    
    this.gameState.questionCount++;
    
    // Store question data
    const questionData = {
      question: questionText,
      responseTime: responseTime,
      timestamp: this.gameState.lastQuestionTime,
      questionNumber: this.gameState.questionCount,
      score: newScore
    };
    
    this.gameState.sessionData.questions.push(questionData);
    this.gameState.lastQuestionTime = now;
    
    console.log(`Zetamac Coach: Question ${this.gameState.questionCount}: ${questionText} (${responseTime}ms) Score: ${newScore}`);
  }
  
  async endGame(finalScore) {
    console.log('Zetamac Coach: Game ended', { finalScore });
    
    this.gameState.isPlaying = false;
    this.recordingDot.style.display = 'none';
    
    // Finalize session data
    const endTime = Date.now();
    const totalTime = endTime - this.gameState.startTime;
    
    const sessionData = {
      ...this.gameState.sessionData,
      endTime: endTime,
      actualDuration: totalTime,
      finalScore: finalScore,
      totalQuestions: this.gameState.questionCount,
      avgResponseTime: this.calculateAverageResponseTime(),
      scoreGained: finalScore - (this.gameState.sessionData.initialScore || 0)
    };
    
    console.log('Zetamac Coach: Session data prepared:', sessionData);
    
    // Save to local storage
    await this.saveSession(sessionData);
    
    // Send to Google Sheets if configured and auto-upload is enabled
    if (this.sheetsUrl && this.autoUpload) {
      console.log('Zetamac Coach: Sending to Google Sheets...');
      await this.sendToGoogleSheets(sessionData);
    } else {
      console.log('Zetamac Coach: Skipping Google Sheets upload', { 
        hasUrl: !!this.sheetsUrl, 
        autoUpload: this.autoUpload 
      });
    }
    
    // Show notification
    this.showNotification(sessionData);
  }
  
  calculateAverageResponseTime() {
    if (this.gameState.sessionData.questions.length === 0) return 0;
    
    const totalTime = this.gameState.sessionData.questions
      .reduce((sum, q) => sum + (q.responseTime || 0), 0);
    
    return Math.round(totalTime / this.gameState.sessionData.questions.length);
  }
  
  detectGameMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const key = urlParams.get('key');
    
    // Check URL parameters for game mode
    if (key) return key;
    
    // Check for arithmetic mode indicators
    const currentUrl = window.location.href;
    if (currentUrl.includes('arithmetic')) return 'arithmetic';
    
    return 'default';
  }
  
  async saveSession(sessionData) {
    try {
      // Get existing sessions
      const result = await chrome.storage.local.get(['sessions']);
      const sessions = result.sessions || [];
      
      // Add new session with timestamp for easy identification
      const sessionWithId = {
        ...sessionData,
        id: Date.now(),
        saved: new Date().toISOString()
      };
      
      sessions.push(sessionWithId);
      
      // Keep only last 100 sessions locally (increased from 50)
      if (sessions.length > 100) {
        sessions.splice(0, sessions.length - 100);
      }
      
      // Save back to storage
      await chrome.storage.local.set({ sessions: sessions });
      
      console.log('Zetamac Coach: Session saved locally', { sessionId: sessionWithId.id });
    } catch (error) {
      console.error('Zetamac Coach: Error saving session:', error);
    }
  }
  
  async sendToGoogleSheets(sessionData) {
    if (!this.sheetsUrl) {
      console.log('Zetamac Coach: No Google Sheets URL configured');
      return;
    }
    
    try {
      // Prepare payload with all necessary data
      const payload = {
        timestamp: new Date(sessionData.startTime).toISOString(),
        gameMode: sessionData.gameMode || 'unknown',
        finalScore: sessionData.finalScore || 0,
        totalQuestions: sessionData.totalQuestions || 0,
        duration: Math.round((sessionData.actualDuration || 0) / 1000), // Convert to seconds
        avgResponseTime: sessionData.avgResponseTime || 0,
        scoreGained: sessionData.scoreGained || 0,
        questionsData: JSON.stringify(sessionData.questions || []), // Raw question data
        sessionId: sessionData.id || Date.now()
      };
      
      console.log('Zetamac Coach: Sending payload to Sheets:', payload);
      
      // Send through background script to avoid CORS issues
      const response = await chrome.runtime.sendMessage({
        type: 'sendToSheets',
        url: this.sheetsUrl,
        data: payload
      });
      
      console.log('Zetamac Coach: Sheets response:', response);
      
      if (response && response.success) {
        console.log('Zetamac Coach: Data sent to Google Sheets successfully');
        this.showStatus('✅ Data sent to Google Sheets', 'success');
      } else {
        console.error('Zetamac Coach: Failed to send to Google Sheets:', response?.error || 'Unknown error');
        this.showStatus('❌ Failed to send to Google Sheets: ' + (response?.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Zetamac Coach: Error sending to Google Sheets:', error);
      this.showStatus('❌ Error sending to Google Sheets: ' + error.message, 'error');
    }
  }
  
  showNotification(sessionData) {
    const notification = document.createElement('div');
    notification.className = 'zetamac-notification-popup';
    
    const questionsPerMinute = sessionData.actualDuration > 0 ? 
      Math.round((sessionData.totalQuestions / (sessionData.actualDuration / 1000)) * 60) : 0;
    
    notification.innerHTML = `
      <div class="notification-header">🎯 Session Complete!</div>
      <div class="notification-stats">
        <div>Score: <strong>${sessionData.finalScore}</strong></div>
        <div>Questions: <strong>${sessionData.totalQuestions}</strong></div>
        <div>Avg Time: <strong>${sessionData.avgResponseTime}ms</strong></div>
        <div>Rate: <strong>${questionsPerMinute}/min</strong></div>
        ${this.sheetsUrl ? '<div style="grid-column: span 2; text-align: center; font-size: 12px; color: #6c757d; margin-top: 8px;">📊 Data sent to Google Sheets</div>' : ''}
      </div>
    `;
    
    this.notificationContainer.appendChild(notification);
    
    // Auto-dismiss
    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.add('fade-out');
        setTimeout(() => {
          notification.remove();
        }, 500);
      }
    }, this.config.notificationDuration);
  }
  
  showStatus(message, type) {
    console.log(`Zetamac Coach Status (${type}):`, message);
    
    // Create a temporary status element
    const statusEl = document.createElement('div');
    statusEl.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      z-index: 10002;
      padding: 10px 15px;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 300px;
      word-wrap: break-word;
      ${type === 'success' ? 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : ''}
      ${type === 'error' ? 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;' : ''}
    `;
    statusEl.textContent = message;
    
    document.body.appendChild(statusEl);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (statusEl.parentNode) {
        statusEl.remove();
      }
    }, 4000);
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ZetamacCoach();
  });
} else {
  new ZetamacCoach();
}
