// ===== Weather API Integration Module =====
// Supports both Open-Meteo (free, no key) and OpenWeatherMap (with optional API key)
// Provides real-time weather data with automatic fallback

const WEATHER_PROVIDERS = {
  OPEN_METEO: 'open-meteo',
  OPENWEATHER: 'openweather'
};

let weatherConfig = {
  primaryProvider: WEATHER_PROVIDERS.OPEN_METEO,
  fallbackProvider: WEATHER_PROVIDERS.OPENWEATHER,
  openWeatherApiKey: localStorage.getItem('openweather_api_key') || '',
  enableAutoRefresh: true,
  refreshInterval: 10 * 60 * 1000, // 10 minutes
  lastRefreshTime: null,
  cacheExpiry: 5 * 60 * 1000 // 5 minutes
};

// ===== Open-Meteo API (Free, No Key Required) =====
async function fetchWeatherOpenMeteo(lat, lon) {
  const params = [
    `latitude=${lat}`,
    `longitude=${lon}`,
    `current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code,uv_index,visibility,cloud_cover,surface_pressure,precipitation`,
    `hourly=temperature_2m,weather_code,precipitation_probability`,
    `daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max`,
    `timezone=auto`,
    `forecast_days=7`,
    `_=${Date.now()}`
  ].join('&');
  
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error('Open-Meteo API failed');
  
  const data = await res.json();
  return {
    provider: 'open-meteo',
    current: data.current,
    hourly: data.hourly,
    daily: data.daily,
    timezone: data.timezone,
    timestamp: Date.now()
  };
}

// ===== OpenWeatherMap API (Requires API Key) =====
async function fetchWeatherOpenWeatherMap(lat, lon, apiKey) {
  if (!apiKey) throw new Error('OpenWeatherMap API key not configured');
  
  // One Call API 3.0 endpoint for comprehensive data
  const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
  
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid OpenWeatherMap API key');
    throw new Error(`OpenWeatherMap API error: ${res.status}`);
  }
  
  const data = await res.json();
  
  // Transform OpenWeatherMap data to match our standard format
  return {
    provider: 'openweathermap',
    current: {
      temperature_2m: data.current.temp,
      apparent_temperature: data.current.feels_like,
      relative_humidity_2m: data.current.humidity,
      wind_speed_10m: data.current.wind_speed,
      wind_gusts_10m: data.current.wind_gust || data.current.wind_speed,
      wind_direction_10m: data.current.wind_deg,
      weather_code: mapOpenWeatherCodeToWMO(data.current.weather[0].main),
      uv_index: data.current.uvi || 0,
      visibility: data.current.visibility,
      cloud_cover: data.current.clouds,
      surface_pressure: data.current.pressure,
      precipitation: data.current.rain?.['1h'] || 0,
      description: data.current.weather[0].description
    },
    hourly: {
      time: data.hourly.map(h => new Date(h.dt * 1000).toISOString()),
      temperature_2m: data.hourly.map(h => h.temp),
      weather_code: data.hourly.map(h => mapOpenWeatherCodeToWMO(h.weather[0].main)),
      precipitation_probability: data.hourly.map(h => h.pop * 100)
    },
    daily: {
      time: data.daily.map(d => new Date(d.dt * 1000).toISOString().split('T')[0]),
      weather_code: data.daily.map(d => mapOpenWeatherCodeToWMO(d.weather[0].main)),
      temperature_2m_max: data.daily.map(d => d.temp.max),
      temperature_2m_min: data.daily.map(d => d.temp.min),
      precipitation_probability_max: data.daily.map(d => d.pop * 100),
      sunrise: data.daily.map(d => new Date(d.sunrise * 1000).toISOString()),
      sunset: data.daily.map(d => new Date(d.sunset * 1000).toISOString()),
      uv_index_max: data.daily.map(d => d.uvi || 0)
    },
    timezone: data.timezone,
    timestamp: Date.now()
  };
}

// ===== Weather Code Mapping =====
// Convert OpenWeatherMap codes to WMO codes for consistency
function mapOpenWeatherCodeToWMO(weatherMain) {
  const mapping = {
    'Clear': 0,
    'Clouds': 2,
    'Cloudy': 3,
    'Drizzle': 51,
    'Rain': 61,
    'Thunderstorm': 95,
    'Snow': 71,
    'Mist': 45,
    'Smoke': 45,
    'Haze': 45,
    'Dust': 45,
    'Fog': 45,
    'Sand': 45,
    'Ash': 45,
    'Squall': 80,
    'Tornado': 95
  };
  return mapping[weatherMain] || 2; // Default to cloudy
}

