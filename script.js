/* ============================================================
   BIRTHDAY SURPRISE — script.js
   No DOMContentLoaded wrapper. Script is at bottom of body,
   so all DOM elements already exist when this runs.
   ============================================================ */

// ============================================================
// GLOBAL STATE
// ============================================================
var wrongAttempts   = 0;
var currentPage     = 1;
var chaserClicks    = 0;
var isMuted         = true;
var musicLocked     = true;
var synthPlaying    = false;
var melodyTimer     = null;
var melodyIndex     = 0;
var mp3Audio        = null;
var audioCtx        = null;
var canvas          = null;
var ctx             = null;
var stars           = [];
var fireworks       = [];
var particles       = [];
var confetti        = [];
var canvasW         = window.innerWidth;
var canvasH         = window.innerHeight;
var fireworkTimer   = null;
var balloonInterval = null;
var candlesLit      = true;
var animStarted     = false;

// ============================================================
// HELPER
// ============================================================
function $id(id) { return document.getElementById(id); }

// ============================================================
// AUDIO — lazy, safe
// ============================================================
function initAudio() {
  if (audioCtx) return;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  } catch(e) {}
}

function playTone(fA, fB, wave, dur, vol) {
  if (!audioCtx || isMuted) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    var osc  = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = wave || 'sine';
    osc.frequency.setValueAtTime(fA, audioCtx.currentTime);
    if (fB) osc.frequency.exponentialRampToValueAtTime(fB, audioCtx.currentTime + dur);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch(e) {}
}

