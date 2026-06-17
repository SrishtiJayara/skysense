// ===== API Key Manager UI =====
// Provides interface for managing OpenWeatherMap and Groq API keys

class APIKeyManager {
  constructor() {
    this.openWeatherKeyInput = null;
    this.groqKeyInput = null;
    this.statusElement = null;
    this.init();
  }

  init() {
    // Create API key management modal if it doesn't exist
    if (!document.getElementById('apiKeyModal')) {
      this.createAPIKeyModal();
    }
    
    this.setupEventListeners();
  }

  createAPIKeyModal() {
    const modal = document.createElement('div');
    modal.id = 'apiKeyModal';
    modal.className = 'api-key-modal';
    modal.innerHTML = `
      <div class="api-key-overlay">
        <div class="api-key-content">
          <div class="api-key-header">
            <h2>🔑 API Configuration</h2>
            <button class="api-key-close" id="apiKeyClose">✕</button>
          </div>
          
          <div class="api-key-body">
            <!-- OpenWeatherMap API Key -->
            <div class="api-key-section">
              <div class="api-key-section-header">
                <h3>🌍 OpenWeatherMap API</h3>
                <span class="api-key-status" id="owmStatus">Not configured</span>
              </div>
              <p class="api-key-description">
                Optional: Get real-time weather with additional features like air quality and weather alerts.
                <a href="https://openweathermap.org/api" target="_blank">Get free API key →</a>
              </p>
              <div class="api-key-input-group">
                <input 
                  type="password" 
                  id="openWeatherKeyInput" 
                  placeholder="Enter your OpenWeatherMap API key (32 characters)"
                  class="api-key-input"
                />
                <button class="api-key-toggle-btn" id="toggleOWMKey" title="Show/hide key">👁️</button>
              </div>
              <div class="api-key-actions">
                <button class="api-key-btn primary" id="saveOWMKey">Save OpenWeatherMap Key</button>
                <button class="api-key-btn secondary" id="clearOWMKey">Clear</button>
                <button class="api-key-btn secondary" id="testOWMKey">Test Connection</button>
              </div>
              <div class="api-key-info" id="owmInfo"></div>
            </div>

            <!-- Groq API Key -->
            <div class="api-key-section">
              <div class="api-key-section-header">
                <h3>🤖 Groq API (AI Chat)</h3>
                <span class="api-key-status" id="groqStatus">Not configured</span>
              </div>
              <p class="api-key-description">
                Optional: Enable AI-powered weather insights and city comparisons.
                <a href="https://console.groq.com" target="_blank">Get free API key →</a>
              </p>
              <div class="api-key-input-group">
                <input 
                  type="password" 
                  id="groqKeyInput" 
                  placeholder="Enter your Groq API key"
                  class="api-key-input"
                />
                <button class="api-key-toggle-btn" id="toggleGroqKey" title="Show/hide key">👁️</button>
              </div>
              <div class="api-key-actions">
                <button class="api-key-btn primary" id="saveGroqKey">Save Groq Key</button>
                <button class="api-key-btn secondary" id="clearGroqKey">Clear</button>
                <button class="api-key-btn secondary" id="testGroqKey">Test Connection</button>
              </div>
              <div class="api-key-info" id="groqInfo"></div>
            </div>

            <!-- Info Section -->
            <div class="api-key-section info-section">
              <h3>ℹ️ About API Keys</h3>
              <ul>
                <li><strong>Open-Meteo:</strong> Free weather data (no key needed) - always available as fallback</li>
                <li><strong>OpenWeatherMap:</strong> Enhanced real-time data with air quality and alerts</li>
                <li><strong>Groq:</strong> Powers the AI weather assistant for insights and comparisons</li>
                <li>All keys are stored locally in your browser - never sent to our servers</li>
                <li>Keep your API keys private and never share them</li>
              </ul>
            </div>
          </div>

          <div class="api-key-footer">
            <button class="api-key-btn secondary" id="apiKeyCancel">Close</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.addStyles();
  }

  addStyles() {
    if (document.getElementById('apiKeyStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'apiKeyStyles';
    style.textContent = `
      .api-key-modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
      }

      .api-key-modal.open {
        display: flex;
      }