// ===== Main Weather Fetch Function =====
async function fetchWeatherWithFallback(lat, lon, options = {}) {
  const apiKey = options.apiKey || weatherConfig.openWeatherApiKey;
  const primaryProvider = options.primaryProvider || weatherConfig.primaryProvider;
  const fallbackProvider = options.fallbackProvider || weatherConfig.fallbackProvider;
  
  let lastError = null;
  
  // Try primary provider
  try {
    if (primaryProvider === WEATHER_PROVIDERS.OPENWEATHER && apiKey) {
      const data = await fetchWeatherOpenWeatherMap(lat, lon, apiKey);
      console.log('✅ Weather data from OpenWeatherMap');
      return data;
    } else if (primaryProvider === WEATHER_PROVIDERS.OPEN_METEO) {
      const data = await fetchWeatherOpenMeteo(lat, lon);
      console.log('✅ Weather data from Open-Meteo');
      return data;
    }
  } catch (error) {
    lastError = error;
    console.warn(`Primary provider (${primaryProvider}) failed:`, error.message);
  }
  
  // Try fallback provider
  try {
    if (fallbackProvider === WEATHER_PROVIDERS.OPENWEATHER && apiKey) {
      const data = await fetchWeatherOpenWeatherMap(lat, lon, apiKey);
      console.log('✅ Weather data from OpenWeatherMap (fallback)');
      return data;
    } else if (fallbackProvider === WEATHER_PROVIDERS.OPEN_METEO) {
      const data = await fetchWeatherOpenMeteo(lat, lon);
      console.log('✅ Weather data from Open-Meteo (fallback)');
      return data;
    }
  } catch (error) {
    console.error(`Fallback provider (${fallbackProvider}) also failed:`, error.message);
  }
  
  throw new Error(`All weather providers failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

// ===== Configuration Management =====
function setWeatherApiKey(apiKey, provider = WEATHER_PROVIDERS.OPENWEATHER) {
  if (provider === WEATHER_PROVIDERS.OPENWEATHER) {
    weatherConfig.openWeatherApiKey = apiKey;
    localStorage.setItem('openweather_api_key', apiKey);
    console.log('✅ OpenWeatherMap API key configured');
  }
}

function getWeatherConfig() {
  return { ...weatherConfig };
}

function updateWeatherConfig(updates) {
  weatherConfig = { ...weatherConfig, ...updates };
  console.log('✅ Weather config updated:', updates);
}

function validateApiKey(apiKey, provider = WEATHER_PROVIDERS.OPENWEATHER) {
  if (!apiKey || apiKey.length < 10) {
    return { valid: false, message: 'API key too short' };
  }
  
  if (provider === WEATHER_PROVIDERS.OPENWEATHER) {
    // OpenWeatherMap keys are typically 32 characters
    if (apiKey.length < 20) {
      return { valid: false, message: 'OpenWeatherMap API key should be at least 20 characters' };
    }
  }
  
  return { valid: true, message: 'API key format looks valid' };
}

// ===== Real-Time Data Refresh =====
let autoRefreshTimer = null;
let weatherRefreshCallbacks = [];

function onWeatherRefresh(callback) {
  weatherRefreshCallbacks.push(callback);
}

function startAutoRefresh(lat, lon, interval = weatherConfig.refreshInterval) {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  
  autoRefreshTimer = setInterval(async () => {
    try {
      const data = await fetchWeatherWithFallback(lat, lon);
      weatherRefreshCallbacks.forEach(cb => cb(data, { lat, lon }));
      weatherConfig.lastRefreshTime = Date.now();
      console.log('🔄 Weather auto-refreshed');
    } catch (error) {
      console.error('Auto-refresh failed:', error);
    }
  }, interval);
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
    console.log('⏹️ Auto-refresh stopped');
  }
}

// ===== Data Caching =====
const weatherCache = new Map();

function getCachedWeather(lat, lon) {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = weatherCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < weatherConfig.cacheExpiry) {
    console.log('📦 Using cached weather data');
    return cached.data;
  }
  
  return null;
}

function setCachedWeather(lat, lon, data) {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  weatherCache.set(key, { data, timestamp: Date.now() });
}

function clearWeatherCache() {
  weatherCache.clear();
  console.log('🗑️ Weather cache cleared');
}

// ===== Export Functions =====
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchWeatherWithFallback,
    fetchWeatherOpenMeteo,
    fetchWeatherOpenWeatherMap,
    setWeatherApiKey,
    getWeatherConfig,
    updateWeatherConfig,
    validateApiKey,
    startAutoRefresh,
    stopAutoRefresh,
    onWeatherRefresh,
    getCachedWeather,
    setCachedWeather,
    clearWeatherCache,
    WEATHER_PROVIDERS
  };
}
