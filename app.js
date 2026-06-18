// ===== WeatherNow — app.js =====
const GEO_API     = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
const GROQ_API    = 'https://api.groq.com/openai/v1/chat/completions';

// Real-time weather API integration with fallback support
let useEnhancedWeatherAPI = true;

// ===== State =====
let isCelsius          = true;
let currentWeatherData = null;
let currentLocation    = null;
let suggestionTimeout  = null;
let chatHistory        = [];
let groqApiKey       = localStorage.getItem('groq_api_key') || (typeof SKYSENSE_CONFIG !== 'undefined' ? SKYSENSE_CONFIG.groqApiKey : '');
let weatherProvider    = 'auto'; // 'auto', 'open-meteo', or 'openweather'

// ===== DOM =====
const searchInput     = document.getElementById('searchInput');
const searchBtn       = document.getElementById('searchBtn');
const suggestions     = document.getElementById('suggestions');
const statusMsg       = document.getElementById('statusMsg');
const content         = document.getElementById('content');
const unitToggle      = document.getElementById('unitToggle');
const geoBtn          = document.getElementById('geoBtn');
const mapBtn          = document.getElementById('mapBtn');
const mapModal        = document.getElementById('mapModal');
const mapModalClose   = document.getElementById('mapModalClose');
const mapConfirmBtn   = document.getElementById('mapConfirmBtn');
const mapSelectedInfo = document.getElementById('mapSelectedInfo');

// ===== Weather Code Map =====
const weatherCodes = {
  0:  { label: 'Clear Sky',            icon: '☀️', theme: 'clear'   },
  1:  { label: 'Mainly Clear',         icon: '🌤️', theme: 'clear'   },
  2:  { label: 'Partly Cloudy',        icon: '⛅',  theme: 'cloudy'  },
  3:  { label: 'Overcast',             icon: '☁️',  theme: 'cloudy'  },
  45: { label: 'Foggy',                icon: '🌫️', theme: 'fog'     },
  48: { label: 'Rime Fog',             icon: '🌫️', theme: 'fog'     },
  51: { label: 'Light Drizzle',        icon: '🌦️', theme: 'rain'    },
  53: { label: 'Moderate Drizzle',     icon: '🌦️', theme: 'rain'    },
  55: { label: 'Dense Drizzle',        icon: '🌧️', theme: 'rain'    },
  61: { label: 'Slight Rain',          icon: '🌧️', theme: 'rain'    },
  63: { label: 'Moderate Rain',        icon: '🌧️', theme: 'rain'    },
  65: { label: 'Heavy Rain',           icon: '🌧️', theme: 'rain'    },
  71: { label: 'Slight Snow',          icon: '🌨️', theme: 'snow'    },
  73: { label: 'Moderate Snow',        icon: '🌨️', theme: 'snow'    },
  75: { label: 'Heavy Snow',           icon: '❄️',  theme: 'snow'    },
  77: { label: 'Snow Grains',          icon: '🌨️', theme: 'snow'    },
  80: { label: 'Slight Showers',       icon: '🌦️', theme: 'rain'    },
  81: { label: 'Moderate Showers',     icon: '🌧️', theme: 'rain'    },
  82: { label: 'Violent Showers',      icon: '⛈️',  theme: 'thunder' },
  85: { label: 'Slight Snow Showers',  icon: '🌨️', theme: 'snow'    },
  86: { label: 'Heavy Snow Showers',   icon: '❄️',  theme: 'snow'    },
  95: { label: 'Thunderstorm',         icon: '⛈️',  theme: 'thunder' },
  96: { label: 'Thunderstorm w/ Hail', icon: '⛈️',  theme: 'thunder' },
  99: { label: 'Heavy Thunderstorm',   icon: '⛈️',  theme: 'thunder' },
};

function getWeatherInfo(code) {
  return weatherCodes[code] || { label: 'Unknown', icon: '🌡️', theme: 'cloudy' };
}