function sfxSuccess() {
  playTone(523, 1046, 'sine', 0.35, 0.15);
  setTimeout(function(){ playTone(659, 1318, 'sine', 0.35, 0.15); }, 100);
}
function sfxError()    { playTone(150, 70, 'sawtooth', 0.4, 0.2); }
function sfxClick()    { playTone(800, 400, 'sine', 0.1, 0.1); }
function sfxWhoosh()   { playTone(200, 1000, 'triangle', 0.15, 0.15); }
function sfxType()     { playTone(2500, 50, 'sine', 0.03, 0.05); }
function sfxLidPop()   { playTone(100, 1500, 'triangle', 0.5, 0.3); setTimeout(function(){ playTone(300,400,'sine',0.2,0.2); },50); }
function sfxGlitch() {
  if (!audioCtx || isMuted) return;
  try {
    var n   = audioCtx.sampleRate * 0.3;
    var buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    var d   = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var src  = audioCtx.createBufferSource(); src.buffer = buf;
    var filt = audioCtx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 1000;
    var g    = audioCtx.createGain(); g.gain.setValueAtTime(0.15, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    src.connect(filt); filt.connect(g); g.connect(audioCtx.destination); src.start();
  } catch(e) {}
}
function sfxBlow() {
  if (!audioCtx || isMuted) return;
  try {
    var n   = audioCtx.sampleRate * 0.5;
    var buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    var d   = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var src  = audioCtx.createBufferSource(); src.buffer = buf;
    var filt = audioCtx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 600;
    var g    = audioCtx.createGain(); g.gain.setValueAtTime(0.3, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    src.connect(filt); filt.connect(g); g.connect(audioCtx.destination); src.start();
  } catch(e) {}
}

// ============================================================
// MELODY SYNTH
// ============================================================
var NOTES = { C4:261.63,D4:293.66,E4:329.63,F4:349.23,G4:392,A4:440,Bb4:466.16,C5:523.25,D5:587.33,E5:659.25,F5:698.46,G5:783.99,A5:880 };
var MELODY = [
  {n:'C4',d:.75},{n:'C4',d:.25},{n:'D4',d:1},{n:'C4',d:1},{n:'F4',d:1},{n:'E4',d:2},
  {n:'C4',d:.75},{n:'C4',d:.25},{n:'D4',d:1},{n:'C4',d:1},{n:'G4',d:1},{n:'F4',d:2},
  {n:'C4',d:.75},{n:'C4',d:.25},{n:'C5',d:1},{n:'A4',d:1},{n:'F4',d:1},{n:'E4',d:1},{n:'D4',d:2},
  {n:'Bb4',d:.75},{n:'Bb4',d:.25},{n:'A4',d:1},{n:'F4',d:1},{n:'G4',d:1},{n:'F4',d:2}
];

function playNote() {
  if (isMuted || !synthPlaying || !audioCtx) return;
  try {
    var nd  = MELODY[melodyIndex];
    var frq = NOTES[nd.n];
    var dur = nd.d * 0.65;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    var o1 = audioCtx.createOscillator(), o2 = audioCtx.createOscillator();
    var gn = audioCtx.createGain(), fn = audioCtx.createBiquadFilter();
    o1.type = 'triangle'; o1.frequency.setValueAtTime(frq, audioCtx.currentTime);
    o2.type = 'sine';     o2.frequency.setValueAtTime(frq * 0.5, audioCtx.currentTime);
    fn.type = 'lowpass';  fn.frequency.setValueAtTime(frq * 3, audioCtx.currentTime); fn.Q.value = 1;
    gn.gain.setValueAtTime(0, audioCtx.currentTime);
    gn.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.05);
    gn.gain.exponentialRampToValueAtTime(0.06, audioCtx.currentTime + dur * 0.5);
    gn.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o1.connect(fn); o2.connect(fn); fn.connect(gn); gn.connect(audioCtx.destination);
    o1.start(); o2.start(); o1.stop(audioCtx.currentTime + dur); o2.stop(audioCtx.currentTime + dur);
    melodyIndex = (melodyIndex + 1) % MELODY.length;
    melodyTimer = setTimeout(playNote, nd.d * 650);
  } catch(e) { melodyTimer = setTimeout(playNote, 500); }
}

function startMusic() {
  if (musicLocked) return;
  initAudio();
  try {
    if (!mp3Audio) { mp3Audio = new Audio('assets/music.mp3'); mp3Audio.loop = true; }
    mp3Audio.play().then(function() {
      synthPlaying = false; isMuted = false; updateMusicUI();
    }).catch(function() {
      synthPlaying = true; isMuted = false; melodyIndex = 0; playNote(); updateMusicUI();
    });
  } catch(e) {
    synthPlaying = true; isMuted = false; melodyIndex = 0; playNote(); updateMusicUI();
  }
}

function stopMusic() {
  synthPlaying = false;
  clearTimeout(melodyTimer);
  if (mp3Audio) { try { mp3Audio.pause(); } catch(e) {} }
  updateMusicUI();
}

// ============================================================
// MUSIC UI
// ============================================================
function updateMusicUI() {
  var btn = $id('music-toggle');
  if (!btn) return;
  if (musicLocked) { btn.classList.add('locked'); btn.title = 'Music Locked'; return; }
  btn.classList.remove('locked');
  btn.title = isMuted ? 'Unmute' : 'Mute';
  isMuted ? btn.classList.remove('playing') : btn.classList.add('playing');
}

var _musicBtn = $id('music-toggle');
if (_musicBtn) {
  _musicBtn.addEventListener('click', function() {
    if (musicLocked) return;
    initAudio(); isMuted = !isMuted;
    isMuted ? stopMusic() : startMusic();
    sfxClick();
  });
}

// ============================================================
// PAGE NAVIGATION
// ============================================================
function showPage(n) {
  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');
  var t = $id('page-' + n);
  if (t) t.classList.add('active');
  currentPage = n;
  var glows = document.querySelectorAll('.ambient-glow');
  for (var j = 0; j < glows.length; j++) glows[j].style.opacity = (n === 5) ? '0.35' : '0.15';
}

// ============================================================
// PAGE 1 — UNLOCK  (also called via onclick in HTML)
// ============================================================
function doUnlock() {
  var input = $id('name-input');
  var msg   = $id('unlock-msg');
  var hint  = $id('unlock-hint');
  if (!input) return;

  var val = input.value.trim().toLowerCase();

  if (val === 'juli') {
    musicLocked = false;
    isMuted     = false;
    updateMusicUI();
    if (msg)  msg.classList.add('hidden');
    if (hint) hint.classList.add('hidden');

    var card = document.querySelector('.glass-card');
    if (card) card.style.boxShadow = '0 0 60px rgba(0,242,254,0.6), 0 20px 50px rgba(0,0,0,0.6)';

    setTimeout(function() { showPage(2); setupChaser(); }, 800);

  } else {
    wrongAttempts++;
    input.classList.add('wiggle');
    setTimeout(function() { input.classList.remove('wiggle'); }, 400);

    if (wrongAttempts === 1) {
      if (msg) { msg.textContent = 'Not quite...'; msg.classList.remove('hidden'); }
    } else {
      if (msg)  msg.classList.add('hidden');
      if (hint) hint.classList.remove('hidden');
    }
  }
}

// Attach to button — belt AND suspenders: onclick in HTML + addEventListener
var _unlockBtn = $id('unlock-btn');
if (_unlockBtn) {
  _unlockBtn.addEventListener('click', function(e) { e.preventDefault(); doUnlock(); });
}
var _nameInput = $id('name-input');
if (_nameInput) {
  _nameInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); doUnlock(); }
  });
}

