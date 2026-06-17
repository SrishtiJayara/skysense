# Real-Time Weather Integration Guide

## Overview

Your SkySense weather app now includes **real-time weather data access** with support for multiple weather providers and automatic fallback mechanisms.

## What's New

### 1. **Enhanced Weather API Module** (`weather-api.js`)
- **Multi-provider support**: Open-Meteo (free, no key) + OpenWeatherMap (optional)
- **Automatic fallback**: If one provider fails, automatically switches to the other
- **Real-time data caching**: 5-minute cache to reduce API calls
- **Auto-refresh capability**: Configurable automatic weather updates
- **Data transformation**: Normalizes data from different providers into a consistent format

### 2. **API Key Manager** (`api-manager.js`)
- Beautiful UI for managing API keys
- Support for both OpenWeatherMap and Groq (AI chat) API keys
- Local storage (never sent to external servers)
- Connection testing for each API
- Easy enable/disable without code changes

### 3. **Updated Main App** (`app.js`)
- Seamless integration with enhanced weather API
- Fallback to Open-Meteo if OpenWeatherMap fails
- Real-time update callbacks
- Settings button in header to access API configuration

## Current Weather Data Sources

### Open-Meteo (Free - No Key Required)
✅ **Always available as fallback**
- Current weather conditions
- Hourly forecast (24 hours)
- 7-day forecast
- UV index, humidity, wind, visibility
- Precipitation probability
- Cloud cover and pressure

**Endpoint**: `https://api.open-meteo.com/v1/forecast`

### OpenWeatherMap (Optional - Requires Free API Key)
✅ **Enhanced real-time data with additional features**
- All Open-Meteo data plus:
- Air quality index (AQI)
- Weather alerts
- More frequent updates
- Better data coverage in some regions

**Endpoint**: `https://api.openweathermap.org/data/3.0/onecall`

## How to Set Up OpenWeatherMap (Optional)

