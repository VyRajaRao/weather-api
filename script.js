
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
  if(!data) return;
  const cur = data.current;
  const loc = data.location;

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
  forecastRow.innerHTML = '';
  days.forEach((d, i) => {
    const date = new Date(d.date);
    const name = i === 0 ? 'Today' : date.toLocaleDateString(undefined,{weekday:'short'});
    const card = document.createElement('div');
    card.className = 'day-card';
    card.innerHTML = `<div class="date">${name}</div>
                      <div style="font-weight:700">${Math.round(d.day.avgtemp_c)}°C</div>
                      <div class="mini">${d.day.condition.text}</div>
                      <div class="mini">${d.day.totalprecip_mm} mm</div>`;
    card.addEventListener('click', ()=> { renderHourlyForDay(d); highlightSelectedCard(card); });
    forecastRow.appendChild(card);
    // auto-click first day
    if(i === 0) card.click();
  });
}
function highlightSelectedCard(card){
  Array.from(forecastRow.children).forEach(c=>c.style.boxShadow='none');
  card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.4)';
}

/* Choose animated scene */
function chooseScene(current, forecastDays){
  const cond = (current.condition?.text || '').toLowerCase();
  const isNight = current.is_day === 0;

  // priority: thunder > rain > snow > fog > windy > cloudy > sunny/night
  if(cond.includes('thunder') || cond.includes('storm')) {
    setScene('thunder', current);
  } else if(cond.includes('rain') || cond.includes('drizzle') || cond.includes('shower')) {
    setScene('rain', current);
  } else if(cond.includes('snow') || cond.includes('sleet') || cond.includes('blizzard')) {
    setScene('snow', current);
  } else if(cond.includes('mist') || cond.includes('fog') || cond.includes('haze')) {
    setScene('fog', current);
  } else if(cond.includes('wind') || cond.includes('breeze') || (current.wind_kph > 30)) {
    setScene('wind', current);
  } else if(cond.includes('cloud') || cond.includes('overcast')) {
    setScene('cloudy', current);
  } else {
    setScene(isNight ? 'night' : 'sunny', current);
  }
}

/* Scene functions: sets CSS class and populates art + animations */
let activeTimers = [];
function resetSceneImmediate(){
  // clear timers & elements
  activeTimers.forEach(t => clearInterval(t));
  activeTimers = [];
  Array.from(scene.querySelectorAll('.raindrop, .splash, .snowflake, .gust, .sun-rays, .flash, .star')).forEach(n => n.remove());
  // clear art
  art.innerHTML = '';
  scene.className = 'scene';
}
function setScene(name, current){
  resetSceneImmediate();
  scene.classList.add(name);
  art.innerHTML = getSVGForScene(name);
  if(name === 'rain') spawnRain();
  if(name === 'snow') spawnSnow();
  if(name === 'wind') spawnWind();
  if(name === 'sunny') spawnSunRays();
  if(name === 'thunder') { spawnRain(); spawnThunder(); }
  if(name === 'fog') spawnFog();
  if(name === 'cloudy') spawnWind(true);
  if(name === 'night') spawnNightStars();
}