// ============================================================
// PAGE 2 — CHASER BUTTON
// ============================================================
var CHASER_MSGS = [
  "LoL!!","Again.","hahahaha","You're desparate.","Halfway there.",
  "Button is getting scared.","Keep chasing me...","One more...","MORE!",
  "A bit faster!","FASTER!!","Don't give up!","Are you sleepy?",
  "I'm speeding up!","Catch me if you can!","Tired yet?",
  "Almost there!","Almost! I mean it.","Prepare yourself...","ONE MORE CLICK!","FATAL ERROR!"
];

function setupChaser() {
  chaserClicks = 0;
  var btn = $id('chasing-btn');
  if (btn) { btn.style.display = ''; btn.style.transform = 'scale(1)'; }
  var banner = $id('chaser-banner');
  if (banner) banner.textContent = 'Click below to open!';
  var inst = $id('chaser-instruction');
  if (inst) inst.textContent = 'Your reward is waiting...';
  teleport();
}

function teleport() {
  var btn = $id('chasing-btn');
  if (!btn) return;
  var mg   = 80;
  var maxX = Math.max(mg, window.innerWidth  - (btn.offsetWidth  || 240) - mg);
  var maxY = Math.max(mg, window.innerHeight - (btn.offsetHeight || 70)  - mg);
  btn.style.left = Math.max(mg, Math.floor(Math.random() * maxX)) + 'px';
  btn.style.top  = Math.max(mg, Math.floor(Math.random() * maxY)) + 'px';
}

var _chaserBtn = $id('chasing-btn');
if (_chaserBtn) {
  _chaserBtn.addEventListener('click', function() {
    chaserClicks++;
    sfxWhoosh();
    if (chaserClicks < 21) {
      teleport();
      var banner = $id('chaser-banner');
      if (banner) banner.textContent = CHASER_MSGS[chaserClicks - 1] || '';
      this.style.transform = 'scale(' + Math.max(0.65, 1 - chaserClicks * 0.015) + ')';
    } else {
      sfxGlitch();
      document.body.classList.add('glitch-active');
      var banner2 = $id('chaser-banner');
      if (banner2) { banner2.textContent = CHASER_MSGS[20]; banner2.style.color = '#ff0055'; }
      this.style.display = 'none';
      var gi = setInterval(sfxGlitch, 200);
      setTimeout(function() {
        clearInterval(gi);
        document.body.classList.remove('glitch-active');
        showPage(3);
        startTerminal();
      }, 1800);
    }
  });
}

window.addEventListener('resize', function() { if (currentPage === 2) teleport(); });

// ============================================================
// PAGE 3 — TERMINAL
// ============================================================
var HACK_STEPS = [
  { text: "Initializing security override...", delay: 800, cls: "" },
  { text: "Access Granted. Local directory mapped.", delay: 600, cls: "success" },
  { text: "Connecting to remote backup servers...", delay: 1000, cls: "" },
  { text: "SCANNING DEVICE PHOTOS...", delay: 1200, cls: "danger" },
  { text: "WARNING: Found 42 embarrassing selfie files.", delay: 900, cls: "danger" },
  { text: "Uploading to ftp.family-chat-group.org...", delay: 1400, cls: "" },
  { text: "Posted embarrassing pictures to Family Chat! 💬 ✔️", delay: 1000, cls: "success" },
  { text: "Locating: Saumya's instagram account", delay: 700, cls: "" },
  { text: "Messaging: I LOVE YOU", delay: 900, cls: "danger" },
  { text: "Retriving system files", delay: 800, cls: "" },
  { text: "Sending it to server: ritul_local8800", delay: 1500, cls: "danger" }
];
var termLineIdx = 0;