      .api-key-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
      }

      .api-key-content {
        background: var(--bg-primary, #ffffff);
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-width: 600px;
        width: 90%;
        max-height: 85vh;
        overflow-y: auto;
        color: var(--text-primary, #333);
      }

      .api-key-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 24px;
        border-bottom: 1px solid var(--border-color, #e0e0e0);
        background: var(--bg-secondary, #f5f5f5);
      }

      .api-key-header h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
      }

      .api-key-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: background 0.2s;
      }

      .api-key-close:hover {
        background: rgba(0, 0, 0, 0.1);
      }

      .api-key-body {
        padding: 24px;
      }

      .api-key-section {
        margin-bottom: 28px;
        padding-bottom: 24px;
        border-bottom: 1px solid var(--border-color, #e0e0e0);
      }

      .api-key-section:last-of-type {
        border-bottom: none;
      }

      .api-key-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .api-key-section h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .api-key-status {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        background: #f0f0f0;
        color: #666;
      }

      .api-key-status.configured {
        background: #d4edda;
        color: #155724;
      }

      .api-key-status.error {
        background: #f8d7da;
        color: #721c24;
      }

      .api-key-description {
        margin: 8px 0 16px 0;
        font-size: 14px;
        color: var(--text-secondary, #666);
        line-height: 1.5;
      }

      .api-key-description a {
        color: var(--accent, #007bff);
        text-decoration: none;
      }

      .api-key-description a:hover {
        text-decoration: underline;
      }

      .api-key-input-group {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }

      .api-key-input {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid var(--border-color, #ddd);
        border-radius: 6px;
        font-size: 14px;
        font-family: monospace;
        background: var(--bg-input, #fff);
        color: var(--text-primary, #333);
      }

      .api-key-input:focus {
        outline: none;
        border-color: var(--accent, #007bff);
        box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
      }

      .api-key-toggle-btn {
        padding: 10px 12px;
        border: 1px solid var(--border-color, #ddd);
        border-radius: 6px;
        background: var(--bg-input, #fff);
        cursor: pointer;
        font-size: 16px;
        transition: all 0.2s;
      }

      .api-key-toggle-btn:hover {
        background: var(--bg-secondary, #f5f5f5);
      }

      .api-key-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .api-key-btn {
        padding: 10px 16px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .api-key-btn.primary {
        background: var(--accent, #007bff);
        color: white;
      }

      .api-key-btn.primary:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }

      .api-key-btn.secondary {
        background: var(--bg-secondary, #f0f0f0);
        color: var(--text-primary, #333);
        border: 1px solid var(--border-color, #ddd);
      }

      .api-key-btn.secondary:hover {
        background: var(--border-color, #e0e0e0);
      }

      .api-key-info {
        margin-top: 12px;
        padding: 12px;
        border-radius: 6px;
        font-size: 13px;
        line-height: 1.5;
        min-height: 0;
      }

      .api-key-info.success {
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
      }

      .api-key-info.error {
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
      }

      .api-key-info.info {
        background: #d1ecf1;
        color: #0c5460;
        border: 1px solid #bee5eb;
      }

      .info-section ul {
        margin: 0;
        padding-left: 20px;
      }

      .info-section li {
        margin: 8px 0;
        font-size: 14px;
        line-height: 1.5;
      }

      .api-key-footer {
        padding: 16px 24px;
        border-top: 1px solid var(--border-color, #e0e0e0);
        background: var(--bg-secondary, #f5f5f5);
        display: flex;
        justify-content: flex-end;
      }

      @media (max-width: 600px) {
        .api-key-content {
          width: 95%;
          max-height: 90vh;
        }

        .api-key-actions {
          flex-direction: column;
        }

        .api-key-btn {
          width: 100%;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  setupEventListeners() {
    const modal = document.getElementById('apiKeyModal');
    
    // Close button
    document.getElementById('apiKeyClose').addEventListener('click', () => this.closeModal());
    document.getElementById('apiKeyCancel').addEventListener('click', () => this.closeModal());
    
    // Overlay click
    document.querySelector('.api-key-overlay').addEventListener('click', (e) => {
      if (e.target === document.querySelector('.api-key-overlay')) {
        this.closeModal();
      }
    });

    // OpenWeatherMap key management
    document.getElementById('toggleOWMKey').addEventListener('click', () => this.toggleKeyVisibility('openWeatherKeyInput'));
    document.getElementById('saveOWMKey').addEventListener('click', () => this.saveOpenWeatherKey());
    document.getElementById('clearOWMKey').addEventListener('click', () => this.clearOpenWeatherKey());
    document.getElementById('testOWMKey').addEventListener('click', () => this.testOpenWeatherKey());

    // Groq key management
    document.getElementById('toggleGroqKey').addEventListener('click', () => this.toggleKeyVisibility('groqKeyInput'));
    document.getElementById('saveGroqKey').addEventListener('click', () => this.saveGroqKey());
    document.getElementById('clearGroqKey').addEventListener('click', () => this.clearGroqKey());
    document.getElementById('testGroqKey').addEventListener('click', () => this.testGroqKey());

    // Load existing keys
    this.loadExistingKeys();
  }

  toggleKeyVisibility(inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
  }

  loadExistingKeys() {
    const owmKey = localStorage.getItem('openweather_api_key');
    const groqKey = localStorage.getItem('groq_api_key');

    if (owmKey) {
      document.getElementById('openWeatherKeyInput').value = owmKey;
      document.getElementById('owmStatus').textContent = '✅ Configured';
      document.getElementById('owmStatus').classList.add('configured');
    }

    if (groqKey) {
      document.getElementById('groqKeyInput').value = groqKey;
      document.getElementById('groqStatus').textContent = '✅ Configured';
      document.getElementById('groqStatus').classList.add('configured');
    }
  }

  async saveOpenWeatherKey() {
    const key = document.getElementById('openWeatherKeyInput').value.trim();
    const infoDiv = document.getElementById('owmInfo');

    if (!key) {
      this.showInfo(infoDiv, 'Please enter an API key', 'error');
      return;
    }

    if (key.length < 20) {
      this.showInfo(infoDiv, 'API key seems too short. Please check.', 'error');
      return;
    }

    localStorage.setItem('openweather_api_key', key);
    setWeatherApiKey(key, WEATHER_PROVIDERS.OPENWEATHER);
    
    document.getElementById('owmStatus').textContent = '✅ Configured';
    document.getElementById('owmStatus').classList.add('configured');
    this.showInfo(infoDiv, '✅ OpenWeatherMap API key saved successfully!', 'success');
  }

  clearOpenWeatherKey() {
    localStorage.removeItem('openweather_api_key');
    document.getElementById('openWeatherKeyInput').value = '';
    document.getElementById('owmStatus').textContent = 'Not configured';
    document.getElementById('owmStatus').classList.remove('configured');
    document.getElementById('owmInfo').textContent = '';
  }

  async testOpenWeatherKey() {
    const key = document.getElementById('openWeatherKeyInput').value.trim();
    const infoDiv = document.getElementById('owmInfo');

    if (!key) {
      this.showInfo(infoDiv, 'Please enter an API key first', 'error');
      return;
    }

    this.showInfo(infoDiv, 'Testing connection...', 'info');

    try {
      // Test with a known location (London)
      const response = await fetch(
        `https://api.openweathermap.org/data/3.0/onecall?lat=51.5074&lon=-0.1278&appid=${key}&units=metric`
      );

      if (response.status === 401) {
        this.showInfo(infoDiv, '❌ Invalid API key. Please check and try again.', 'error');
        return;
      }

      if (!response.ok) {
        this.showInfo(infoDiv, `❌ API error: ${response.status}. Please try again later.`, 'error');
        return;
      }

      const data = await response.json();
      this.showInfo(infoDiv, `✅ Connection successful! Current temp in London: ${Math.round(data.current.temp)}°C`, 'success');
    } catch (error) {
      this.showInfo(infoDiv, `❌ Connection failed: ${error.message}`, 'error');
    }
  }

  saveGroqKey() {
    const key = document.getElementById('groqKeyInput').value.trim();
    const infoDiv = document.getElementById('groqInfo');

    if (!key) {
      this.showInfo(infoDiv, 'Please enter an API key', 'error');
      return;
    }

    localStorage.setItem('groq_api_key', key);
    if (typeof groqApiKey !== 'undefined') {
      window.groqApiKey = key;
    }

    document.getElementById('groqStatus').textContent = '✅ Configured';
    document.getElementById('groqStatus').classList.add('configured');
    this.showInfo(infoDiv, '✅ Groq API key saved successfully!', 'success');
  }

  clearGroqKey() {
    localStorage.removeItem('groq_api_key');
    document.getElementById('groqKeyInput').value = '';
    document.getElementById('groqStatus').textContent = 'Not configured';
    document.getElementById('groqStatus').classList.remove('configured');
    document.getElementById('groqInfo').textContent = '';
  }

  async testGroqKey() {
    const key = document.getElementById('groqKeyInput').value.trim();
    const infoDiv = document.getElementById('groqInfo');

    if (!key) {
      this.showInfo(infoDiv, 'Please enter an API key first', 'error');
      return;
    }

    this.showInfo(infoDiv, 'Testing connection...', 'info');

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Say "Hello"' }],
          max_tokens: 10
        })
      });

      if (response.status === 401) {
        this.showInfo(infoDiv, '❌ Invalid API key. Please check and try again.', 'error');
        return;
      }

      if (!response.ok) {
        this.showInfo(infoDiv, `❌ API error: ${response.status}. Please try again later.`, 'error');
        return;
      }

      this.showInfo(infoDiv, '✅ Connection successful! Groq API is working.', 'success');
    } catch (error) {
      this.showInfo(infoDiv, `❌ Connection failed: ${error.message}`, 'error');
    }
  }

  showInfo(element, message, type) {
    element.textContent = message;
    element.className = `api-key-info ${type}`;
  }

  openModal() {
    document.getElementById('apiKeyModal').classList.add('open');
    this.loadExistingKeys();
  }

  closeModal() {
    document.getElementById('apiKeyModal').classList.remove('open');
  }
}

// Initialize on page load
let apiKeyManager = null;
document.addEventListener('DOMContentLoaded', () => {
  apiKeyManager = new APIKeyManager();
});