/* SVG art strings */
function getSVGForScene(name){
  if(name === 'sunny') return `
    <svg viewBox="0 0 64 64" width="120" height="120" aria-hidden="true">
      <defs><radialGradient id="sg"><stop offset="0" stop-color="#fff7d0"/><stop offset="1" stop-color="#ffd166"/></radialGradient></defs>
      <circle cx="32" cy="28" r="14" fill="url(#sg)"/>
      <g stroke="#ffd166" stroke-width="2" stroke-linecap="round">
        <line x1="32" y1="2" x2="32" y2="14"/>
        <line x1="32" y1="50" x2="32" y2="62"/>
        <line x1="2" y1="28" x2="14" y2="28"/>
        <line x1="50" y1="28" x2="62" y2="28"/>
      </g>
    </svg>`;
  if(name === 'night') return `
    <svg viewBox="0 0 64 64" width="120" height="120">
      <circle cx="40" cy="24" r="12" fill="#f4f7ff" />
      <path d="M48 20c0 11-9 20-20 20-1.6 0-3.2-.18-4.7-.51 6.6 5 16.1 5.4 22.7.3C55 36 56 28 56 28s.7-9-8-8z" fill="#071226" opacity="0.28"/>
    </svg>`;
  if(name === 'cloudy') return `
    <svg viewBox="0 0 64 64" width="120" height="120"><ellipse cx="30" cy="36" rx="18" ry="10" fill="#ffffff" opacity="0.95"/><ellipse cx="42" cy="32" rx="12" ry="8" fill="#ffffff" opacity="0.95"/></svg>`;
  if(name === 'rain' || name === 'thunder') return `
    <svg viewBox="0 0 64 64" width="120" height="120"><ellipse cx="30" cy="30" rx="18" ry="10" fill="#ffffff" opacity="0.95"/><ellipse cx="42" cy="26" rx="12" ry="8" fill="#ffffff" opacity="0.95"/></svg>`;
  if(name === 'snow') return `
    <svg viewBox="0 0 64 64" width="120" height="120"><ellipse cx="32" cy="28" rx="18" ry="10" fill="#fff"/><g transform="translate(10,34)" fill="#eaf6ff"><circle cx="8" cy="12" r="2"/><circle cx="22" cy="16" r="2"/><circle cx="36" cy="12" r="2"/></g></svg>`;
  if(name === 'fog') return `
    <svg viewBox="0 0 64 64" width="120" height="120"><ellipse cx="32" cy="28" rx="18" ry="10" fill="#fff" opacity="0.9"/><rect x="8" y="40" width="48" height="4" rx="2" fill="#ffffff" opacity="0.14"/></svg>`;
  return `<div style="font-size:12px;color:var(--muted)">--</div>`;
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
function spawnWind(cloudy=false){
  const lines = cloudy ? 4 : 6;
  for(let i=0;i<lines;i++){
    const g = document.createElement('div');
    g.className = 'gust';
    g.style.position='absolute'; g.style.left='-30%';
    g.style.top = (10 + i*10 + Math.random()*40) + 'px';
    g.style.width = (120 + Math.random()*260) + 'px'; g.style.opacity = (0.4 + Math.random()*0.5);
    g.style.animation = `gust ${4 + Math.random()*2}s cubic-bezier(.2,.8,.2,.9) forwards`;
    scene.appendChild(g);
    setTimeout(()=> g.remove(), 4500);
  }
  const t = setInterval(()=> spawnWind(cloudy), 3800);
  spawnTimers.push(t);
}
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
function spawnFog(){
  for(let i=0;i<3;i++){
    const f = document.createElement('div');
    f.style.position='absolute'; f.style.left='-10%'; f.style.width='120%'; f.style.height='40px';
    f.style.top = (30 + i*36) + 'px'; f.style.background='linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.12), rgba(255,255,255,0.06))';
    f.style.opacity = 0.55; f.style.filter = 'blur(6px)'; f.style.transform = `translateX(-40%)`; f.style.transition = 'transform 10s linear';
    scene.appendChild(f);
    setTimeout(()=> f.style.transform = 'translateX(20%)', 100);
    setTimeout(()=> f.remove(), 11000);
  }
  const t = setInterval(()=> spawnFog(), 11000);
  spawnTimers.push(t);
}
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
    // add upcoming hours from first day just in case
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

  // destroy old charts if exist
  if(tempChart) tempChart.destroy();
  if(aqiChart) aqiChart.destroy();

  const ctxTemp = el('tempChart').getContext('2d');
  tempChart = new Chart(ctxTemp, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Temp',
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
      plugins:{legend:{display:false},tooltip:{mode:'index',intersect:false}},
      scales:{
        y:{
          title:{display:true,text: isCelsius ? '°C' : '°F'}
        }
      }
    }
  });

  const ctxAQI = el('aqiChart').getContext('2d');
  const aqiDatasets = [];
  // add PM2.5 if any non-null
  if(pm25.some(v=>v!==null)){
    aqiDatasets.push({
      label:'PM2.5',
      data: pm25.map(v=> v===null ? null : Math.round(v*10)/10),
      borderColor:'#ff7a7a',
      backgroundColor:'rgba(255,122,122,0.12)',
      tension:0.3,
      spanGaps:true
    });
  }
  if(pm10.some(v=>v!==null)){
    aqiDatasets.push({
      label:'PM10',
      data: pm10.map(v=> v===null ? null : Math.round(v*10)/10),
      borderColor:'#67c7ff',
      backgroundColor:'rgba(103,199,255,0.12)',
      tension:0.3,
      spanGaps:true
    });
  }

  aqiChart = new Chart(ctxAQI, {
    type:'line',
    data:{
      labels,
      datasets: aqiDatasets
    },
    options:{
      responsive:true,
      plugins:{legend:{display:true},tooltip:{mode:'index',intersect:false}},
      scales:{ y:{ title:{display:true,text:'µg/m³'} } }
    }
  });

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

/* Initialize with a default */
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