function startTerminal() {
  var tc = $id('terminal-content');
  var vj = $id('virus-joking');
  if (tc) tc.innerHTML = '';
  if (vj) vj.classList.add('hidden');
  termLineIdx = 0;
  typeNextLine();
}

function typeNextLine() {
  if (termLineIdx >= HACK_STEPS.length) {
    setTimeout(function() {
      var vj = $id('virus-joking');
      if (vj) vj.classList.remove('hidden');
    }, 1500);
    return;
  }
  var step = HACK_STEPS[termLineIdx];
  var tc   = $id('terminal-content');
  var line = document.createElement('span');
  line.className = 'terminal-line ' + step.cls + ' cursor';
  if (tc) tc.appendChild(line);
  var ci = 0;
  function typeChar() {
    if (ci < step.text.length) {
      line.textContent += step.text.charAt(ci++);
      sfxType();
      setTimeout(typeChar, 20 + Math.random() * 30);
    } else {
      line.classList.remove('cursor');
      termLineIdx++;
      var body = document.querySelector('.terminal-body');
      if (body) body.scrollTop = body.scrollHeight;
      setTimeout(typeNextLine, step.delay);
    }
  }
  typeChar();
}

var _proceedBtn = $id('proceed-btn');
if (_proceedBtn) {
  _proceedBtn.addEventListener('click', function() { sfxClick(); showPage(4); startLoader(); });
}

// ============================================================
// PAGE 4 — LOADER
// ============================================================
var LOAD_MSGS = [
  { range:[0,15],   text:"Inflating balloons... 🎈" },
  { range:[16,35],  text:"Lighting birthday candles... 🕯️" },
  { range:[36,55],  text:"Ordering yummy cake... 🎂" },
  { range:[56,75],  text:"Finding beautiful wishes... 🌟" },
  { range:[76,90],  text:"Making magic confetti... ✨" },
  { range:[91,100], text:"Starting fireworks show... 🎆" }
];

function startLoader() {
  var progress = 0;
  var fill  = $id('progress-fill');
  var pct   = $id('progress-percentage');
  var stat  = $id('loading-status');
  var gift  = $id('gift-wrapper');
  if (fill) fill.style.width = '0%';
  if (pct)  pct.textContent  = '0%';
  if (gift) gift.classList.add('shaking');

  var iv = setInterval(function() {
    progress += Math.floor(Math.random() * 3) + 1;
    if (progress >= 100) { progress = 100; clearInterval(iv); doneLoading(); }
    if (fill) fill.style.width = progress + '%';
    if (pct)  pct.textContent  = progress + '%';
    for (var i = 0; i < LOAD_MSGS.length; i++) {
      if (progress >= LOAD_MSGS[i].range[0] && progress <= LOAD_MSGS[i].range[1]) {
        if (stat) stat.textContent = LOAD_MSGS[i].text; break;
      }
    }
    if (gift) gift.style.animationDuration = Math.max(0.12, 1 - progress * 0.007) + 's';
  }, 120);
}

function doneLoading() {
  var gift = $id('gift-wrapper');
  var stat = $id('loading-status');
  if (gift) gift.classList.remove('shaking');
  if (stat) { stat.textContent = 'Click the gift to unwrap! 🎁'; stat.style.fontWeight = 'bold'; stat.style.color = 'var(--glow-cyan)'; }
  if (gift) gift.addEventListener('click', lidPop, { once: true });
}

function lidPop() {
  sfxLidPop();
  var gift  = $id('gift-wrapper');
  var flash = $id('flash-overlay');
  if (gift) gift.classList.add('lid-off');
  setTimeout(function() {
    if (flash) flash.classList.add('flash-active');
    setTimeout(function() {
      if (flash) { flash.classList.remove('flash-active'); flash.style.opacity = '1'; }
      showPage(5);
      startCelebration();
      setTimeout(function() {
        if (flash) { flash.style.transition = 'opacity 1.5s ease-out'; flash.style.opacity = '0'; }
      }, 100);
    }, 200);
  }, 700);
}

