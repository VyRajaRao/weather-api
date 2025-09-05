
/* -------------------------
   Full Weather App Script
   - Uses WeatherAPI forecast.json (days=5) with aqi=yes
   - Requires network to call WeatherAPI
   - Chart.js used for charts (loaded via CDN)
   ------------------------- */

const API_KEY = "8875f5efaa9141d8b56120913251708";
const BASE_FORECAST = "https://api.weatherapi.com/v1/forecast.json";

const el = id => document.getElementById(id);

// elements
const searchBtn = el('searchBtn'), geoBtn = el('geoBtn'), demoBtn = el('demoBtn'), clearBtn = el('clearBtn');
const input = el('locInput'), loading = el('loading'), msg = el('msg');
const temperature = el('temperature'), place = el('place'), conditionEl = el('condition'), lastUpdated = el('lastUpdated');
const feels = el('feels'), humidity = el('humidity'), wind = el('wind'), vis = el('vis'), pressure = el('pressure'), uv = el('uv');
const localtime = el('localtime'), aqiBox = el('aqiBox'), aqiSummary = el('aqiSummary'), aqiLegend = el('aqiLegend');
const forecastRow = el('forecastRow'), art = el('art'), scene = el('scene');
const selectedDayLabel = el('selectedDayLabel'), aqiNowLabel = el('aqiNowLabel'), updatedAt = el('updatedAt');

let isCelsius = true;
let lastData = null;
let lastQuery = '';
let tempChart = null, aqiChart = null;
let currentHourlyDataset = null;

/* helpers */
function setLoading(on, text=''){
  loading.style.display = on ? 'block' : 'none';
  msg.textContent = text || '';
}
function buildUrl(q, days=5){
  return `${BASE_FORECAST}?key=${API_KEY}&q=${encodeURIComponent(q)}&days=${days}&aqi=yes&alerts=no`;
}

/* fetch forecast */
async function fetchForecast(q){
  try{
    setLoading(true,'Loading forecast…');
    resetSceneImmediate();
    const res = await fetch(buildUrl(q,5));
    if(!res.ok){
      const txt = await res.text();
      throw new Error('API error ' + res.status + ' - ' + txt.slice(0,200));
    }
    const data = await res.json();
    lastData = data;
    lastQuery = q;
    updateAll(data);
    setLoading(false);
  }catch(err){
    setLoading(false);
    msg.textContent = 'Error: ' + (err.message || err);
    console.error(err);
  }
}

/* UI update */
function updateAll(data){
  if(!data) {
    console.error('No weather data received');
    msg.textContent = 'No weather data received';
    return;
  }
  
  const cur = data.current;
  const loc = data.location;
  
  if (!cur || !loc) {
    console.error('Incomplete weather data received');
    msg.textContent = 'Incomplete weather data received';
    return;
  }

  // place/time
  place.textContent = `${loc.name}${loc.region ? ', ' + loc.region : ''}, ${loc.country}`;
  localtime.textContent = `Local Time: ${loc.localtime}`;
  updatedAt.textContent = `Updated: ${new Date().toLocaleString()}`;

  // temp & units
  const tC = Math.round(cur.temp_c), tF = Math.round(cur.temp_f);
  temperature.innerHTML = isCelsius ? `${tC}°<span class="small">C</span>` : `${tF}°<span class="small">F</span>`;
  conditionEl.textContent = cur.condition?.text || '—';
  lastUpdated.textContent = `Last: ${cur.last_updated || '--'}`;
  feels.textContent = `Feels: ${Math.round(isCelsius ? cur.feelslike_c : cur.feelslike_f)}°${isCelsius ? 'C' : 'F'}`;
  humidity.textContent = `Humidity: ${cur.humidity}%`;
  wind.innerHTML = `${cur.wind_kph} kph <small style="color:var(--muted)">(${cur.wind_dir})</small>`;
  vis.innerHTML = `${cur.vis_km} km`;
  pressure.innerHTML = `${cur.pressure_mb} mb`;
  uv.innerHTML = `${cur.uv}`;

  // AQI (WeatherAPI uses components in current.air_quality)
  // We'll show PM2.5 and PM10 where available, and overall "us-epa-index" if present
  const aqi = cur.air_quality || {};
  renderAQI(aqi);

  // forecast days UI
  renderForecastCards(data.forecast.forecastday);

  // set scene (animated) based on condition
  chooseScene(cur, data.forecast.forecastday);

  // build default hourly chart for next 24 hours
  buildHourlyAndAQICharts(data);
}