// ===== Helpers =====
function degToCompass(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function uvLabel(uv) {
  if (uv <= 2)  return `${uv} Low`;
  if (uv <= 5)  return `${uv} Moderate`;
  if (uv <= 7)  return `${uv} High`;
  if (uv <= 10) return `${uv} Very High`;
  return `${uv} Extreme`;
}

function toDisplay(celsius) {
  if (isCelsius) return `${Math.round(celsius)}°C`;
  return `${Math.round(celsius * 9/5 + 32)}°F`;
}

function rnd(min, max) { return Math.random() * (max - min) + min; }
function rand(a, b)    { return rnd(a, b); }

// ===== Status =====
function showStatus(msg, isError = false) {
  statusMsg.textContent = msg;
  statusMsg.className   = 'status-msg' + (isError ? ' error' : '');
  content.style.display = 'none';
}
function clearStatus() {
  statusMsg.textContent = '';
  statusMsg.className   = 'status-msg';
}
function showWelcome() {
  document.getElementById('welcomeScreen').style.display = 'flex';
  content.style.display = 'none';
  statusMsg.textContent = '';
  statusMsg.className   = 'status-msg';
}
function hideWelcome() {
  document.getElementById('welcomeScreen').style.display = 'none';
}

// ================================================================
//  SECTION 2 — FULL-SCREEN WEATHER BACKGROUND CANVAS
// ================================================================
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx    = bgCanvas.getContext('2d');
let   bgAnimId = null;

function resizeBgCanvas() { bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight; }
resizeBgCanvas();
window.addEventListener('resize', resizeBgCanvas);

function applyWeatherTheme(weatherCode, isDay) {
  const info = getWeatherInfo(weatherCode);
  const map  = { clear: isDay ? 'wx-clear-day' : 'wx-clear-night', cloudy: 'wx-cloudy',
                  fog: 'wx-fog', rain: 'wx-rain', thunder: 'wx-thunder', snow: 'wx-snow' };
  const cls  = map[info.theme] || 'wx-cloudy';
  document.body.className = document.body.className.split(' ').filter(c => !c.startsWith('wx-')).join(' ');
  document.body.classList.add(cls);
  if (bgAnimId) { cancelAnimationFrame(bgAnimId); bgAnimId = null; }
  const t = info.theme;
  if      (t === 'clear'   && isDay)  bgSceneSun();
  else if (t === 'clear'   && !isDay) bgSceneNight();
  else if (t === 'cloudy')            bgSceneCloudy(isDay);
  else if (t === 'rain')              bgSceneRain(false);
  else if (t === 'thunder')           bgSceneRain(true);
  else if (t === 'snow')              bgSceneSnow();
  else if (t === 'fog')               bgSceneFog();
  else                                bgSceneCloudy(isDay);
}

function bgSceneSun() {
  // Clouds with parallax effect and depth layers
  const clouds = Array.from({length: 12}, (_,i) => ({
    x: rnd(-0.2, 1.2),
    y: rnd(0.05, 0.5),
    w: rnd(0.12, 0.4),
    h: rnd(0.08, 0.22),
    sp: rnd(0.00002, 0.00012),
    op: rnd(0.06, 0.2),
    layer: i % 3,  // 0 = far, 1 = mid, 2 = near
    depth: i % 3,
    wobble: rnd(0, Math.PI * 2),
    wobbleSpeed: rnd(0.0008, 0.0015)
  }));

  // Floating dust particles for atmospheric depth
  const dust = Array.from({length: 100}, () => ({
    x: rnd(0, 1),
    y: rnd(0, 1),
    r: rnd(0.2, 2),
    op: rnd(0.01, 0.08),
    ph: rnd(0, Math.PI * 2),
    vx: rnd(-0.0001, 0.0001),
    vy: rnd(-0.00008, 0.00008),
    brightness: rnd(0.5, 1)
  }));

  // Light rays emanating from sun
  const rays = Array.from({length: 16}, (_, i) => ({
    angle: (i / 16) * Math.PI * 2,
    length: rnd(0.35, 0.65),
    op: rnd(0.04, 0.12),
    width: rnd(1.5, 5),
    wobble: rnd(0, Math.PI * 2)
  }));

  // Atmospheric particles (bokeh effect)
  const bokeh = Array.from({length: 40}, () => ({
    x: rnd(0, 1),
    y: rnd(0, 1),
    r: rnd(8, 35),
    op: rnd(0.01, 0.06),
    ph: rnd(0, Math.PI * 2),
    sp: rnd(0.5, 2.5)
  }));

  let t = 0;

  const draw = () => {
    const w = bgCanvas.width;
    const h = bgCanvas.height;

    // ===== BACKGROUND GRADIENT (SKY) =====
    const bg = bgCtx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1a5a6f');      // Top - deep teal
    bg.addColorStop(0.3, '#2d7f95');    // Upper - medium teal
    bg.addColorStop(0.6, '#4a9fb5');    // Mid - lighter teal
    bg.addColorStop(0.85, '#6ab5cc');   // Lower - light sky
    bg.addColorStop(1, '#7ac5d8');      // Bottom - very light sky
    bgCtx.fillStyle = bg;
    bgCtx.fillRect(0, 0, w, h);

    // ===== SUN POSITION (RIGHT SIDE) =====
    const sunX = w * 0.75;   // 75% from left (right side)
    const sunY = h * 0.18;   // 18% from top
    const sunRadius = Math.min(w, h) * 0.085;

    // ===== ATMOSPHERIC BOKEH (BACKGROUND EFFECT) =====
    bokeh.forEach(b => {
      const bokehAlpha = b.op * (0.5 + Math.sin(t * b.sp + b.ph) * 0.5);
      const bokehGradient = bgCtx.createRadialGradient(
        b.x * w, b.y * h, 0,
        b.x * w, b.y * h, b.r
      );
      bokehGradient.addColorStop(0, `rgba(253, 235, 158, ${bokehAlpha * 0.3})`);
      bokehGradient.addColorStop(0.5, `rgba(253, 235, 158, ${bokehAlpha * 0.1})`);
      bokehGradient.addColorStop(1, 'rgba(253, 235, 158, 0)');
      
      bgCtx.fillStyle = bokehGradient;
      bgCtx.beginPath();
      bgCtx.arc(b.x * w, b.y * h, b.r, 0, Math.PI * 2);
      bgCtx.fill();
    });

    // ===== LIGHT RAYS FROM SUN =====
    rays.forEach((ray, idx) => {
      const rayWobble = Math.sin(t * 0.5 + idx) * 0.1;
      const rayAngle = ray.angle + t * 0.2 + rayWobble;
      
      const rayEndX = sunX + Math.cos(rayAngle) * w * ray.length;
      const rayEndY = sunY + Math.sin(rayAngle) * h * ray.length;
      
      const rayGradient = bgCtx.createLinearGradient(sunX, sunY, rayEndX, rayEndY);
      rayGradient.addColorStop(0, `rgba(253, 235, 158, ${ray.op + Math.sin(t * 0.7 + idx) * 0.03})`);
      rayGradient.addColorStop(0.5, `rgba(253, 235, 158, ${ray.op * 0.5})`);
      rayGradient.addColorStop(1, 'rgba(253, 235, 158, 0)');
      
      bgCtx.strokeStyle = rayGradient;
      bgCtx.lineWidth = ray.width;
      bgCtx.lineCap = 'round';
      bgCtx.beginPath();
      bgCtx.moveTo(sunX, sunY);
      bgCtx.lineTo(rayEndX, rayEndY);
      bgCtx.stroke();
    });

    // ===== SUN GLOW LAYERS (ATMOSPHERIC) =====
    for (let i = 6; i > 0; i--) {
      const glowRadius = sunRadius * (1.1 + i * 1.3);
      const glowGradient = bgCtx.createRadialGradient(
        sunX - sunRadius * 0.2,
        sunY - sunRadius * 0.2,
        sunRadius * 0.2,
        sunX,
        sunY,
        glowRadius
      );
      
      const glowAlpha = 0.04 * i + Math.sin(t * 0.5) * 0.02;
      glowGradient.addColorStop(0, `rgba(253, 200, 80, ${glowAlpha})`);
      glowGradient.addColorStop(0.5, `rgba(253, 200, 80, ${glowAlpha * 0.4})`);
      glowGradient.addColorStop(1, 'rgba(253, 200, 80, 0)');
      
      bgCtx.fillStyle = glowGradient;
      bgCtx.beginPath();
      bgCtx.arc(sunX, sunY, glowRadius, 0, Math.PI * 2);
      bgCtx.fill();
    }

    // ===== SUN CORONA (ANIMATED RAYS) =====
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2 + t * 0.3;
      const pulse = 1 + Math.sin(t * 1.1 + i * 0.5) * 0.12;
      const r1 = sunRadius * 1.2 * pulse;
      const r2 = sunRadius * (2.6 + Math.sin(t * 0.8 + i * 0.6) * 0.5) * pulse;
      
      bgCtx.save();
      bgCtx.translate(sunX, sunY);
      bgCtx.rotate(angle);
      bgCtx.beginPath();
      bgCtx.moveTo(r1 * Math.cos(-0.07), r1 * Math.sin(-0.07));
      bgCtx.lineTo(r2, 0);
      bgCtx.lineTo(r1 * Math.cos(0.07), r1 * Math.sin(0.07));
      bgCtx.closePath();
      bgCtx.fillStyle = `rgba(253, 225, 100, ${0.09 + Math.sin(t * 0.9 + i) * 0.035})`;
      bgCtx.fill();
      bgCtx.restore();
    }

    // ===== MAIN SUN SPHERE =====
    const sunGradient = bgCtx.createRadialGradient(
      sunX - sunRadius * 0.3,
      sunY - sunRadius * 0.3,
      0,
      sunX,
      sunY,
      sunRadius
    );
    sunGradient.addColorStop(0, 'rgba(255, 254, 225, 0.99)');
    sunGradient.addColorStop(0.4, 'rgba(254, 220, 80, 0.95)');
    sunGradient.addColorStop(0.8, 'rgba(253, 200, 60, 0.9)');
    sunGradient.addColorStop(1, 'rgba(235, 170, 30, 0.8)');
    
    bgCtx.beginPath();
    bgCtx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    bgCtx.fillStyle = sunGradient;
    bgCtx.fill();

    // ===== SUN SHINE SPOT (HIGHLIGHT) =====
    const shineGradient = bgCtx.createRadialGradient(
      sunX - sunRadius * 0.4,
      sunY - sunRadius * 0.4,
      0,
      sunX - sunRadius * 0.4,
      sunY - sunRadius * 0.4,
      sunRadius * 0.5
    );
    shineGradient.addColorStop(0, 'rgba(255, 255, 240, 0.6)');
    shineGradient.addColorStop(1, 'rgba(255, 255, 240, 0)');
    
    bgCtx.fillStyle = shineGradient;
    bgCtx.beginPath();
    bgCtx.arc(sunX - sunRadius * 0.4, sunY - sunRadius * 0.4, sunRadius * 0.5, 0, Math.PI * 2);
    bgCtx.fill();

    // ===== CLOUDS (WITH DEPTH PARALLAX) =====
    clouds.sort((a, b) => a.layer - b.layer).forEach(cloud => {
      cloud.x += cloud.sp;
      cloud.wobble += cloud.wobbleSpeed;
      
      if (cloud.x > 1.3) cloud.x = -0.3;

      const cloudX = cloud.x * w;
      const cloudY = cloud.y * h + Math.sin(cloud.wobble) * h * 0.01;
      const cloudW = cloud.w * w;
      const cloudH = cloud.h * h;

      // Cloud color based on depth
      let cloudColor;
      if (cloud.depth === 0) cloudColor = '210, 230, 245';     // Far - lightest
      else if (cloud.depth === 1) cloudColor = '195, 220, 240'; // Mid
      else cloudColor = '175, 205, 230';                        // Near - darker

      // Draw cloud with 3 ellipses for fluffy appearance
      const cloudShapes = [
        [0.5, 0.55, 0.5, 0.45],
        [0.25, 0.44, 0.28, 0.38],
        [0.75, 0.48, 0.26, 0.35]
      ];

      cloudShapes.forEach(([ex, ey, ew, eh]) => {
        const cloudGradient = bgCtx.createRadialGradient(
          cloudX + cloudW * ex,
          cloudY + cloudH * ey,
          0,
          cloudX + cloudW * ex,
          cloudY + cloudH * ey,
          cloudW * ew * 1.4
        );

        cloudGradient.addColorStop(0, `rgba(${cloudColor}, ${cloud.op + 0.03})`);
        cloudGradient.addColorStop(0.6, `rgba(${cloudColor}, ${cloud.op * 0.5})`);
        cloudGradient.addColorStop(1, `rgba(${cloudColor}, 0)`);

        bgCtx.fillStyle = cloudGradient;
        bgCtx.beginPath();
        bgCtx.ellipse(
          cloudX + cloudW * ex,
          cloudY + cloudH * ey,
          cloudW * ew,
          cloudH * eh,
          0,
          0,
          Math.PI * 2
        );
        bgCtx.fill();
      });
    });

    // ===== FLOATING DUST PARTICLES =====
    dust.forEach(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;

      // Wrap around
      if (particle.x < -0.05) particle.x = 1.05;
      if (particle.x > 1.05) particle.x = -0.05;
      if (particle.y < -0.05) particle.y = 1.05;
      if (particle.y > 1.05) particle.y = -0.05;

      const dustAlpha = particle.op * particle.brightness * (0.4 + Math.sin(t * 0.7 + particle.ph) * 0.5);
      bgCtx.beginPath();
      bgCtx.arc(particle.x * w, particle.y * h, particle.r, 0, Math.PI * 2);
      bgCtx.fillStyle = `rgba(253, 240, 180, ${dustAlpha})`;
      bgCtx.fill();
    });

    // ===== SUBTLE VIGNETTE EFFECT =====
    const vignetteGradient = bgCtx.createRadialGradient(
      w * 0.5, h * 0.5, 0,
      w * 0.5, h * 0.5,
      Math.max(w, h) * 0.85
    );
    vignetteGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignetteGradient.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
    bgCtx.fillStyle = vignetteGradient;
    bgCtx.fillRect(0, 0, w, h);

    // ===== SUBTLE TOP VIGNETTE (DARKER SKY AT TOP) =====
    const topVignette = bgCtx.createLinearGradient(0, 0, 0, h * 0.3);
    topVignette.addColorStop(0, 'rgba(0, 0, 0, 0.08)');
    topVignette.addColorStop(1, 'rgba(0, 0, 0, 0)');
    bgCtx.fillStyle = topVignette;
    bgCtx.fillRect(0, 0, w, h * 0.3);

    t += 0.016;
    bgAnimId = requestAnimationFrame(draw);
  };

  draw();
}