// ============================================================
// PAGE 5 — CANVAS CELEBRATION
// ============================================================
function initCanvas() {
  canvas = $id('birthday-canvas');
  if (canvas && !ctx) {
    try { ctx = canvas.getContext('2d'); } catch(e) { ctx = null; }
  }
  canvasW = window.innerWidth; canvasH = window.innerHeight;
  if (canvas) { canvas.width = canvasW; canvas.height = canvasH; }
  makeStars(300);
}

function makeStars(n) {
  stars = [];
  for (var i = 0; i < n; i++) stars.push({ x: Math.random()*canvasW, y: Math.random()*canvasH*0.7, r: Math.random()*1.5+0.5, a: Math.random(), sp: 0.01+Math.random()*0.03 });
}

function mkConfetti() {
  var cols = ['#ff0844','#00f2fe','#f5af19','#39ff14','#e100ff','#fff'];
  return { x:Math.random()*canvasW, y:-20, s:Math.random()*8+6, c:cols[Math.floor(Math.random()*cols.length)], vy:Math.random()*2+1.5, vx:Math.random()*2-1, r:Math.random()*360, rs:Math.random()*4-2, rx:Math.random()*360, rxs:Math.random()*5+2 };
}

function mkFirework(sx,sy,tx,ty) {
  var ang = Math.atan2(ty-sy, tx-sx);
  return { x:sx, y:sy, tx:tx, ty:ty, vx:Math.cos(ang)*4.5, vy:Math.sin(ang)*4.5, hue:Math.random()*360 };
}

function mkSpark(x,y,hue) {
  return { x:x, y:y, ang:Math.random()*Math.PI*2, sp:Math.random()*4+1, fr:0.95, gr:0.07, hue:hue+(Math.random()*30-15), a:1, dec:Math.random()*0.02+0.01, r:Math.random()*2+1 };
}

function burst(x,y,hue) {
  for (var i=0;i<80;i++) particles.push(mkSpark(x,y,hue));
  playTone(300+Math.random()*200, 50, 'sine', 0.25, 0.05);
}

function launch(tx,ty) {
  fireworks.push(mkFirework(tx+(Math.random()*100-50), canvasH+10, tx, ty));
}

function autoFirework() {
  if (currentPage===5) launch(Math.random()*canvasW, Math.random()*canvasH*0.5+50);
  fireworkTimer = setTimeout(autoFirework, 1500+Math.random()*1200);
}

function spawnBalloon() {
  if (currentPage!==5) return;
  var cnt = document.querySelector('.celebration-content');
  if (!cnt) return;
  var b = document.createElement('div'), s = document.createElement('div');
  b.className='balloon'; s.className='balloon-string'; b.appendChild(s);
  var sz = Math.floor(Math.random()*40)+40;
  b.style.width=sz+'px'; b.style.height=(sz*1.25)+'px'; b.style.borderRadius='50% 50% 50% 50% / 40% 40% 60% 60%';
  var cols=['#ff0844','#ffb199','#00f2fe','#4facfe','#f5af19','#ffd1ff','#39ff14','#e100ff'];
  var c=cols[Math.floor(Math.random()*cols.length)]; b.style.backgroundColor=c; b.style.color=c;
  b.style.left=(Math.random()*90)+'%'; b.style.position='absolute'; b.style.bottom='-120px'; b.style.opacity='0.9';
  var dur=Math.random()*5+5;
  b.style.transition='transform '+dur+'s linear, opacity '+dur+'s ease'; cnt.appendChild(b);
  requestAnimationFrame(function(){ b.style.transform='translateY(-'+(canvasH+200)+'px) translateX('+(Math.random()*100-50)+'px)'; });
  setTimeout(function(){ b.remove(); }, dur*1000);
}

function startBalloons() {
  for (var i=0;i<6;i++) setTimeout(spawnBalloon, i*400);
  balloonInterval = setInterval(spawnBalloon, 1500);
}

