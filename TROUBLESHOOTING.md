# 🔧 Weather App Troubleshooting Guide

## 🚨 Common Issues & Solutions

### Issue 1: Multi-Day Forecast Not Working
**Symptoms:** Forecast cards show "No forecast data available" or empty cards

**Diagnosis Steps:**
1. Open browser developer tools (F12)
2. Check console for errors starting with "❌"
3. Look for API response errors

**Common Causes & Solutions:**

#### Cause: API Key Issues
```bash
# Error in console: "API error 401 - Unauthorized"
```
**Solution:** The API key may be invalid or expired
- Check line 9 in `script.js` for the API key
- Test the key manually with the diagnostic tool
- Get a new key from weatherapi.com if needed

#### Cause: API Rate Limits
```bash
# Error in console: "API error 429 - Too Many Requests"
```
**Solution:** You've exceeded the API rate limit
- Wait a few minutes before trying again
- Consider upgrading your WeatherAPI plan

#### Cause: Network/CORS Issues
```bash
# Error in console: "Failed to fetch" or CORS errors
```
**Solution:** 
- Ensure you're running the app on localhost or a proper web server
- Don't open the HTML file directly in browser (file:// protocol)
- Start a local server: `python -m http.server 8000`

### Issue 2: AQI Graphs Not Working
**Symptoms:** AQI chart shows "AQI Data Not Available" or is blank

**Diagnosis Steps:**
1. Open debug panel (bottom-right corner in development)
2. Click "API Test" button
3. Check console for AQI data availability

**Common Causes & Solutions:**

#### Cause: Location Doesn't Have AQI Data
```bash
# Console: "⚠️ No PM2.5 data available for AQI chart"
```
**Solution:** Some locations don't provide AQI data
- Try testing with major cities: London, Beijing, New York
- The app will show a placeholder chart when no data is available

#### Cause: WeatherAPI Plan Limitations
```bash
# Console: AQI data shows as null or undefined
```
**Solution:** Your WeatherAPI plan may not include AQI data
- Check your plan at weatherapi.com
- AQI data requires a paid plan on some API providers

#### Cause: Chart.js Not Loaded
```bash
# Error in console: "Chart is not defined"
```
**Solution:** Chart.js CDN failed to load
- Check internet connection
- Verify Chart.js CDN URL in index.html line 9
- Try refreshing the page

### Issue 3: Charts Not Displaying
**Symptoms:** Chart areas are blank or show canvas errors

**Common Solutions:**
1. **Missing Chart.js Library**
   - Check browser console for Chart.js errors
   - Verify CDN is accessible
   
2. **Canvas Elements Missing**
   - Verify `tempChart` and `aqiChart` elements exist in HTML
   - Check for CSS issues hiding the charts

3. **Data Format Issues**
   - Open browser console and look for data processing errors
   - Use the diagnostic tools to verify data structure

## 🛠️ Diagnostic Tools

### Built-in Debug Panel
When running locally, a debug panel appears in the bottom-right corner:
- **Full Test**: Runs comprehensive diagnostics
- **API Test**: Tests WeatherAPI endpoints and data
- **Chart Test**: Verifies Chart.js functionality

### Manual Console Testing
Open browser console (F12) and run:

```javascript
// Full diagnostic
runFullDiagnostic()

// Test specific components
debugWeatherAPI()  // Test API calls
debugChartJS()     // Test Chart.js
debugDOM()         // Test HTML elements
```

### Standalone Diagnostic Page
Open `api_test.html` in your browser for detailed API testing:
- Tests current weather API
- Tests 5-day forecast API
- Tests AQI data availability
- Shows raw API responses

## 📊 Expected API Response Structure

### Working Forecast Response Should Have:
```javascript
{
  current: {
    temp_c: 15.0,
    condition: { text: "Partly cloudy" },
    air_quality: {  // May be null for some locations
      pm2_5: 12.3,
      pm10: 15.7
    }
  },
  location: {
    name: "London",
    localtime: "2025-01-05 12:00"
  },
  forecast: {
    forecastday: [  // Should have 1-5 days
      {
        date: "2025-01-05",
        day: {
          avgtemp_c: 15,
          condition: { text: "Sunny" },
          totalprecip_mm: 0
        },
        hour: [  // Should have 24 hours
          {
            time: "2025-01-05 00:00",
            temp_c: 12,
            air_quality: { pm2_5: 10 }  // May be null
          }
        ]
      }
    ]
  }
}
```

## 🔍 Step-by-Step Debugging Process

### 1. Start the App
```bash
# In the project directory
python -m http.server 8000
# Open http://localhost:8000
```

### 2. Check Console Messages
- Open Developer Tools (F12)
- Look for messages starting with weather app emoji (🔄, 📅, 💨, 📊)
- Note any ❌ error messages

### 3. Run Diagnostics
- Click the debug panel buttons
- Or run `runFullDiagnostic()` in console
- Check each component systematically

### 4. Test API Manually
```bash
# Test URL directly in browser:
https://api.weatherapi.com/v1/forecast.json?key=8875f5efaa9141d8b56120913251708&q=London&days=5&aqi=yes&alerts=no
```

### 5. Common Quick Fixes
1. **Refresh the page** - Clears any stuck states
2. **Clear browser cache** - Removes cached errors
3. **Try different locations** - Some cities have better data
4. **Check internet connection** - All features require network access
5. **Wait a few minutes** - If hitting rate limits

## 📋 API Key Information

**Current API Key:** `8875f5efaa9141d8b56120913251708`
- **Provider:** WeatherAPI.com
- **Features:** Current weather, 5-day forecast, AQI data
- **Rate Limits:** Check with provider

**If you need a new API key:**
1. Visit weatherapi.com
2. Sign up for free account
3. Replace the key in `script.js` line 9
4. Ensure your plan includes forecast and AQI data

## 🆘 Still Having Issues?

If problems persist after trying these solutions:

1. **Check the console messages** - Look for specific error details
2. **Run the full diagnostic** - Use `runFullDiagnostic()` in console
3. **Test with the standalone diagnostic page** - Open `api_test.html`
4. **Verify your environment** - Ensure localhost server is running
5. **Try a different browser** - Test cross-browser compatibility

The app includes comprehensive logging and error handling, so most issues can be identified through the browser console or diagnostic tools.
