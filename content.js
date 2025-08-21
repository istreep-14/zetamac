// Zetamac Coach Content Script
console.log('Zetamac Coach: Content script loaded');

class ZetamacCoach {
  constructor() {
    this.gameState = {
      isPlaying: false,
      currentScore: 0,
      startTime: null,
      sessionData: null,
      questionCount: 0,
      lastQuestionTime: null
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
      const result = await chrome.storage.sync.get(['sheetsUrl']);
      this.sheetsUrl = result.sheetsUrl;
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
    
    if (!timer || !score || !question) return;
    
    const timerValue = parseInt(timer.textContent);
    const scoreValue = parseInt(score.textContent);
    const questionText = question.textContent.trim();
    
    // Game started
    if (timerValue > 0 && !this.gameState.isPlaying) {
      this.startGame(timerValue, scoreValue, questionText);
    }
    
    // Game ended
    if (timerValue === 0 && this.gameState.isPlaying) {
      this.endGame(scoreValue);
    }
    
    // Question answered (score increased)
    if (this.gameState.isPlaying && scoreValue > this.gameState.currentScore) {
      this.questionAnswered(scoreValue, questionText);
    }
    
    // Update current state
    if (this.gameState.isPlaying) {
      this.gameState.currentScore = scoreValue;
    }
  }
  
  startGame(timer, score, question) {
    console.log('Zetamac Coach: Game started');
    
    this.gameState.isPlaying = true;
    this.gameState.startTime = Date.now();
    this.gameState.currentScore = score;
    this.gameState.questionCount = 0;
    this.gameState.lastQuestionTime = Date.now();
    
    // Initialize session data
    this.gameState.sessionData = {
      startTime: this.gameState.startTime,
      gameMode: this.detectGameMode(),
      questions: [],
      duration: timer * 1000 // Convert to milliseconds
    };
    
    // Show recording indicator
    this.recordingDot.style.display = 'block';
  }
  
  questionAnswered(newScore, questionText) {
    const now = Date.now();
    const responseTime = now - this.gameState.lastQuestionTime;
    
    this.gameState.questionCount++;
    
    // Store question data
    const questionData = {
      question: questionText,
      responseTime: responseTime,
      timestamp: this.gameState.lastQuestionTime,
      questionNumber: this.gameState.questionCount
    };
    
    this.gameState.sessionData.questions.push(questionData);
    this.gameState.lastQuestionTime = now;
    
    console.log(`Question ${this.gameState.questionCount}: ${questionText} (${responseTime}ms)`);
  }
  
  async endGame(finalScore) {
    console.log('Zetamac Coach: Game ended');
    
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
      avgResponseTime: this.calculateAverageResponseTime()
    };
    
    // Save to local storage
    await this.saveSession(sessionData);
    
    // Send to Google Sheets
    if (this.sheetsUrl) {
      await this.sendToGoogleSheets(sessionData);
    }
    
    // Show notification
    this.showNotification(sessionData);
  }
  
  calculateAverageResponseTime() {
    if (this.gameState.sessionData.questions.length === 0) return 0;
    
    const totalTime = this.gameState.sessionData.questions
      .reduce((sum, q) => sum + q.responseTime, 0);
    
    return Math.round(totalTime / this.gameState.sessionData.questions.length);
  }
  
  detectGameMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const key = urlParams.get('key') || 'default';
    
    // Try to determine mode from URL or page elements
    // For now, just return the key - we can enhance this later
    return key;
  }
  
  async saveSession(sessionData) {
    try {
      // Get existing sessions
      const result = await chrome.storage.local.get(['sessions']);
      const sessions = result.sessions || [];
      
      // Add new session
      sessions.push(sessionData);
      
      // Keep only last 50 sessions locally
      if (sessions.length > 50) {
        sessions.splice(0, sessions.length - 50);
      }
      
      // Save back to storage
      await chrome.storage.local.set({ sessions: sessions });
      
      console.log('Zetamac Coach: Session saved locally');
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
      const payload = {
        timestamp: new Date(sessionData.startTime).toISOString(),
        gameMode: sessionData.gameMode,
        finalScore: sessionData.finalScore,
        totalQuestions: sessionData.totalQuestions,
        duration: Math.round(sessionData.actualDuration / 1000), // Convert to seconds
        avgResponseTime: sessionData.avgResponseTime,
        questions: JSON.stringify(sessionData.questions) // Raw question data
      };
      
      // Use form data instead of JSON to avoid CORS preflight
      const formData = new URLSearchParams();
      Object.keys(payload).forEach(key => {
        formData.append(key, payload[key]);
      });
      
      const response = await fetch(this.sheetsUrl, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        console.log('Zetamac Coach: Data sent to Google Sheets');
      } else {
        console.error('Zetamac Coach: Failed to send to Google Sheets:', response.status);
      }
    } catch (error) {
      console.error('Zetamac Coach: Error sending to Google Sheets:', error);
    }
  }
  
  showNotification(sessionData) {
    const notification = document.createElement('div');
    notification.className = 'zetamac-notification-popup';
    
    const questionsPerMinute = Math.round((sessionData.totalQuestions / (sessionData.actualDuration / 1000)) * 60);
    
    notification.innerHTML = `
      <div class="notification-header">🎯 Session Complete!</div>
      <div class="notification-stats">
        <div>Score: <strong>${sessionData.finalScore}</strong></div>
        <div>Questions: <strong>${sessionData.totalQuestions}</strong></div>
        <div>Avg Time: <strong>${sessionData.avgResponseTime}ms</strong></div>
        <div>Rate: <strong>${questionsPerMinute}/min</strong></div>
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
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ZetamacCoach();
  });
} else {
  new ZetamacCoach();
}