function draw() {
  requestAnimationFrame(draw);
  if (!ctx) return;
  ctx.fillStyle='rgba(11,11,22,0.2)';
  ctx.fillRect(0,0,canvasW,canvasH);
  if (currentPage!==5) return;

  // Stars
  for (var i=0;i<stars.length;i++) {
    var st=stars[i]; st.a+=st.sp;
    if (st.a>1||st.a<0) st.sp=-st.sp;
    ctx.beginPath(); ctx.arc(st.x,st.y,st.r,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,'+Math.max(0.1,st.a)+')'; ctx.fill();
  }
  // Fireworks
  for (var f=fireworks.length-1;f>=0;f--) {
    var fw=fireworks[f];
    ctx.beginPath(); ctx.arc(fw.x,fw.y,2,0,Math.PI*2);
    ctx.fillStyle='hsl('+fw.hue+',100%,70%)'; ctx.fill();
    fw.x+=fw.vx; fw.y+=fw.vy; fw.vy+=0.01;
    if (fw.x<0||fw.x>canvasW||fw.y<0||fw.y>canvasH||Math.hypot(fw.x-fw.tx,fw.y-fw.ty)<=8||fw.y<=fw.ty) {
      burst(fw.tx,fw.ty,fw.hue); fireworks.splice(f,1);
    }
  }
  // Sparks
  for (var p=particles.length-1;p>=0;p--) {
    var sp=particles[p];
    ctx.save(); ctx.globalCompositeOperation='lighter';
    ctx.beginPath(); ctx.arc(sp.x,sp.y,sp.r,0,Math.PI*2);
    ctx.fillStyle='hsla('+sp.hue+',100%,60%,'+sp.a+')';
    ctx.shadowBlur=8; ctx.shadowColor='hsl('+sp.hue+',100%,50%)'; ctx.fill(); ctx.restore();
    sp.sp*=sp.fr; sp.x+=Math.cos(sp.ang)*sp.sp; sp.y+=Math.sin(sp.ang)*sp.sp+sp.gr; sp.a-=sp.dec;
    if (sp.a<=0) particles.splice(p,1);
  }
  // Confetti
  if (confetti.length<100) confetti.push(mkConfetti());
  for (var c=0;c<confetti.length;c++) {
    var pc=confetti[c]; pc.y+=pc.vy; pc.x+=pc.vx+Math.sin(pc.y*0.01)*0.2; pc.r+=pc.rs; pc.rx+=pc.rxs;
    ctx.save(); ctx.translate(pc.x,pc.y); ctx.rotate(pc.r*Math.PI/180); ctx.scale(Math.cos(pc.rx*Math.PI/180),1);
    ctx.fillStyle=pc.c; ctx.fillRect(-pc.s/2,-pc.s/2,pc.s,pc.s*1.5); ctx.restore();
    if (pc.y>canvasH) confetti[c]=mkConfetti();
  }
}

function startCelebration() {
  initCanvas();
  if (!animStarted) { animStarted=true; draw(); }
  autoFirework(); startBalloons(); startMusic();
  var ac = document.querySelector('.achievement-card');
  if (ac) setTimeout(function(){ ac.classList.add('slide-in'); }, 1500);
}

// Canvas click handlers (safe — canvas may be null until startCelebration)
document.addEventListener('mousedown', function(e) {
  if (currentPage===5 && canvas && e.target===canvas) launch(e.clientX, e.clientY);
});
document.addEventListener('touchstart', function(e) {
  if (currentPage===5 && canvas && e.target===canvas) { var t=e.touches[0]; launch(t.clientX,t.clientY); }
}, { passive:true });

// Cake click
var _cake = $id('cake-interactive');
if (_cake) {
  _cake.addEventListener('click', function() {
    var candles = document.querySelectorAll('.candle');
    var lbl = $id('cake-label');
    if (candlesLit) {
      sfxBlow(); candlesLit=false;
      for (var i=0;i<candles.length;i++) candles[i].classList.add('blown-out');
      if (lbl) lbl.textContent='Click to light candles! 🕯️';
      for (var j=0;j<5;j++) (function(k){ setTimeout(function(){ launch(Math.random()*canvasW, Math.random()*canvasH*0.4+100); },k*150); })(j);
      for (var m=0;m<120;m++) confetti.push(mkConfetti());
      for (var n=0;n<12;n++) setTimeout(spawnBalloon, n*100);
    } else {
      sfxSuccess(); candlesLit=true;
      for (var i2=0;i2<candles.length;i2++) candles[i2].classList.remove('blown-out');
      if (lbl) lbl.textContent='Click to blow candles! 🎂';
    }
  });
}

window.addEventListener('resize', function() {
  canvasW=window.innerWidth; canvasH=window.innerHeight;
  if (canvas) { canvas.width=canvasW; canvas.height=canvasH; makeStars(300); }
  if (currentPage===2) teleport();
});