// Helper function (if not already in your code)
function rnd(min, max) {
  return Math.random() * (max - min) + min;
}

function bgSceneNight() {
  const stars = Array.from({length:200}, () => ({
    x: rnd(0,1), y: rnd(0,1), r: rnd(0.4,2.2), ph: rnd(0,Math.PI*2), sp: rnd(1.2,4)
  }));
  let shooting = null, sTimer = 0, t = 0;
  const draw = () => {
    const w = bgCanvas.width, h = bgCanvas.height;
    const bg = bgCtx.createLinearGradient(0,0,0,h);
    bg.addColorStop(0,'#020810'); bg.addColorStop(1,'#06202B');
    bgCtx.fillStyle = bg; bgCtx.fillRect(0,0,w,h);
    const mx = w*0.78, my = h*0.14, mr = Math.min(w,h)*0.07;
    const mg = bgCtx.createRadialGradient(mx-mr*0.15,my-mr*0.15,0,mx,my,mr);
    mg.addColorStop(0,'rgba(235,245,255,0.96)'); mg.addColorStop(1,'rgba(140,170,220,0.4)');
    const gw = bgCtx.createRadialGradient(mx,my,mr*0.8,mx,my,mr*3.5);
    gw.addColorStop(0,'rgba(180,210,255,0.1)'); gw.addColorStop(1,'rgba(180,210,255,0)');
    bgCtx.fillStyle = gw; bgCtx.beginPath(); bgCtx.arc(mx,my,mr*3.5,0,Math.PI*2); bgCtx.fill();
    bgCtx.beginPath(); bgCtx.arc(mx,my,mr,0,Math.PI*2); bgCtx.fillStyle = mg; bgCtx.fill();
    stars.forEach(s => {
      const a = 0.28 + Math.sin(t*s.sp+s.ph)*0.5;
      bgCtx.beginPath(); bgCtx.arc(s.x*w,s.y*h,s.r,0,Math.PI*2);
      bgCtx.fillStyle = `rgba(215,230,255,${Math.max(0,a)})`; bgCtx.fill();
    });
    sTimer += 0.016; if (sTimer > rnd(3,8) && !shooting) { shooting = {x:rnd(0.1,0.9)*w,y:rnd(0.03,0.35)*h,vx:rnd(4,8),vy:rnd(1,3),life:1}; sTimer = 0; }
    if (shooting) {
      bgCtx.save(); bgCtx.globalAlpha = shooting.life; bgCtx.strokeStyle = 'rgba(200,225,255,0.9)'; bgCtx.lineWidth = 1.8;
      bgCtx.beginPath(); bgCtx.moveTo(shooting.x,shooting.y); bgCtx.lineTo(shooting.x-shooting.vx*22,shooting.y-shooting.vy*22); bgCtx.stroke(); bgCtx.restore();
      shooting.x += shooting.vx; shooting.y += shooting.vy; shooting.life -= 0.028; if (shooting.life <= 0) shooting = null;
    }
    t += 0.016; bgAnimId = requestAnimationFrame(draw);
  }; draw();
}

function bgSceneCloudy(isDay) {
  const clouds = Array.from({length:10}, (_,i) => ({
    x: rnd(-0.3,1.3), y: rnd(0.03,0.65), w: rnd(0.28,0.65), h: rnd(0.1,0.25),
    sp: rnd(0.00005,0.00015), op: rnd(0.1,0.24), layer: i%3
  }));
  let t = 0;
  const draw = () => {
    const w = bgCanvas.width, h = bgCanvas.height;
    const bg = bgCtx.createLinearGradient(0,0,0,h);
    isDay ? bg.addColorStop(0,'#0d2030') : bg.addColorStop(0,'#050c14');
    bg.addColorStop(1,'#06202B'); bgCtx.fillStyle = bg; bgCtx.fillRect(0,0,w,h);
    clouds.sort((a,b) => a.layer - b.layer).forEach(c => {
      c.x += c.sp; if (c.x > 1.5) c.x = -0.6;
      const px = c.x*w, py = c.y*h, pw = c.w*w, ph = c.h*h, col = isDay ? '180,210,225' : '70,95,120';
      [[0.5,0.55,0.5,0.45],[0.28,0.44,0.28,0.38],[0.72,0.48,0.26,0.35]].forEach(([ex,ey,ew,eh]) => {
        const gg = bgCtx.createRadialGradient(px+pw*ex,py+ph*ey,0,px+pw*ex,py+ph*ey,pw*ew*1.2);
        gg.addColorStop(0,`rgba(${col},${c.op})`); gg.addColorStop(1,`rgba(${col},0)`);
        bgCtx.fillStyle = gg; bgCtx.beginPath();
        bgCtx.ellipse(px+pw*ex,py+ph*ey,pw*ew,ph*eh,0,0,Math.PI*2); bgCtx.fill();
      });
    });
    t += 0.016; bgAnimId = requestAnimationFrame(draw);
  }; draw();
}