/* AQI rendering */
function renderAQI(aqi) {
  aqiBox.innerHTML = '';
  aqiLegend.innerHTML = '';
  // Preferred keys in WeatherAPI: "pm2_5", "pm10", "us-epa-index" maybe exist
  function addPill(text, color){
    const d = document.createElement('div');
    d.className = 'aqi-pill';
    d.style.background = color;
    d.textContent = text;
    aqiBox.appendChild(d);
  }
  if(!aqi || Object.keys(aqi).length === 0){
    aqiSummary.textContent = 'AQI: --';
    addPill('No AQI data', 'rgba(255,255,255,0.04)');
    return;
  }
  // create readable numbers
  const pm25 = aqi.pm2_5 ? Math.round(aqi.pm2_5 * 10) / 10 : null; // API may be fractional
  const pm10 = aqi.pm10 ? Math.round(aqi.pm10 * 10) / 10 : null;
  // WeatherAPI fields for indexes: "us-epa-index" (1-6), "gb-defra-index"
  const usIndex = aqi['us-epa-index'];
  const overall = usIndex ? mapAQIIndexToLabel(usIndex) : null;

  if(pm25 !== null) addPill(`PM2.5: ${pm25} µg/m³`, colorForPM(pm25));
  if(pm10 !== null) addPill(`PM10: ${pm10} µg/m³`, colorForPM(pm10));
  if(overall) addPill(`AQI: ${overall.label}`, overall.color);

  aqiSummary.textContent = `AQI: ${overall ? overall.label : '—'}`;
  // small legend
  aqiLegend.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <div style="width:14px;height:14px;background:#7ee67a;border-radius:4px"></div><div class="small">Good</div>
      <div style="width:14px;height:14px;background:#ffdf7a;border-radius:4px"></div><div class="small">Moderate</div>
      <div style="width:14px;height:14px;background:#ffb37a;border-radius:4px"></div><div class="small">Unhealthy</div>
    </div>
  `;
}

function colorForPM(value){
  // rough color mapping for PM value in µg/m3 (PM2.5)
  if(value <= 12) return '#7ee67a';
  if(value <= 35.4) return '#ffd66b';
  if(value <= 55.4) return '#ff9b6b';
  if(value <= 150.4) return '#ff7a7a';
  return '#c86bff';
}
function mapAQIIndexToLabel(idx){
  // WeatherAPI us-epa-index is 1-6 maybe; map to label/colors
  const map = {
    1: {label:'Good', color:'#7ee67a'},
    2: {label:'Moderate', color:'#ffd66b'},
    3: {label:'Unhealthy for Sensitive', color:'#ffb37a'},
    4: {label:'Unhealthy', color:'#ff7a7a'},
    5: {label:'Very Unhealthy', color:'#c86bff'},
    6: {label:'Hazardous', color:'#8b3a3a'}
  };
  return map[idx] || null;
}

/* Forecast cards */
function renderForecastCards(days){
  if (!days || days.length === 0) {
    console.warn('No forecast days to render');
    forecastRow.innerHTML = '<div class="day-card" style="opacity:0.6">No forecast data available</div>';
    return;
  }
  
  forecastRow.innerHTML = '';
  days.forEach((d, i) => {
    try {
      const date = new Date(d.date);
      const name = i === 0 ? 'Today' : date.toLocaleDateString(undefined,{weekday:'short'});
      const card = document.createElement('div');
      card.className = 'day-card';
      
      // Safely access temperature and condition data
      const avgTemp = d.day?.avgtemp_c ? Math.round(d.day.avgtemp_c) : '--';
      const condition = d.day?.condition?.text || 'Unknown';
      const precipitation = d.day?.totalprecip_mm !== undefined ? d.day.totalprecip_mm : '--';
      
      card.innerHTML = `
        <div class="date">${name}</div>
        <div style="font-weight:700">${avgTemp}°C</div>
        <div class="mini">${condition}</div>
        <div class="mini">${precipitation} mm</div>
      `;
      
      card.addEventListener('click', ()=> { 
        renderHourlyForDay(d); 
        highlightSelectedCard(card); 
      });
      
      forecastRow.appendChild(card);
      
      // auto-click first day
      if(i === 0) {
        setTimeout(() => card.click(), 100);
      }
    } catch (error) {
      console.error('Error rendering forecast card:', error);
      const errorCard = document.createElement('div');
      errorCard.className = 'day-card';
      errorCard.style.opacity = '0.5';
      errorCard.innerHTML = '<div class="date">Error</div><div class="mini">Data unavailable</div>';
      forecastRow.appendChild(errorCard);
    }
  });
}
function highlightSelectedCard(card){
  Array.from(forecastRow.children).forEach(c=>c.style.boxShadow='none');
  card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.4)';
}

/* Choose animated scene with enhanced condition mapping */
function chooseScene(current, forecastDays){
  const cond = (current.condition?.text || '').toLowerCase();
  const isNight = current.is_day === 0;
  
  // More comprehensive condition mapping
  // priority: thunder > rain > snow > fog > windy > cloudy > sunny/night
  if(cond.includes('thunder') || cond.includes('storm')) {
    setScene('thunder', current);
  } else if(cond.includes('rain') || cond.includes('shower')) {
    setScene('rain', current);
  } else if(cond.includes('drizzle') || cond.includes('light rain')) {
    setScene('rain', current); // Use rain scene for drizzle too
  } else if(cond.includes('snow') || cond.includes('sleet') || cond.includes('blizzard') || cond.includes('flurr')) {
    setScene('snow', current);
  } else if(cond.includes('mist') || cond.includes('fog') || cond.includes('haze') || cond.includes('smoke') || cond.includes('dust')) {
    setScene('fog', current);
  } else if(cond.includes('wind') || cond.includes('breeze') || cond.includes('gust') || (current.wind_kph > 30)) {
    setScene('wind', current);
  } else if(cond.includes('cloud') || cond.includes('overcast') || cond.includes('partly')) {
    setScene('cloudy', current);
  } else if(cond.includes('clear') || cond.includes('sunny')) {
    setScene(isNight ? 'night' : 'sunny', current);
  } else {
    // Default based on time of day
    setScene(isNight ? 'night' : 'sunny', current);
  }
}

/* Scene functions: sets CSS class and populates art + animations */
let activeTimers = [];
function resetSceneImmediate(){
  // clear timers & elements
  activeTimers.forEach(t => clearInterval(t));
  activeTimers = [];
  Array.from(scene.querySelectorAll('.raindrop, .splash, .snowflake, .sun-rays, .flash, .star')).forEach(n => n.remove());
  // clear art
  art.innerHTML = '';
  scene.className = 'scene';
}
function setScene(name, current){
  resetSceneImmediate();
  scene.classList.add(name);
  
  // Set the weather icon with enhanced loading
  art.innerHTML = getSVGForScene(name);
  
  // Add icon-specific enhancements with delayed loading for smooth experience
  setTimeout(() => {
    const icon = art.querySelector('.weather-icon');
    if(icon && icon.complete) {
      // Add pulsing effect for sunny weather
      if(name === 'sunny') {
        icon.style.animation = 'icon-pulse 3.5s ease-in-out infinite';
        icon.style.filter += ' brightness(1.1)';
      }
      // Add gentle sway for night
      if(name === 'night') {
        icon.style.animation = 'icon-sway 4.5s ease-in-out infinite';
        icon.style.filter += ' hue-rotate(220deg) brightness(0.85)';
      }
      // Add shake effect for thunder with intensity
      if(name === 'thunder') {
        icon.style.animation = 'icon-shake 0.7s ease-in-out infinite';
        icon.style.filter += ' contrast(1.2) brightness(1.1)';
      }
      // Add gentle bounce for rain/snow
      if(name === 'rain') {
        icon.style.animation = 'icon-bounce 2.2s ease-in-out infinite';
        icon.style.filter += ' hue-rotate(10deg)';
      }
      if(name === 'snow') {
        icon.style.animation = 'icon-bounce 2.8s ease-in-out infinite';
        icon.style.filter += ' brightness(1.05)';
      }
      // Add subtle sway for cloudy
      if(name === 'cloudy') {
        icon.style.animation = 'icon-sway 5s ease-in-out infinite';
        icon.style.filter += ' contrast(0.95)';
      }
      // Add gentle pulse for fog
      if(name === 'fog') {
        icon.style.animation = 'icon-pulse 4s ease-in-out infinite';
        icon.style.filter += ' opacity(0.9) blur(0.5px)';
      }
    }
  }, 100);
  
  // Spawn weather effects (wind effects removed for performance)
  if(name === 'rain') spawnRain();
  if(name === 'snow') spawnSnow();
  if(name === 'sunny') spawnSunRays();
  if(name === 'thunder') { spawnRain(); spawnThunder(); }
  if(name === 'night') spawnNightStars();
  // Wind and fog effects removed to prevent lag
}

/* Weather icon assets mapping and loading */
function getWeatherIconPath(name) {
  const iconMap = {
    'sunny': 'assets/clear.svg',
    'night': 'assets/clear.svg', // Use same as sunny but will apply night scene styling
    'cloudy': 'assets/clouds.svg',
    'rain': 'assets/rain.svg',
    'thunder': 'assets/thunderstorm.svg',
    'snow': 'assets/snow.svg',
    'fog': 'assets/atmosphere.svg',
    'wind': 'assets/atmosphere.svg' // atmosphere works well for wind
  };
  return iconMap[name] || 'assets/clear.svg';
}

/* Enhanced icon rendering with fallback support */
function getSVGForScene(name){
  const iconPath = getWeatherIconPath(name);
  const isPreloaded = preloadedIcons.get(iconPath);
  
  // Create an img element for the SVG asset with enhanced styling
  const imgElement = `
    <div class="icon-container" style="position: relative; display: inline-block;">
      <img 
        src="${iconPath}" 
        alt="${name} weather icon"
        class="weather-icon ${name}-icon"
        style="
          filter: drop-shadow(0 4px 12px rgba(0,0,0,0.25));
          transition: all 0.8s ease;
          max-width: 100%;
          height: auto;
          opacity: ${isPreloaded === false ? '0.8' : '1'};
        "
        onerror="handleIconError(this, '${name}')"
        onload="this.style.opacity='1'; console.log('Icon loaded: ${name}');"
        loading="${isPreloaded ? 'eager' : 'lazy'}"
      />
      <div class="fallback-icon" style="display: none;">
        ${getFallbackIcon(name)}
      </div>
      <div class="loading-indicator" style="
        display: ${isPreloaded === false ? 'flex' : 'none'};
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.1);
        border-radius: 12px;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: var(--muted);
        pointer-events: none;
      ">
        Loading...
      </div>
    </div>
  `;
  
  return imgElement;
}

/* Fallback icons for when assets fail to load */
function getFallbackIcon(name) {
  const fallbacks = {
    'sunny': '☀️',
    'night': '🌙',
    'cloudy': '☁️',
    'rain': '🌧️',
    'thunder': '⛈️',
    'snow': '❄️',
    'fog': '🌫️',
    'wind': '💨'
  };
  return fallbacks[name] || '🌤️';
}

/* Animations: spawn raindrops, snowflakes, wind gusts, sun rays, thunder, fog, stars */
let spawnTimers = [];
function spawnRain(){
  const count = 32;
  for(let i=0;i<count;i++) createRaindrop();
  const t = setInterval(()=> { for(let i=0;i<6;i++) createRaindrop(); }, 1600);
  spawnTimers.push(t);
}
function createRaindrop(){
  const d = document.createElement('div');
  d.className = 'raindrop';
  d.style.position = 'absolute';
  const left = Math.random()*100;
  d.style.left = left + '%';
  d.style.top = -20 + 'px';
  const dur = 0.8 + Math.random()*1.2;
  d.style.animation = `raindrop-fall ${dur}s linear forwards`;
  d.style.opacity = (0.4 + Math.random()*0.6);
  scene.appendChild(d);
  // splash:
  setTimeout(()=>{
    const s = document.createElement('div'); s.className='splash';
    s.style.position='absolute'; s.style.left = `calc(${left}% - 12px)`; s.style.bottom = '28px';
    scene.appendChild(s);
    setTimeout(()=> s.remove(), 900);
    d.remove();
  }, dur*1000);
}
function spawnSnow(){
  const count = 26;
  for(let i=0;i<count;i++) createSnowflake();
  const t = setInterval(()=> { for(let i=0;i<4;i++) createSnowflake(); }, 2200);
  spawnTimers.push(t);
}
function createSnowflake(){
  const s = document.createElement('div');
  s.className = 'snowflake';
  s.style.position='absolute';
  s.style.left = (Math.random()*100)+'%';
  s.style.top = (-10 - Math.random()*30)+'px';
  const dur = 6 + Math.random()*8;
  s.style.animation = `snow-fall ${dur}s linear forwards`;
  s.style.width = s.style.height = (6 + Math.random()*10) + 'px';
  scene.appendChild(s);
  setTimeout(()=> s.remove(), dur*1000 + 300);
}
// Wind effects removed to prevent performance issues
function spawnSunRays(){
  const rays = document.createElement('div');
  rays.className = 'sun-rays';
  rays.style.position='absolute';
  rays.style.width='260px'; rays.style.height='260px'; rays.style.borderRadius='50%';
  rays.style.mixBlendMode='screen'; rays.style.opacity='0.9';
  rays.style.background = 'conic-gradient(from 0deg, rgba(255,230,140,0.35) 0deg 25deg, transparent 25deg 40deg, rgba(255,230,140,0.28) 40deg 60deg, transparent 60deg 360deg)';
  rays.style.animation = 'spin-slow 14s linear infinite';
  scene.appendChild(rays);
}
function spawnThunder(){
  const flash = document.createElement('div'); flash.className='flash';
  flash.style.position='absolute'; flash.style.inset='0'; flash.style.background='rgba(255,255,255,0.6)'; flash.style.opacity='0'; flash.style.pointerEvents='none';
  scene.appendChild(flash);
  const t = setInterval(()=>{
    flash.style.animation = 'none';
    void flash.offsetWidth;
    flash.style.animation = 'flash-anim 700ms ease-out';
    createBolt();
  }, 2300 + Math.random()*2000);
  spawnTimers.push(t);
}
function createBolt(){
  const bolt = document.createElement('div');
  bolt.innerHTML = `<svg viewBox="0 0 24 24" width="44" height="44"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="#fff49a" /></svg>`;
  bolt.style.position='absolute'; bolt.style.left = (30 + Math.random()*40)+'%'; bolt.style.top = (20 + Math.random()*30)+'%'; bolt.style.opacity='0.95';
  scene.appendChild(bolt); setTimeout(()=> bolt.remove(), 900);
}
// Fog effects removed to prevent performance issues
function spawnNightStars(){
  const count = 18;
  for(let i=0;i<count;i++){
    const s = document.createElement('div');
    s.className='star'; s.style.position='absolute'; s.style.left=(5 + Math.random()*90)+'%'; s.style.top=(5 + Math.random()*70)+'%';
    const size = (2 + Math.random()*4); s.style.width = s.style.height = size + 'px'; s.style.borderRadius='50%';
    s.style.background='linear-gradient(180deg,#fff,#cfe6ff)'; s.style.opacity=0.9;
    scene.appendChild(s);
    setTimeout(()=> s.remove(), 6000 + Math.random()*7000);
  }
  const t = setInterval(()=> spawnNightStars(), 8000);
  spawnTimers.push(t);
}

/* Clear spawn timers */
function clearSpawnTimers(){
  spawnTimers.forEach(t=> clearInterval(t));
  spawnTimers = [];
}

/* -------------------------
   Charts: hourly temperature & AQI
   ------------------------- */
function buildHourlyAndAQICharts(data){
  if (!data.forecast || !data.forecast.forecastday || data.forecast.forecastday.length === 0) {
    console.warn('No forecast data available for charts');
    msg.textContent = 'No forecast data available';
    return;
  }
  
  // flatten next 24 hours from forecast data
  const next24 = [];
  const now = new Date(data.location.localtime);
  
  // iterate forecastday's hours starting from current hour
  for(let day of data.forecast.forecastday){
    for(let h of day.hour){
      const dt = new Date(h.time);
      if(dt >= now && next24.length < 24) next24.push(h);
    }
  }
  
  // fallback: ensure at least hours pulled
  if(next24.length < 8){
    next24.length = 0;
    const flat = data.forecast.forecastday.flatMap(d=>d.hour);
    for(let h of flat.slice(0,24)) next24.push(h);
  }

  const labels = next24.map(h=> {
    const dt = new Date(h.time);
    return dt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  });
  const tempsC = next24.map(h => h.temp_c);
  const tempsF = next24.map(h => h.temp_f);

  // AQI for hourly: some APIs provide air_quality per hour under "air_quality"
  const pm25 = next24.map(h => h.air_quality?.pm2_5 ?? null);
  const pm10 = next24.map(h => h.air_quality?.pm10 ?? null);

  // Check if Chart.js is loaded
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded! Charts will not work.');
    msg.textContent = 'Chart.js library not loaded - charts disabled';
    return;
  }
  
  // destroy old charts if exist
  if(tempChart) tempChart.destroy();
  if(aqiChart) aqiChart.destroy();

  const tempCanvas = el('tempChart');
  const aqiCanvas = el('aqiChart');
  
  if (!tempCanvas || !aqiCanvas) {
    console.error('Chart canvas elements not found!');
    msg.textContent = 'Chart canvases not found in HTML';
    return;
  }
  
  const ctxTemp = tempCanvas.getContext('2d');
  try {
    tempChart = new Chart(ctxTemp, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Temperature',
            data: isCelsius ? tempsC : tempsF,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 3,
            fill: true,
            backgroundColor: 'rgba(110,193,228,0.12)',
            borderColor: 'rgba(110,193,228,0.95)',
          }
        ]
      },
      options: {
        responsive:true,
        maintainAspectRatio: false,
        plugins:{legend:{display:false},tooltip:{mode:'index',intersect:false}},
        scales:{
          y:{
            title:{display:true,text: isCelsius ? '°C' : '°F'},
            beginAtZero: false
          }
        }
      }
    });
  } catch (error) {
    console.error('Error creating temperature chart:', error);
    msg.textContent = 'Error creating temperature chart: ' + error.message;
  }

  // Create AQI chart with enhanced data processing
  const ctxAQI = aqiCanvas.getContext('2d');
  const aqiDatasets = [];
  
  // Extract additional AQI data from the API response
  const co = next24.map(h => h.air_quality?.co ?? null);
  const no2 = next24.map(h => h.air_quality?.no2 ?? null);
  const o3 = next24.map(h => h.air_quality?.o3 ?? null);
  const so2 = next24.map(h => h.air_quality?.so2 ?? null);
  
  // Add PM2.5 dataset
  if(pm25.some(v => v !== null && v > 0)){
    aqiDatasets.push({
      label:'PM2.5',
      data: pm25.map(v => v === null || v === 0 ? null : Math.round(v * 10) / 10),
      borderColor:'#ff6b6b',
      backgroundColor:'rgba(255,107,107,0.1)',
      tension:0.3,
      borderWidth: 2,
      pointRadius: 1,
      spanGaps:true
    });
  }
  
  // Add PM10 dataset
  if(pm10.some(v => v !== null && v > 0)){
    aqiDatasets.push({
      label:'PM10',
      data: pm10.map(v => v === null || v === 0 ? null : Math.round(v * 10) / 10),
      borderColor:'#4ecdc4',
      backgroundColor:'rgba(78,205,196,0.1)',
      tension:0.3,
      borderWidth: 2,
      pointRadius: 1,
      spanGaps:true
    });
  }
  
  // Add CO dataset (convert to mg/m³)
  if(co.some(v => v !== null && v > 0)){
    aqiDatasets.push({
      label:'CO (mg/m³)',
      data: co.map(v => v === null || v === 0 ? null : Math.round(v * 100) / 100),
      borderColor:'#feca57',
      backgroundColor:'rgba(254,202,87,0.1)',
      tension:0.3,
      borderWidth: 2,
      pointRadius: 1,
      spanGaps:true
    });
  }
  
  // Add NO2 dataset
  if(no2.some(v => v !== null && v > 0)){
    aqiDatasets.push({
      label:'NO2',
      data: no2.map(v => v === null || v === 0 ? null : Math.round(v * 10) / 10),
      borderColor:'#ff9ff3',
      backgroundColor:'rgba(255,159,243,0.1)',
      tension:0.3,
      borderWidth: 2,
      pointRadius: 1,
      spanGaps:true
    });
  }

  // Create AQI chart
  if (aqiDatasets.length > 0) {
    try {
      aqiChart = new Chart(ctxAQI, {
        type:'line',
        data:{
          labels,
          datasets: aqiDatasets
        },
        options:{
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins:{
            legend: {
              display: true,
              position: 'top',
              labels: {
                usePointStyle: true,
                padding: 15
              }
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(0,0,0,0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1
            }
          },
          scales: {
            x: {
              grid: {
                color: 'rgba(255,255,255,0.1)'
              }
            },
            y: {
              title: {
                display: true,
                text: 'Concentration (µg/m³)',
                color: '#fff'
              },
              beginAtZero: true,
              grid: {
                color: 'rgba(255,255,255,0.1)'
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Error creating AQI chart:', error);
      // Create a simple fallback chart
      aqiChart = new Chart(ctxAQI, {
        type:'line',
        data:{
          labels: ['No Data'],
          datasets: [{
            label: 'AQI Data Unavailable',
            data: [0],
            borderColor: '#666',
            backgroundColor: 'rgba(102,102,102,0.1)'
          }]
        },
        options:{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
          scales: { y: { beginAtZero: true } }
        }
      });
    }
  } else {
    // Create placeholder chart when no AQI data is available
    aqiChart = new Chart(ctxAQI, {
      type:'line',
      data:{
        labels: ['No AQI Data Available'],
        datasets: [{
          label: 'AQI data not provided for this location',
          data: [0],
          borderColor: '#555',
          backgroundColor: 'rgba(85,85,85,0.1)',
          pointRadius: 0
        }]
      },
      options:{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          tooltip: { enabled: false }
        },
        scales: {
          y: {
            title: { display: true, text: 'No Data' },
            beginAtZero: true,
            max: 10
          }
        }
      }
    });
  }

  // update labels for UI
  selectedDayLabel.textContent = 'Next 24 hours';
  aqiNowLabel.textContent = 'Now';
}

/* Render hourly chart for a selected day (forecastday.hour) */
function renderHourlyForDay(day){
  const hours = day.hour;
  const labels = hours.map(h => new Date(h.time).toLocaleTimeString([], {hour:'2-digit','minute':'2-digit'}));
  const tempsC = hours.map(h => h.temp_c);
  const tempsF = hours.map(h => h.temp_f);
  const pm25 = hours.map(h => h.air_quality?.pm2_5 ?? null);
  // update temp chart
  if(tempChart) tempChart.destroy();
  const ctxTemp = el('tempChart').getContext('2d');
  tempChart = new Chart(ctxTemp, {
    type:'line',
    data:{
      labels,
      datasets:[{
        label:'Temp',
        data: isCelsius ? tempsC : tempsF,
        borderColor:'rgba(103,199,255,0.95)', backgroundColor:'rgba(103,199,255,0.12)',
        tension:0.3, pointRadius:3
      }]
    },
    options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{title:{display:true,text:isCelsius?'°C':'°F'}}}}
  });

  // AQI chart for that day
  if(aqiChart) aqiChart.destroy();
  const ctxAQI = el('aqiChart').getContext('2d');
  aqiChart = new Chart(ctxAQI, {
    type:'line',
    data:{
      labels,
      datasets:[
        {
          label:'PM2.5',
          data: pm25.map(v=> v===null ? null : Math.round(v*10)/10),
          borderColor:'#ff7a7a', backgroundColor:'rgba(255,122,122,0.12)', tension:0.3, spanGaps:true
        }
      ]
    },
    options:{responsive:true,plugins:{legend:{display:true}},scales:{y:{title:{display:true,text:'µg/m³'}}}}
  });

  selectedDayLabel.textContent = new Date(day.date).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
}

/* -------------------------
   Event handlers
   ------------------------- */
searchBtn.addEventListener('click', ()=> {
  const q = input.value.trim(); if(!q){ msg.textContent='Enter a location'; return; } msg.textContent=''; fetchForecast(q);
});
input.addEventListener('keydown', (e)=> { if(e.key==='Enter') searchBtn.click(); });

geoBtn.addEventListener('click', ()=> {
  if(!navigator.geolocation){ msg.textContent='Geolocation not supported'; return; }
  setLoading(true,'Locating…');
  navigator.geolocation.getCurrentPosition((pos)=>{
    setLoading(false);
    const val = `${pos.coords.latitude.toFixed(4)},${pos.coords.longitude.toFixed(4)}`;
    input.value = val; fetchForecast(val);
  }, (err)=>{ setLoading(false); msg.textContent='Unable to get location: ' + err.message; }, {timeout:10000});
});

demoBtn.addEventListener('click', ()=> {
  const samples = ['London','New York','Tokyo','Mumbai','Reykjavik','Cairo','Paris','Sydney'];
  const pick = samples[Math.floor(Math.random()*samples.length)];
  input.value = pick; fetchForecast(pick);
});
clearBtn.addEventListener('click', ()=> { input.value=''; msg.textContent=''; });

el('unitToggle').addEventListener('click', ()=>{
  isCelsius = !isCelsius; el('unitToggle').textContent = isCelsius ? 'C' : 'F';
  // refresh last query
  if(lastQuery) fetchForecast(lastQuery);
});

/* Preload weather icon assets for better performance */
let preloadedIcons = new Map();
function preloadWeatherIcons() {
  const iconPaths = [
    'assets/clear.svg',
    'assets/clouds.svg', 
    'assets/rain.svg',
    'assets/thunderstorm.svg',
    'assets/snow.svg',
    'assets/atmosphere.svg',
    'assets/drizzle.svg'
  ];
  
  iconPaths.forEach(path => {
    const img = new Image();
    img.onload = () => {
      preloadedIcons.set(path, true);
      console.log(`✓ Preloaded: ${path}`);
    };
    img.onerror = () => {
      preloadedIcons.set(path, false);
      console.warn(`✗ Failed to preload: ${path}`);
    };
    img.src = path;
  });
}

/* Enhanced error handling for weather icons */
function handleIconError(iconElement, sceneName) {
  console.warn(`Failed to load weather icon for scene: ${sceneName}`);
  
  // Hide the failed icon and show fallback
  iconElement.style.display = 'none';
  const fallback = iconElement.nextElementSibling;
  if (fallback && fallback.classList.contains('fallback-icon')) {
    fallback.style.display = 'flex';
    // Add a subtle animation to indicate fallback is active
    fallback.style.animation = 'fadeIn 0.5s ease-in';
  }
  
  // Try to recover by retrying the load once
  setTimeout(() => {
    if (iconElement.src && !iconElement.complete) {
      console.log(`Retrying icon load for: ${sceneName}`);
      const originalSrc = iconElement.src;
      iconElement.src = '';
      iconElement.src = originalSrc;
    }
  }, 2000);
}

/* Initialize with a default and preload icons */
preloadWeatherIcons();
fetchForecast('London');

/* Accessibility: respect reduced motion (already honored by CSS) */

/* -------------------------
   Utility: remove spawn timers when navigating or on new scene
   ------------------------- */
function resetAllSceneTimers(){
  clearSpawnTimers();
  resetSceneImmediate();
}
window.addEventListener('beforeunload', ()=> resetAllSceneTimers());