### Step 1: Get a Free API Key
1. Visit [https://openweathermap.org/api](https://openweathermap.org/api)
2. Click "Sign Up" and create a free account
3. Verify your email
4. Go to your account dashboard
5. Click "API Keys"
6. Copy your default API key (32 characters)

### Step 2: Add API Key to SkySense
1. Open SkySense in your browser
2. Click the **⚙️ Settings** button in the top-right header
3. Paste your OpenWeatherMap API key in the "OpenWeatherMap API" field
4. Click **"Test Connection"** to verify it works
5. Click **"Save OpenWeatherMap Key"**

### Step 3: Verify It's Working
- The status badge should show "✅ Configured"
- Weather data will now come from OpenWeatherMap with automatic fallback to Open-Meteo

## How to Set Up Groq API (For AI Chat Features)

### Step 1: Get a Free Groq API Key
1. Visit [https://console.groq.com](https://console.groq.com)
2. Sign up with your email
3. Go to "API Keys" section
4. Create a new API key
5. Copy the key

### Step 2: Add API Key to SkySense
1. Click the **⚙️ Settings** button
2. Paste your Groq API key in the "Groq API" field
3. Click **"Test Connection"** to verify
4. Click **"Save Groq Key"**

### Step 3: Enable AI Features
- Weather AI Assistant will now be fully functional
- City comparison with AI recommendations will work
- Chat suggestions will provide intelligent responses

## Real-Time Data Flow

```
┌─────────────────────────────────────────┐
│  User Requests Weather for Location    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Check Cache (5-minute expiry)          │
└──────────────┬──────────────────────────┘
               │
               ├─ Hit ──▶ Return Cached Data
               │
               └─ Miss ──▶ Fetch Fresh Data
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Try Primary Provider│
                    │ (OpenWeatherMap)    │
                    └────────┬────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                 Success           Failure
                    │                 │
                    │                 ▼
                    │        ┌──────────────────┐
                    │        │ Try Fallback     │
                    │        │ (Open-Meteo)     │
                    │        └────────┬─────────┘
                    │                 │
                    │            Success
                    │                 │
                    └────────┬────────┘
                             │
                             ▼
                    ┌──────────────────────┐
                    │ Cache & Return Data  │
                    │ Update UI            │
                    │ Trigger Callbacks    │
                    └──────────────────────┘
```

## API Features Comparison

| Feature | Open-Meteo | OpenWeatherMap |
|---------|-----------|-----------------|
| Current Weather | ✅ | ✅ |
| Hourly Forecast | ✅ | ✅ |
| 7-Day Forecast | ✅ | ✅ |
| UV Index | ✅ | ✅ |
| Wind & Humidity | ✅ | ✅ |
| Visibility | ✅ | ✅ |
| Air Quality | ❌ | ✅ |
| Weather Alerts | ❌ | ✅ |
| API Key Required | ❌ | ✅ |
| Free Tier Limit | Unlimited | 1,000 calls/day |
| Data Update Frequency | Every 15 min | Real-time |

## Configuration Options

### Programmatic Configuration

```javascript
// Set OpenWeatherMap as primary provider
updateWeatherConfig({
  primaryProvider: WEATHER_PROVIDERS.OPENWEATHER,
  fallbackProvider: WEATHER_PROVIDERS.OPEN_METEO
});

// Set API key
setWeatherApiKey('your-api-key-here', WEATHER_PROVIDERS.OPENWEATHER);

// Enable auto-refresh every 5 minutes
startAutoRefresh(lat, lon, 5 * 60 * 1000);

// Listen for real-time updates
onWeatherRefresh((data, location) => {
  console.log('Weather updated for:', location);
  console.log('Provider:', data.provider);
});
```

### Configuration via UI

1. Click **⚙️ Settings** button
2. Enter your API keys
3. Click **"Test Connection"** to verify
4. Changes are automatically saved to browser storage

## Troubleshooting

### "Weather data failed to load"
- **Solution 1**: Check your internet connection
- **Solution 2**: Wait a moment and try again (rate limiting)
- **Solution 3**: Clear browser cache and reload

### "OpenWeatherMap API key not working"
- Verify the key is correct (32 characters)
- Check that your OpenWeatherMap account is active
- Test the key using the "Test Connection" button
- Wait a few minutes after creating the key (sometimes takes time to activate)

### "AI Chat is unavailable"
- Ensure Groq API key is configured
- Click **⚙️ Settings** and test the Groq connection
- Verify your Groq account has available API credits

### "Weather updates are slow"
- This is normal for the free tier (1,000 calls/day limit)
- Consider upgrading to a paid OpenWeatherMap plan
- Open-Meteo fallback is always available

## Security Notes

✅ **Your API keys are secure**
- Stored only in your browser's local storage
- Never sent to SkySense servers
- Never logged or monitored
- You can clear them anytime from Settings

⚠️ **Best Practices**
- Don't share your API keys
- Regenerate keys if accidentally exposed
- Use different keys for different projects
- Monitor your API usage on provider dashboards

## API Rate Limits

### Open-Meteo (Free)
- Unlimited requests
- No authentication required
- Recommended for development

### OpenWeatherMap (Free Tier)
- 1,000 API calls per day
- 60 calls per minute
- Sufficient for personal use

### Groq (Free Tier)
- 10,000 tokens per day
- Sufficient for chat interactions

## Advanced Features

### Manual Weather Refresh
```javascript
// Manually fetch weather data
const data = await fetchWeatherWithFallback(lat, lon);

// With specific provider preference
const data = await fetchWeatherWithFallback(lat, lon, {
  primaryProvider: WEATHER_PROVIDERS.OPENWEATHER,
  apiKey: 'your-key-here'
});
```

### Cache Management
```javascript
// Get cached weather (if available)
const cached = getCachedWeather(lat, lon);

// Clear all cached data
clearWeatherCache();
```

### Auto-Refresh Setup
```javascript
// Start auto-refresh every 10 minutes
startAutoRefresh(lat, lon, 10 * 60 * 1000);

// Stop auto-refresh
stopAutoRefresh();

// Listen for updates
onWeatherRefresh((data, location) => {
  console.log('Weather updated!', data);
});
```

## File Structure

```
final_fixed_weather_app/
├── index.html              # Main HTML (updated with settings button)
├── app.js                  # Main app logic (updated with API integration)
├── style.css               # Styling
├── config.js               # Configuration (Groq API key)
├── weather-api.js          # NEW: Weather API integration module
├── api-manager.js          # NEW: API key management UI
├── REAL_TIME_INTEGRATION.md # This file
└── README.md               # Original project README
```

## Next Steps

1. **Test with Open-Meteo** (works out of the box)
2. **Get OpenWeatherMap API key** (optional, 5 minutes)
3. **Configure via Settings** (click ⚙️ button)
4. **Enjoy real-time weather!** 🌤️

## Support & Documentation

- **Open-Meteo Docs**: https://open-meteo.com/en/docs
- **OpenWeatherMap Docs**: https://openweathermap.org/api
- **Groq Docs**: https://console.groq.com/docs

## Changelog

### Version 2.0 (Real-Time Integration)
- ✅ Added multi-provider weather API support
- ✅ Implemented automatic fallback mechanism
- ✅ Created API key management UI
- ✅ Added real-time data caching
- ✅ Implemented auto-refresh capability
- ✅ Added connection testing for APIs
- ✅ Improved error handling and logging

### Version 1.0 (Original)
- Open-Meteo weather data
- City search and geolocation
- 7-day forecast
- AI chat assistant (Groq)
- City comparison

---

**Made with ❤️ for real-time weather intelligence**