function bgSceneRain(isThunder) {
  const drops = Array.from({length: isThunder ? 150 : 110}, () => ({
    x: rnd(0,1), y: rnd(0,1), len: rnd(12,34),
    sp: rnd(isThunder ? 0.018 : 0.012, isThunder ? 0.032 : 0.024),
    op: rnd(0.2,0.55), w: rnd(0.8,1.8)
  }));
  const ripples = []; let flash = 0, flashTimer = isThunder ? rnd(2,5)*60 : 999999, bolt = null, rt = 0, t = 0;
  const mkBolt = (w,h) => {
    const pts = []; let x = rnd(0.2,0.8)*w, y = 0;
    while (y < h*0.72) { pts.push({x,y}); x += rnd(-28,28); y += rnd(14,30); }
    return pts;
  };
  const draw = () => {
    const w = bgCanvas.width, h = bgCanvas.height;
    const bg = bgCtx.createLinearGradient(0,0,0,h);
    isThunder ? (bg.addColorStop(0,'#040610'), bg.addColorStop(1,'#06202B'))
              : (bg.addColorStop(0,'#070e18'), bg.addColorStop(1,'#06202B'));
    bgCtx.fillStyle = bg; bgCtx.fillRect(0,0,w,h);
    if (flash > 0) { bgCtx.fillStyle = `rgba(190,205,255,${flash*0.13})`; bgCtx.fillRect(0,0,w,h); flash -= 0.055; }
    drops.forEach(d => {
      d.y += d.sp; if (d.y > 1.05) { d.y = -0.05; d.x = rnd(0,1); }
      bgCtx.save(); bgCtx.strokeStyle = `rgba(122,200,225,${d.op})`; bgCtx.lineWidth = d.w;
      bgCtx.beginPath(); bgCtx.moveTo(d.x*w,d.y*h); bgCtx.lineTo(d.x*w-5,d.y*h+d.len); bgCtx.stroke(); bgCtx.restore();
    });
    rt++; if (rt % 5 === 0) ripples.push({x:rnd(0.05,0.95)*w,y:h*rnd(0.8,0.97),r:2,maxR:rnd(20,42),life:1});
    ripples.forEach((r,i) => {
      r.r += 0.6; r.life -= 0.024;
      if (r.life <= 0 || r.r > r.maxR) { ripples.splice(i,1); return; }
      bgCtx.save(); bgCtx.strokeStyle = `rgba(122,200,225,${r.life*0.22})`; bgCtx.lineWidth = 1;
      bgCtx.beginPath(); bgCtx.ellipse(r.x,r.y,r.r,r.r*0.3,0,0,Math.PI*2); bgCtx.stroke(); bgCtx.restore();
    });
    if (isThunder) {
      flashTimer--; if (flashTimer <= 0) { flash = 1; bolt = mkBolt(w,h); flashTimer = rnd(2,7)*60; }
      if (bolt && flash > 0.2) {
        bgCtx.save(); bgCtx.strokeStyle = `rgba(215,230,255,${Math.min(flash*1.4,1)})`; bgCtx.lineWidth = 3;
        bgCtx.shadowColor = 'rgba(180,200,255,0.9)'; bgCtx.shadowBlur = 24;
        bgCtx.beginPath(); bolt.forEach((p,i) => i === 0 ? bgCtx.moveTo(p.x,p.y) : bgCtx.lineTo(p.x,p.y));
        bgCtx.stroke(); bgCtx.restore();
      }
    }
    t += 0.016; bgAnimId = requestAnimationFrame(draw);
  }; draw();
}

function bgSceneSnow() {
  const flakes = Array.from({length:130}, () => ({
    x: rnd(0,1), y: rnd(0,1), r: rnd(1.5,6.5), sp: rnd(0.002,0.007),
    drift: rnd(-0.0005,0.0005), rot: rnd(0,Math.PI*2), rotSp: rnd(-0.015,0.015), op: rnd(0.4,0.9)
  }));
  let t = 0;
  const draw = () => {
    const w = bgCanvas.width, h = bgCanvas.height;
    const bg = bgCtx.createLinearGradient(0,0,0,h);
    bg.addColorStop(0,'#0a1428'); bg.addColorStop(1,'#06202B');
    bgCtx.fillStyle = bg; bgCtx.fillRect(0,0,w,h);
    flakes.forEach(f => {
      f.y += f.sp; f.x += f.drift + Math.sin(f.y*6+f.rot)*0.0003; f.rot += f.rotSp;
      if (f.y > 1.05) { f.y = -0.05; f.x = rnd(0,1); }
      if (f.x > 1.05) f.x = -0.05; if (f.x < -0.05) f.x = 1.05;
      bgCtx.save(); bgCtx.translate(f.x*w,f.y*h); bgCtx.rotate(f.rot);
      bgCtx.strokeStyle = `rgba(215,235,255,${f.op})`; bgCtx.lineWidth = f.r*0.24;
      for (let a = 0; a < 6; a++) {
        bgCtx.save(); bgCtx.rotate(a*Math.PI/3); bgCtx.beginPath();
        bgCtx.moveTo(0,0); bgCtx.lineTo(0,-f.r);
        bgCtx.moveTo(0,-f.r*0.55); bgCtx.lineTo(f.r*0.32,-f.r*0.78);
        bgCtx.moveTo(0,-f.r*0.55); bgCtx.lineTo(-f.r*0.32,-f.r*0.78);
        bgCtx.stroke(); bgCtx.restore();
      }
      bgCtx.restore();
    });
    t += 0.016; bgAnimId = requestAnimationFrame(draw);
  }; draw();
}

function bgSceneFog() {
  const wisps = Array.from({length:14}, (_,i) => ({
    y: 0.01 + i*0.08, off: rnd(0,Math.PI*2), sp: rnd(0.0001,0.0004), op: rnd(0.06,0.15), h: rnd(0.06,0.14)
  }));
  let t = 0;
  const draw = () => {
    const w = bgCanvas.width, h = bgCanvas.height;
    const bg = bgCtx.createLinearGradient(0,0,0,h);
    bg.addColorStop(0,'#091820'); bg.addColorStop(1,'#06202B');
    bgCtx.fillStyle = bg; bgCtx.fillRect(0,0,w,h);
    wisps.forEach(wsp => {
      const py = wsp.y*h + Math.sin(t*0.25+wsp.off)*h*0.022;
      const fg = bgCtx.createLinearGradient(0,py,0,py+wsp.h*h);
      fg.addColorStop(0,`rgba(130,185,200,0)`);
      fg.addColorStop(0.4,`rgba(130,185,200,${wsp.op+Math.sin(t*0.4+wsp.off)*0.03})`);
      fg.addColorStop(0.6,`rgba(130,185,200,${wsp.op})`);
      fg.addColorStop(1,`rgba(130,185,200,0)`);
      bgCtx.fillStyle = fg; bgCtx.fillRect(0,py,w,wsp.h*h);
      wsp.y += wsp.sp; if (wsp.y > 1.05) wsp.y = -wsp.h;
    });
    t += 0.016; bgAnimId = requestAnimationFrame(draw);
  }; draw();
}

// ================================================================
//  SECTION 3 — FETCH GEOCODING & WEATHER
// ================================================================
async function fetchGeo(query) {
  const url = `${GEO_API}?name=${encodeURIComponent(query)}&count=6&language=en&format=json&_=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  return data.results || [];
}

async function fetchWeather(lat, lon) {
  // Use enhanced weather API with fallback support if available
  if (typeof fetchWeatherWithFallback !== 'undefined') {
    try {
      const data = await fetchWeatherWithFallback(lat, lon);
      // Transform data to match expected format if using OpenWeatherMap
      if (data.provider === 'openweathermap') {
        return data;
      }
      return data;
    } catch (error) {
      console.warn('Enhanced weather API failed, falling back to Open-Meteo:', error);
    }
  }
  
  // Fallback to original Open-Meteo implementation
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
  const res = await fetch(`${WEATHER_API}?${params}`);
  if (!res.ok) throw new Error('Weather fetch failed');
  return res.json();
}

// ================================================================
//  SECTION 4 — RENDER WEATHER
// ================================================================
function renderWeather(data, locationName, countryName) {
  currentWeatherData = data;

  const c = data.current;
  const info = getWeatherInfo(c.weather_code);

  // Determine day/night from sunrise/sunset
  const now = new Date();
  const sunrise = data.daily && data.daily.sunrise ? new Date(data.daily.sunrise[0]) : null;
  const sunset  = data.daily && data.daily.sunset  ? new Date(data.daily.sunset[0])  : null;
  const isDay   = sunrise && sunset ? (now >= sunrise && now <= sunset) : (now.getHours() >= 6 && now.getHours() < 20);

  // Apply background theme
  applyWeatherTheme(c.weather_code, isDay);

  // Location & date
  document.getElementById('cityName').textContent    = locationName;
  document.getElementById('countryName').textContent = countryName || '';
  document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  document.getElementById('currentUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});

  // Main weather
  document.getElementById('currentIcon').textContent = info.icon;
  document.getElementById('currentTemp').textContent = toDisplay(c.temperature_2m);
  document.getElementById('currentDesc').textContent = info.label;

  // Stats
  document.getElementById('feelsLike').textContent  = toDisplay(c.apparent_temperature);
  document.getElementById('humidity').textContent   = `${c.relative_humidity_2m}%`;
  document.getElementById('windSpeed').textContent  = `${Math.round(c.wind_speed_10m)} km/h`;
  document.getElementById('windGusts').textContent  = `${Math.round(c.wind_gusts_10m)} km/h`;
  document.getElementById('uvIndex').textContent    = uvLabel(data.daily?.uv_index_max?.[0] ?? c.uv_index ?? 0);
  document.getElementById('visibility').textContent = c.visibility != null ? `${(c.visibility/1000).toFixed(1)} km` : '—';

  // Sunrise/Sunset
  if (sunrise) document.getElementById('sunrise').textContent = sunrise.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});
  if (sunset)  document.getElementById('sunset').textContent  = sunset.toLocaleTimeString('en-US',  {hour:'2-digit', minute:'2-digit'});

  // Extra details
  document.getElementById('windDir').textContent     = degToCompass(c.wind_direction_10m ?? 0);
  document.getElementById('pressure').textContent    = `${Math.round(c.surface_pressure ?? 0)} hPa`;
  document.getElementById('precipitation').textContent = `${c.precipitation ?? 0} mm`;
  document.getElementById('cloudCover').textContent  = `${c.cloud_cover ?? 0}%`;

  // Card location tags
  ['hourly','daily','details'].forEach(id => {
    const el = document.getElementById(id + 'LocationTag');
    if (el) el.textContent = locationName;
  });

  renderHourly(data, isDay);
  renderDaily(data);

  hideWelcome();
  clearStatus();
  content.style.display = 'block';
}

// ================================================================
//  SECTION 5 — RENDER HOURLY & DAILY
// ================================================================
function renderHourly(data, isDay) {
  const list = document.getElementById('hourlyList');
  list.innerHTML = '';
  const now = new Date();
  const times = data.hourly.time;
  const temps = data.hourly.temperature_2m;
  const codes = data.hourly.weather_code;
  const rain  = data.hourly.precipitation_probability;

  let count = 0;
  for (let i = 0; i < times.length && count < 24; i++) {
    const t = new Date(times[i]);
    if (t < now - 30*60*1000) continue;
    const info = getWeatherInfo(codes[i]);
    const isNow = count === 0;
    const item = document.createElement('div');
    item.className = 'hourly-item' + (isNow ? ' now' : '');
    item.innerHTML = `
      <span class="h-time">${isNow ? 'Now' : t.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span>
      <span class="h-icon">${info.icon}</span>
      <span class="h-temp">${toDisplay(temps[i])}</span>
      <span class="h-rain">💧${rain[i] ?? 0}%</span>
    `;
    list.appendChild(item);
    count++;
  }
}

function renderDaily(data) {
  const list = document.getElementById('dailyList');
  list.innerHTML = '';
  const days  = data.daily.time;
  const codes = data.daily.weather_code;
  const maxT  = data.daily.temperature_2m_max;
  const minT  = data.daily.temperature_2m_min;
  const rain  = data.daily.precipitation_probability_max;
  const today = new Date().toISOString().slice(0,10);

  const allMax = maxT.filter(v => v != null);
  const globalMax = allMax.length ? Math.max(...allMax) : 40;
  const globalMin = allMax.length ? Math.min(...allMax) : 0;

  days.forEach((day, i) => {
    const info    = getWeatherInfo(codes[i]);
    const isToday = day === today;
    const d       = new Date(day + 'T12:00:00');
    const dayName = isToday ? 'Today' : d.toLocaleDateString('en-US', {weekday:'long'});
    const dateStr = d.toLocaleDateString('en-US', {month:'short', day:'numeric'});
    const rainPct = rain[i] ?? 0;
    const pct     = globalMax > globalMin ? ((maxT[i] - globalMin) / (globalMax - globalMin) * 100) : 50;

    const item = document.createElement('div');
    item.className = 'daily-item' + (isToday ? ' today-item' : '');
    item.innerHTML = `
      <div class="d-day-wrap">
        <span class="d-day">${dayName}</span>
        <span class="d-date">${dateStr}</span>
        ${isToday ? '<span class="today-badge">TODAY</span>' : ''}
      </div>
      <div class="d-icon">${info.icon}</div>
      <div class="d-middle">
        <span class="d-desc">${info.label}</span>
        <span class="d-rain">💧 ${rainPct}% chance of rain</span>
        <div class="d-bar-wrap"><div class="d-bar-fill" style="width:${Math.round(pct)}%"></div></div>
      </div>
      <div class="d-temps">
        <span class="d-max">${toDisplay(maxT[i])}</span>
        <span class="d-min">${toDisplay(minT[i])}</span>
      </div>
    `;
    list.appendChild(item);
  });
}

// ================================================================
//  SECTION 6 — LOADING OVERLAY
// ================================================================
const LO_SCENES = [
  { bg: 'linear-gradient(135deg,#071422 0%,#0a2235 100%)',   icon: '☀️', label: 'Checking sunshine...' },
  { bg: 'linear-gradient(135deg,#040610 0%,#06202B 100%)',   icon: '⛈️',  label: 'Measuring storm cells...' },
  { bg: 'linear-gradient(135deg,#0a1428 0%,#06202B 100%)',   icon: '❄️',  label: 'Counting snowflakes...' },
  { bg: 'linear-gradient(135deg,#070e18 0%,#06202B 100%)',   icon: '🌧️', label: 'Tracking rainfall...' },
  { bg: 'linear-gradient(135deg,#091820 0%,#06202B 100%)',   icon: '🌫️', label: 'Measuring fog density...' },
  { bg: 'linear-gradient(135deg,#0d2030 0%,#06202B 100%)',   icon: '⛅',  label: 'Reading cloud patterns...' },
];
let loAnimId = null;

function startLoadingAnimation(cityName) {
  const overlay = document.getElementById('loadingOverlay');
  const loBg    = document.getElementById('loBg');
  const loScene = document.getElementById('loScene');
  const loCity  = document.getElementById('loCity');
  if (!overlay) return;
  const sc = LO_SCENES[Math.floor(Math.random() * LO_SCENES.length)];
  loBg.style.background   = sc.bg;
  loScene.textContent      = sc.icon;
  loCity.textContent       = cityName || '';
  overlay.style.display    = 'flex';
  overlay.style.opacity    = '0';
  overlay.style.transition = 'opacity 0.3s ease';
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });
}

function stopLoadingAnimation() {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  overlay.style.opacity    = '0';
  overlay.style.transition = 'opacity 0.3s ease';
  setTimeout(() => { overlay.style.display = 'none'; }, 320);
}

// ================================================================
//  SECTION 7 — LOAD WEATHER
// ================================================================
async function loadWeather(lat, lon, name, country) {
  let resolvedName = name;
  let resolvedCountry = country;
  
  startLoadingAnimation(name || 'Location');
  
  try {
    // Fetch weather and reverse geocode AT THE SAME TIME (faster)
    const [data, geo] = await Promise.all([
      fetchWeather(lat, lon),
      reverseGeocode(lat, lon).catch(() => ({ name, country }))
    ]);
    
    resolvedName = geo.name || name;
    resolvedCountry = geo.country || country;

    currentLocation = { lat, lon, name: resolvedName, country: resolvedCountry };
    renderWeather(data, resolvedName, resolvedCountry);
  } catch (e) {
    console.error('Weather fetch error:', e);
    showStatus('Failed to load weather.', true);
  } finally {
    stopLoadingAnimation();
  }
}


// ================================================================
//  SECTION 8 — SEARCH & AUTOCOMPLETE
// ================================================================
function handleSearch() {
  const q = searchInput.value.trim();
  if (!q) return;
  hideSuggestions();
  fetchGeo(q).then(results => {
    if (!results.length) { showStatus('City not found. Try a different name.', true); return; }
    const r = results[0];
    loadWeather(r.latitude, r.longitude, r.name, [r.admin1, r.country].filter(Boolean).join(', '));
  }).catch(() => showStatus('Search failed. Check your connection.', true));
}

function handleAutocomplete(query) {
  if (!query || query.length < 2) { hideSuggestions(); return; }
  clearTimeout(suggestionTimeout);
  suggestionTimeout = setTimeout(async () => {
    try {
      const results = await fetchGeo(query);
      if (!results.length) { hideSuggestions(); return; }
      suggestions.innerHTML = '';
      suggestions.classList.remove('hidden');
      results.slice(0, 6).forEach(r => {
        const li = document.createElement('li');
        const parts = [r.name, r.admin1, r.country].filter(Boolean);
        li.textContent = parts.join(', ');
        li.addEventListener('click', () => {
          searchInput.value = r.name;
          hideSuggestions();
          loadWeather(r.latitude, r.longitude, r.name, [r.admin1, r.country].filter(Boolean).join(', '));
        });
        suggestions.appendChild(li);
      });
    } catch { hideSuggestions(); }
  }, 300);
}

function hideSuggestions() {
  suggestions.innerHTML = '';
  suggestions.classList.add('hidden');
}

// ================================================================
//  SECTION 9 — REVERSE GEOCODE
// ================================================================
async function reverseGeocode(lat, lon) {
  try { return await nominatimReverse(lat, lon); } catch { /* fall through */ }
  return { name: `${lat.toFixed(3)}, ${lon.toFixed(3)}`, country: '' };
}

async function nominatimReverse(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error('Nominatim failed');
  const data = await res.json();
  const addr = data.address || {};
  const name = addr.city || addr.town || addr.village || addr.county || data.display_name?.split(',')[0] || 'Unknown';
  const country = addr.country || '';
  return { name, country };
}

// ================================================================
//  SECTION 10 — GEOLOCATION
// ================================================================
function handleGeoLocation() {
  if (!navigator.geolocation) { showStatus('Geolocation not supported.', true); return; }
  geoBtn.disabled = true;
  showStatus('Detecting your location…');
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      try {
        const geo = await reverseGeocode(lat, lon);
        await loadWeather(lat, lon, geo.name, geo.country);
      } catch {
        showStatus('Could not load weather for your location.', true);
      } finally {
        geoBtn.disabled = false;
      }
    },
    err => {
      geoBtn.disabled = false;
      showStatus('Location access denied. Please search manually.', true);
    },
    { timeout: 10000 }
  );
}

// ================================================================
//  SECTION 11 — MAP PICKER
// ================================================================
let leafletMap = null, leafletMarker = null, mapSelectedCoords = null;

function openMapPicker() {
  mapModal.classList.add('open');
  mapConfirmBtn.disabled = true;
  mapSelectedInfo.textContent = 'No location selected yet';
  mapSelectedCoords = null;

  requestAnimationFrame(() => {
    if (!leafletMap) {
      leafletMap = L.map('mapContainer').setView([20, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 18
      }).addTo(leafletMap);
      leafletMap.on('click', onMapClick);
    } else {
      leafletMap.invalidateSize();
    }
  });
}

function onMapClick(e) {
  const { lat, lng } = e.latlng;
  mapSelectedCoords = { lat, lon: lng };
  if (leafletMarker) leafletMarker.setLatLng(e.latlng);
  else leafletMarker = L.marker(e.latlng).addTo(leafletMap);
  mapSelectedInfo.innerHTML = `<strong>📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}</strong>`;
  mapConfirmBtn.disabled = false;
}

function closeMapPicker() {
  mapModal.classList.remove('open');
}

function confirmMapLocation() {
  if (!mapSelectedCoords) return;
  closeMapPicker();
  const { lat, lon } = mapSelectedCoords;
  reverseGeocode(lat, lon).then(geo => loadWeather(lat, lon, geo.name, geo.country));
}

// ================================================================
//  SECTION 12 — UNIT TOGGLE
// ================================================================
function toggleUnits() {
  isCelsius = !isCelsius;
  unitToggle.textContent = isCelsius ? '°F' : '°C';
  if (currentWeatherData && currentLocation) {
    renderWeather(currentWeatherData, currentLocation.name, currentLocation.country);
  }
}

// ================================================================
//  SECTION 13 — COMPARE CITIES
// ================================================================
let cmpCityA = null, cmpCityB = null;

function wireCmpSearch(inputId, searchBtnId, suggId, selectedId, slot) {
  const input   = document.getElementById(inputId);
  const btn     = document.getElementById(searchBtnId);
  const sugg    = document.getElementById(suggId);
  const selDiv  = document.getElementById(selectedId);
  if (!input || !btn || !sugg || !selDiv) return;

  const doSearch = async () => {
    const q = input.value.trim();
    if (!q) return;
    sugg.innerHTML = ''; sugg.classList.add('hidden');
    try {
      const results = await fetchGeo(q);
      if (!results.length) return;
      sugg.classList.remove('hidden');
      results.slice(0, 5).forEach(r => {
        const li = document.createElement('li');
        const label = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
        li.textContent = label;
        li.addEventListener('click', () => {
          input.value = r.name;
          sugg.innerHTML = ''; sugg.classList.add('hidden');
          selectCmpCity({ lat: r.latitude, lon: r.longitude, name: r.name, label }, slot, selDiv);
        });
        sugg.appendChild(li);
      });
    } catch { /* ignore */ }
  };

  btn.addEventListener('click', doSearch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  let t;
  input.addEventListener('input', () => {
    clearTimeout(t); t = setTimeout(doSearch, 320);
  });
}

function selectCmpCity(city, slot, selDiv) {
  if (slot === 'A') cmpCityA = city;
  else              cmpCityB = city;
  selDiv.innerHTML = `<span style="color:var(--accent2);font-weight:700;">📍 ${city.label || city.name}</span>`;
  const goBtn = document.getElementById('cmpGoBtn');
  if (goBtn) goBtn.disabled = !(cmpCityA && cmpCityB);
}

async function runComparison() {
  if (!cmpCityA || !cmpCityB) return;
  const results = document.getElementById('cmpResults');
  const recoBody = document.getElementById('cmpRecoBody');
  const recoLoading = document.getElementById('cmpRecoLoading');
  results.classList.remove('hidden');
  document.getElementById('cmpCards').innerHTML = '<div style="color:var(--text-muted);padding:12px;">Loading…</div>';
  document.getElementById('cmpBars').innerHTML  = '';
  recoBody.textContent = 'Loading AI recommendations…';
  if (recoLoading) recoLoading.classList.remove('hidden');

  try {
    const [wA, wB] = await Promise.all([
      fetchWeather(cmpCityA.lat, cmpCityA.lon),
      fetchWeather(cmpCityB.lat, cmpCityB.lon)
    ]);
    renderCmpCards(wA, wB);
    renderCmpBars(wA, wB);
    fetchCmpRecommendations(wA, wB);
  } catch {
    document.getElementById('cmpCards').innerHTML = '<div style="color:#f87171;padding:12px;">Failed to load comparison data.</div>';
    if (recoLoading) recoLoading.classList.add('hidden');
  }
}

function renderCmpCards(wA, wB) {
  const container = document.getElementById('cmpCards');
  container.innerHTML = '';
  container.appendChild(buildCmpCard(cmpCityA.name, wA));
  const vs = document.createElement('div');
  vs.className = 'cmp-vs-divider'; vs.textContent = 'VS';
  container.appendChild(vs);
  container.appendChild(buildCmpCard(cmpCityB.name, wB));
}

function buildCmpCard(name, data) {
  const c    = data.current;
  const info = getWeatherInfo(c.weather_code);
  const uvVal = data.daily?.uv_index_max?.[0] ?? c.uv_index;
  const uvDisplay = uvVal != null ? `UV ${uvVal}` : 'UV N/A';
  
  const card = document.createElement('div');
  card.className = 'cmp-city-card';
  card.innerHTML = `
    <div class="cmp-card-city">${name}</div>
    <div class="cmp-card-main">
      <div class="cmp-card-icon">${info.icon}</div>
      <div class="cmp-card-temp">${toDisplay(c.temperature_2m)}</div>
    </div>
    <div class="cmp-card-desc">${info.label}</div>
    <div class="cmp-card-stats" style="margin-top:12px; font-size: 0.8rem; display: flex; flex-direction: column; gap: 4px; align-items: center;">
      <div>💧 Humidity: ${c.relative_humidity_2m}%</div>
      <div>💨 Wind: ${Math.round(c.wind_speed_10m)} km/h</div>
      <div>☀️ ${uvDisplay}</div>
    </div>
  `;
  return card;
}

function renderCmpBars(wA, wB) {
  const container = document.getElementById('cmpBars');
  container.innerHTML = '';
  const metrics = [
    { label: 'Temperature', a: wA.current.temperature_2m, b: wB.current.temperature_2m, unit: '°C', max: 50, min: -30 },
    { label: 'Humidity',    a: wA.current.relative_humidity_2m, b: wB.current.relative_humidity_2m, unit: '%', max: 100, min: 0 },
    { label: 'Wind Speed',  a: wA.current.wind_speed_10m, b: wB.current.wind_speed_10m, unit: ' km/h', max: 120, min: 0 },
    { label: 'UV Index',    a: wA.daily?.uv_index_max?.[0] ?? wA.current.uv_index ?? 0, b: wB.daily?.uv_index_max?.[0] ?? wB.current.uv_index ?? 0, unit: '', max: 12, min: 0 },
  ];
  metrics.forEach(m => {
    const range = m.max - m.min;
    const pA = Math.round(Math.max(0, Math.min(100, (m.a - m.min) / range * 100)));
    const pB = Math.round(Math.max(0, Math.min(100, (m.b - m.min) / range * 100)));
    const row = document.createElement('div');
    row.className = 'cmp-bar-row';
    row.innerHTML = `
      <div class="cmp-bar-label">${m.label}</div>
      <div class="cmp-bar-group">
        <div class="cmp-bar-name">${cmpCityA.name}</div>
        <div class="cmp-bar-track"><div class="cmp-bar-fill cmp-bar-a" style="width:${pA}%"></div></div>
        <div class="cmp-bar-val">${Math.round(m.a)}${m.unit}</div>
      </div>
      <div class="cmp-bar-group">
        <div class="cmp-bar-name">${cmpCityB.name}</div>
        <div class="cmp-bar-track"><div class="cmp-bar-fill cmp-bar-b" style="width:${pB}%"></div></div>
        <div class="cmp-bar-val">${Math.round(m.b)}${m.unit}</div>
      </div>
    `;
    container.appendChild(row);
  });
}

async function fetchCmpRecommendations(wA, wB) {
  const recoBody    = document.getElementById('cmpRecoBody');
  const recoLoading = document.getElementById('cmpRecoLoading');
  if (!groqApiKey || groqApiKey.includes('YOUR_GROQ_API_KEY') || groqApiKey === '') {
    recoBody.textContent = 'AI recommendations are currently unavailable.';
    if (recoLoading) recoLoading.classList.add('hidden');
    return;
  }
  const cA = wA.current, cB = wB.current;
  const infoA = getWeatherInfo(cA.weather_code), infoB = getWeatherInfo(cB.weather_code);
  const prompt = `Compare these two cities' weather and give brief, practical recommendations (3-4 bullet points, max 120 words):
${cmpCityA.name}: ${infoA.label}, ${toDisplay(cA.temperature_2m)}, humidity ${cA.relative_humidity_2m}%, wind ${Math.round(cA.wind_speed_10m)} km/h, UV ${cA.uv_index ?? 0}
${cmpCityB.name}: ${infoB.label}, ${toDisplay(cB.temperature_2m)}, humidity ${cB.relative_humidity_2m}%, wind ${Math.round(cB.wind_speed_10m)} km/h, UV ${cB.uv_index ?? 0}
Which city is better for outdoor activities today? Keep it concise.`;
  try {
    const res = await fetch(GROQ_API, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: 200 })
    });
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content || 'No recommendation available.';
    recoBody.innerHTML = formatChatText(text);
  } catch {
    recoBody.textContent = 'Could not fetch AI recommendations.';
  } finally {
    if (recoLoading) recoLoading.classList.add('hidden');
  }
}

// ================================================================
//  SECTION 14 — CHATBOT
// ================================================================
const chatFab     = document.getElementById('chatFab');
const chatPanel   = document.getElementById('chatPanel');

function toggleChat() {
  chatPanel.classList.toggle('open');
  if (chatPanel.classList.contains('open')) {
    if (chatHistory.length === 0) {
      appendMsg('bot', '👋 Hi! I\'m your Weather AI assistant. Ask me about current conditions, compare cities, or get activity recommendations!');
    }
  }
}

function groqKeySave() {
  const input = document.getElementById('groqKeyInput');
  const val   = input ? input.value.trim() : '';
  if (!val) return;
  groqApiKey = val;
  localStorage.setItem('groq_api_key', val);
  const keyBar = document.getElementById('chatKeyBar');
  if (keyBar) keyBar.classList.add('hidden');
  appendMsg('bot', '✅ API key saved! You can now ask me anything about the weather.');
}

async function sendChatMessage(text) {
  text = text.trim();
  if (!text) return;

  const input   = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');
  const suggs   = document.getElementById('chatSuggestions');
  if (input)   input.value   = '';
  if (sendBtn) sendBtn.disabled = true;
  if (suggs)   suggs.classList.add('hidden');

  appendMsg('user', text);
  const typingEl = appendTyping();

  if (!groqApiKey || groqApiKey.includes('YOUR_GROQ_API_KEY') || groqApiKey === '') {
    typingEl.remove();
    appendMsg('bot', 'I\'m sorry, the AI assistant is currently unavailable.');
    if (sendBtn) sendBtn.disabled = false;
    return;
  }

  chatHistory.push({ role: 'user', content: text });

  const isCityCompare = detectCityComparison(text);
  let weatherContext  = '';

  try {
    if (isCityCompare) {
      const cities = await resolveCitiesFromQuery(text);
      if (cities.length >= 2) {
        const [wA, wB] = await Promise.all([fetchWeather(cities[0].lat, cities[0].lon), fetchWeather(cities[1].lat, cities[1].lon)]);
        weatherContext = buildWeatherContext(wA, cities[0].name) + '\n' + buildWeatherContext(wB, cities[1].name);
      }
    } else {
      const cities = await resolveCitiesFromQuery(text);
      if (cities.length > 0) {
        const w = await fetchWeather(cities[0].lat, cities[0].lon);
        weatherContext = buildWeatherContext(w, cities[0].name);
      } else if (currentWeatherData && currentLocation) {
        weatherContext = buildWeatherContext(currentWeatherData, currentLocation.name);
      }
    }
  } catch (e) {
    console.warn('Failed to fetch weather context:', e);
    if (currentWeatherData && currentLocation) {
      weatherContext = buildWeatherContext(currentWeatherData, currentLocation.name);
    }
  }

  const systemMsg = `You are a helpful weather assistant. Answer questions clearly and concisely. Always provide specific weather data when available.${weatherContext ? '\n\nCurrent weather data:\n' + weatherContext : '\n\nNote: If the user asks about a specific city, try to fetch real-time weather for that location.'} Keep responses under 180 words.`;

  try {
    const messages = [{ role: 'system', content: systemMsg }, ...chatHistory.slice(-8)];
    const res = await fetch(GROQ_API, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: 280 })
    });
    const json = await res.json();
    if (json.error) {
      typingEl.remove();
      appendMsg('bot', '⚠️ AI assistant is temporarily unavailable.');
      if (sendBtn) sendBtn.disabled = false;
      return;
    }
    const reply = json.choices?.[0]?.message?.content || 'Sorry, I couldn\'t get a response.';
    typingEl.remove();
    appendMsg('bot', formatChatText(reply));
    chatHistory.push({ role: 'assistant', content: reply });
  } catch {
    typingEl.remove();
    appendMsg('bot', '⚠️ Request failed. Check your API key and connection.');
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

function appendMsg(role, html) {
  const messages = document.getElementById('chatMessages');
  if (!messages) return null;
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = `
    <div class="chat-avatar">${role === 'bot' ? '🤖' : '👤'}</div>
    <div class="chat-bubble">${html}</div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function appendTyping() {
  const messages = document.getElementById('chatMessages');
  if (!messages) return document.createElement('div');
  const div = document.createElement('div');
  div.className = 'chat-msg bot chat-typing';
  div.innerHTML = `
    <div class="chat-avatar">🤖</div>
    <div class="chat-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function formatChatText(text) {
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/^[-•]\s(.+)/gm,'<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s,'<ul>$1</ul>')
    .replace(/\n/g,'<br>');
}

function buildWeatherContext(data, locationName) {
  const c    = data.current;
  const info = getWeatherInfo(c.weather_code);
  return `${locationName}: ${info.label}, ${Math.round(c.temperature_2m)}°C (feels ${Math.round(c.apparent_temperature)}°C), humidity ${c.relative_humidity_2m}%, wind ${Math.round(c.wind_speed_10m)} km/h, UV ${c.uv_index ?? 0}, visibility ${c.visibility != null ? (c.visibility/1000).toFixed(1) : '?'} km`;
}

async function fetchCityWeatherForChat(cityName) {
  const results = await fetchGeo(cityName);
  if (!results.length) throw new Error('City not found');
  const r = results[0];
  const data = await fetchWeather(r.latitude, r.longitude);
  return { name: r.name, data };
}

function detectCityComparison(text) {
  const lower = text.toLowerCase();
  return /\bvs\b|compare|versus|between|difference between/.test(lower) ||
    (lower.includes(' and ') && (lower.includes('weather') || lower.includes('compare')));
}

async function extractCityFromQuery(text) {
  const lower = text.toLowerCase();
  try {
    const results = await fetchGeo(text);
    if (results.length > 0) {
      return results[0];
    }
  } catch { /* ignore */ }
  return null;
}

async function resolveCitiesFromQuery(text) {
  const words    = text.replace(/[,]/g,' ').split(/\s+/);
  const stopWords = new Set(['vs','versus','compare','between','weather','and','the','in','of','or','today','now','is','difference']);
  const tokens   = [];
  let   buf      = [];
  words.forEach(w => {
    if (stopWords.has(w.toLowerCase())) {
      if (buf.length) { tokens.push(buf.join(' ')); buf = []; }
    } else { buf.push(w); }
  });
  if (buf.length) tokens.push(buf.join(' '));

  const cities = [];
  for (const token of tokens.slice(0, 4)) {
    if (token.length < 2) continue;
    try {
      const results = await fetchGeo(token);
      if (results.length) cities.push({ name: results[0].name, lat: results[0].latitude, lon: results[0].longitude });
    } catch { /* ignore */ }
    if (cities.length >= 2) break;
  }
  return cities;
}

// ================================================================
//  SECTION 15 — LOCATION PICKER POPUP
// ================================================================
let locPopupCallback = null;

function openLocPopup(opts) {
  const overlay = document.getElementById('locPopupOverlay');
  if (!overlay) return;
  locPopupCallback = opts.callback || null;
  document.getElementById('locPopupTitle').textContent = opts.title || 'Choose a location';
  document.getElementById('locPopupSub').textContent   = opts.sub   || 'Select a city to view forecast';
  document.getElementById('locPopupIcon').textContent  = opts.icon  || '📍';
  document.getElementById('locPopupInput').value = '';
  document.getElementById('locPopupSuggestions').innerHTML = '';
  overlay.classList.add('open');
}

function closeLocPopup() {
  const overlay = document.getElementById('locPopupOverlay');
  if (overlay) overlay.classList.remove('open');
  locPopupCallback = null;
}

function applyLocPopupResult(lat, lon, name, country) {
  closeLocPopup();
  loadWeather(lat, lon, name, country);
}

function wireLocPopupSearch() {
  const input   = document.getElementById('locPopupInput');
  const btn     = document.getElementById('locPopupSearchBtn');
  const suggEl  = document.getElementById('locPopupSuggestions');
  if (!input || !btn || !suggEl) return;

  const doSearch = async () => {
    const q = input.value.trim();
    if (!q) return;
    suggEl.innerHTML = ''; suggEl.classList.remove('hidden');
    try {
      const results = await fetchGeo(q);
      if (!results.length) { suggEl.innerHTML = '<li style="color:var(--text-muted)">No results found</li>'; return; }
      results.slice(0, 6).forEach(r => {
        const li = document.createElement('li');
        const label = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
        li.textContent = label;
        li.addEventListener('click', () => applyLocPopupResult(r.latitude, r.longitude, r.name, [r.admin1, r.country].filter(Boolean).join(', ')));
        suggEl.appendChild(li);
      });
    } catch { suggEl.innerHTML = '<li style="color:#f87171">Search failed</li>'; }
  };

  btn.addEventListener('click', doSearch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
}

// ================================================================
//  SECTION 16 — EVENT LISTENERS
// ================================================================
// Search
searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });
searchInput.addEventListener('input',   e => handleAutocomplete(e.target.value));

// Hide suggestions on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.search-section')) hideSuggestions();
  if (!e.target.closest('#cmpPickerA')) { const s = document.getElementById('cmpSuggA'); if (s) { s.innerHTML=''; s.classList.add('hidden'); } }
  if (!e.target.closest('#cmpPickerB')) { const s = document.getElementById('cmpSuggB'); if (s) { s.innerHTML=''; s.classList.add('hidden'); } }
  if (!e.target.closest('.loc-popup')) { /* don't close popup on inner click */ }
});

// Unit toggle
unitToggle.addEventListener('click', toggleUnits);

// Geo & map buttons
geoBtn.addEventListener('click', handleGeoLocation);
mapBtn.addEventListener('click', openMapPicker);
mapModalClose.addEventListener('click', closeMapPicker);
mapConfirmBtn.addEventListener('click', confirmMapLocation);
mapModal.addEventListener('click', e => { if (e.target === mapModal) closeMapPicker(); });

// Settings button
const settingsBtn = document.getElementById('settingsBtn');
if (settingsBtn) {
  settingsBtn.addEventListener('click', () => {
    if (typeof apiKeyManager !== 'undefined' && apiKeyManager) {
      apiKeyManager.openModal();
    }
  });
}

// Quick city buttons (welcome screen)
document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const name = btn.dataset.name, lat = parseFloat(btn.dataset.lat), lon = parseFloat(btn.dataset.lon);
    loadWeather(lat, lon, name, '');
  });
});

// Chat FAB & controls
chatFab.addEventListener('click', toggleChat);
document.getElementById('chatCloseBtn').addEventListener('click', () => chatPanel.classList.remove('open'));
document.getElementById('chatClearBtn').addEventListener('click', () => {
  chatHistory = [];
  const msgs = document.getElementById('chatMessages');
  if (msgs) msgs.innerHTML = '';
  appendMsg('bot', '🗑️ Chat cleared. Ask me anything about the weather!');
});
// API Key saving removed as per requirements

document.querySelectorAll('.chat-sugg').forEach(btn => {
  btn.addEventListener('click', () => sendChatMessage(btn.dataset.q));
});

document.getElementById('chatSendBtn').addEventListener('click', () => {
  const input = document.getElementById('chatInput');
  if (input) sendChatMessage(input.value);
});
document.getElementById('chatInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    if (input) sendChatMessage(input.value);
  }
});

// Compare overlay
const compareBtn = document.getElementById('compareBtn');
const cmpOverlay = document.getElementById('cmpOverlay');
const cmpClose   = document.getElementById('cmpClose');
if (compareBtn) compareBtn.addEventListener('click', () => cmpOverlay.classList.add('open'));
if (cmpClose)   cmpClose.addEventListener('click',   () => cmpOverlay.classList.remove('open'));
if (cmpOverlay) cmpOverlay.addEventListener('click', e => { if (e.target === cmpOverlay) cmpOverlay.classList.remove('open'); });

const cmpGoBtn = document.getElementById('cmpGoBtn');
if (cmpGoBtn) cmpGoBtn.addEventListener('click', runComparison);

wireCmpSearch('cmpInputA','cmpSearchA','cmpSuggA','cmpSelectedA','A');
wireCmpSearch('cmpInputB','cmpSearchB','cmpSuggB','cmpSelectedB','B');

// Location popup close
document.getElementById('locPopupClose').addEventListener('click', closeLocPopup);
document.getElementById('locPopupOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('locPopupOverlay')) closeLocPopup();
});

// Location popup search
wireLocPopupSearch();

// Location popup map button
const locPopupMapBtn = document.getElementById('locPopupMapBtn');
if (locPopupMapBtn) locPopupMapBtn.addEventListener('click', () => { closeLocPopup(); openMapPicker(); });

// Location popup quick buttons
document.querySelectorAll('.loc-popup-quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const name = btn.dataset.name, lat = parseFloat(btn.dataset.lat), lon = parseFloat(btn.dataset.lon);
    applyLocPopupResult(lat, lon, name, '');
  });
});

// Welcome feature cards — open location popup
document.querySelectorAll('.wf-card').forEach(card => {
  card.addEventListener('click', () => {
    const type = card.dataset.card;
    const icons = { hourly: '🕐', daily: '📅', details: '🌡️', ai: '🤖' };
    const titles = { hourly: 'Pick a city for hourly forecast', daily: 'Pick a city for 7-day forecast', details: 'Pick a city for full details', ai: 'Pick a city to ask AI about' };
    if (type === 'ai') {
      openLocPopup({ icon: icons[type], title: titles[type], sub: 'Load weather first, then chat with the AI!', callback: null });
    } else {
      openLocPopup({ icon: icons[type], title: titles[type], sub: 'Choose a city to view its forecast', callback: null });
    }
  });
});

// Clickable section cards (scroll to them)
document.querySelectorAll('#hourlyCard,#dailyCard,#detailsCard').forEach(card => {
  card.style.cursor = 'pointer';
  card.addEventListener('click', () => card.scrollIntoView({ behavior: 'smooth', block: 'start' }));
});

// ================================================================
//  SECTION 17 — INIT
// ================================================================
showWelcome();

// Auto-refresh every 10 minutes if a location is loaded
setInterval(() => {
  if (currentLocation) {
    loadWeather(currentLocation.lat, currentLocation.lon, currentLocation.name, currentLocation.country);
  }
}, 10 * 60 * 1000);

// Setup real-time weather refresh callbacks if available
if (typeof onWeatherRefresh !== 'undefined') {
  onWeatherRefresh((data, location) => {
    if (currentWeatherData && currentLocation) {
      console.log('🔄 Real-time weather update received');
      renderWeather(data, currentLocation.name, currentLocation.country);
    }
  });
}
