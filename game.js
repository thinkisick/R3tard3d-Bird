// ═══════════════════════════════════════════════════════════════
//  R3TARD3D BIRD
// ═══════════════════════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// ─── ASSET MANIFEST ─────────────────────────────────────────────
const TRAITS = {
    backgrounds: ['EMO','GOLD','GREEN','NAD','OG','PURPLE','QUANT'],
    eyes: [
        'BROFUN EYES','CHILLIN','CUTE','EMO','INLOVE','LASER',
        'MADNESS','MENTAL','MOG','MONAD MADNESS','NONE',
        'POTHEAD','SUS','UNAWARE','WASTED'
    ],
    mouth: [
        'BRITISH','BTC','CUTE mouth','EMO','HMM','JUICY CIG',
        'JUICY','LSD','OLD MAN CIG','OLD MAN','PUMPFUN',
        'PURPLE PILL','TRIPPE TONGUE','TRIPPIE CIG','TRIPPIE'
    ]
};

const EYES_RANDOM = TRAITS.eyes.map((n,i)=>i).filter(i => TRAITS.eyes[i] !== 'NONE');

const PATHS = {
    backgrounds: 'assets/traits/backgrounds',
    eyes:        'assets/traits/eyes',
    mouth:       'assets/traits/mouth'
};

const CATS       = ['backgrounds','eyes','mouth'];
const CAT_LABELS = { backgrounds: 'BG', eyes: 'EYES', mouth: 'MOUTH' };

// ─── IMAGE STORE ─────────────────────────────────────────────────
const IMG = { backgrounds: {}, eyes: {}, mouth: {} };
let loadedCount  = 0;
const totalCount = CATS.reduce((s,c) => s + TRAITS[c].length, 0);
const MIN_LOAD   = 2500;
const loadStart  = Date.now();

function preloadImages() {
    CATS.forEach(cat => {
        TRAITS[cat].forEach(name => {
            const img = new Image();
            img.src = `${PATHS[cat]}/${encodeURIComponent(name)}.png`;
            img.onload = img.onerror = () => {
                loadedCount++;
                document.getElementById('load-bar').style.width =
                    (loadedCount / totalCount * 100) + '%';
                if (loadedCount >= totalCount) {
                    const wait = Math.max(0, MIN_LOAD - (Date.now() - loadStart));
                    setTimeout(revealGame, wait);
                }
            };
            IMG[cat][name] = img;
        });
    });
}

function revealGame() {
    canvas.style.display = 'block';
    const ls = document.getElementById('loading-screen');
    ls.style.opacity = '0';
    setTimeout(() => { ls.style.display = 'none'; }, 500);
    demo.init();
    state = 'MENU';
    lbFetch();
    lbConnect();
}

// ─── BACKGROUND MUSIC ────────────────────────────────────────────
// Add more filenames here as you upload tracks to Music/
const MUSIC_TRACKS = [
    'Music/Milky_-_Just_The_Way_You_Are_Radio_Edit_(SkySound.cc).mp3',
];
let _bgAudio    = null;
let _musicReady = false;  // true only when audio is actually playing

function _shuffled(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

let _playlist = [];
function _playTrack(idx) {
    if (_bgAudio) { _bgAudio.pause(); _bgAudio = null; }
    if (!_playlist.length) return;
    _bgAudio = new Audio(_playlist[idx % _playlist.length]);
    _bgAudio.volume = 0.18;
    _bgAudio.onended = () => _playTrack(idx + 1);
    _bgAudio.play().catch(() => {
        // Autoplay was blocked — reset so the next user gesture retries
        _bgAudio    = null;
        _musicReady = false;
    });
}

function startMusicOnce() {
    if (_musicReady || !MUSIC_TRACKS.length) return;
    _musicReady = true;  // set optimistically; reset on play() failure
    if (!_playlist.length) _playlist = _shuffled(MUSIC_TRACKS);
    _playTrack(0);
}

function stopMusic() {
    if (_bgAudio) { _bgAudio.pause(); _bgAudio = null; }
    _musicReady = false;
}

// ─── RESPONSIVE CANVAS ───────────────────────────────────────────
let GH, BIRDX, BIRDY0, BIRDR, BIRDHR, PIPEW, PIPEGAP, PIPESPD, GRAVITY_V, FLAP_V;

function recalc() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    GH        = Math.round(canvas.height * 0.12);
    BIRDR     = Math.min(Math.round(canvas.height * 0.054), 55);
    BIRDHR    = Math.round(BIRDR * 0.74);
    BIRDX     = Math.round(canvas.width * 0.25);
    BIRDY0    = Math.round(canvas.height * 0.47);
    PIPEW     = Math.min(Math.round(canvas.width * 0.16), 110);
    PIPEGAP   = Math.round(canvas.height * 0.28);
    PIPESPD   = Math.min(canvas.width * 0.0063, 7);
    GRAVITY_V = canvas.height * 0.00072;
    FLAP_V    = -(canvas.height * 0.0145);
}

recalc();
window.addEventListener('resize', () => {
    recalc();
    bird.x = BIRDX;
    if (state !== 'PLAYING') bird.y = BIRDY0;
});

// ─── GAME STATE ──────────────────────────────────────────────────
// 'MENU' | 'CUSTOMIZER' | 'PLAYING' | 'DYING' | 'DEAD'
let state      = 'MENU';
let menuTimer  = 0;
let deadTimer  = 0;
let dyingTimer = 0;

const sel = { backgrounds: 4, eyes: 5, mouth: 6 };
let score      = 0;
let best       = +localStorage.getItem('r3b_best') || 0;
let frameCount = 0;
const PIPE_INT = 95;

// ─── WORLD TIERS ─────────────────────────────────────────────────
const TIERS = [
    { min:0,  tint: null,                   pc:'#4CAF50', pd:'#388E3C', gd:'#5d3a1a', gc:'#2e7d32', gc2:'#43a047' },
    { min:10, tint:'rgba(255,80,0,0.15)',   pc:'#FF7043', pd:'#E64A19', gd:'#4e2000', gc:'#bf5000', gc2:'#e65100' },
    { min:20, tint:'rgba(0,0,40,0.38)',     pc:'#1565C0', pd:'#0D47A1', gd:'#0d0d1e', gc:'#1a237e', gc2:'#283593' },
    { min:30, tint:'rgba(120,0,0,0.42)',    pc:'#B71C1C', pd:'#7F0000', gd:'#1a0000', gc:'#7f0000', gc2:'#c62828' },
];
let currentTier = 0;
let currentBg   = 0;

// ─── SCORE POP ───────────────────────────────────────────────────
let scoreAnim = 0;
let prevScore = 0;
let plusOneY  = 0;
let plusOneT  = 0;

// ─── MENU BIRD (portal mechanic) ─────────────────────────────────
const mBird = { x:0, y:0, vy:0 };
function initMenuBird() {
    mBird.x  = canvas.width * 0.12;
    mBird.y  = canvas.height * 0.5;
    mBird.vy = 0;
}

// ─── MENU DEMO (live background gameplay) ────────────────────────
const demo = {
    bird: { y: 0, vy: 0 },
    pipes: [],
    timer: 60,
    init() {
        this.bird.y  = canvas.height * 0.45;
        this.bird.vy = 0;
        this.pipes   = [];
        this.timer   = 60;
    },
    update() {
        this.bird.vy = Math.min(this.bird.vy + GRAVITY_V, canvas.height * 0.022);
        this.bird.y += this.bird.vy;

        // gentle flap — 58% of player force so arcs are smooth, not bouncy
        const demoFlap = FLAP_V * 0.58;
        const next = this.pipes.find(p => p.x + PIPEW > BIRDX - BIRDR);
        if (next) {
            const gapMid = next.topH + PIPEGAP * 0.5;
            // flap only while falling and below gap centre — one clean arc per gap
            if (this.bird.vy >= 0 && this.bird.y > gapMid) {
                this.bird.vy = demoFlap;
            }
            // safety snap if somehow inside a pipe
            const inX = next.x < BIRDX + BIRDR && next.x + PIPEW > BIRDX - BIRDR;
            if (inX && (this.bird.y < next.topH + BIRDR || this.bird.y > next.topH + PIPEGAP - BIRDR)) {
                this.bird.y  += (gapMid - this.bird.y) * 0.4;
                this.bird.vy  = demoFlap;
            }
        } else {
            // no pipe: hover near 48% height — flap only while falling
            if (this.bird.vy >= 0 && this.bird.y > canvas.height * 0.48) {
                this.bird.vy = demoFlap;
            }
        }

        // guard edges
        if (this.bird.y < BIRDR * 2) { this.bird.y = BIRDR * 2; this.bird.vy = 0; }
        if (this.bird.y > canvas.height - GH - BIRDR * 2) {
            this.bird.y = canvas.height - GH - BIRDR * 2;
            this.bird.vy = FLAP_V;
        }
        // pipes — 1.4× spacing so the bird always looks confident
        if (++this.timer >= Math.round(PIPE_INT * 1.4)) {
            const minH = GH + 60, maxH = canvas.height - GH - PIPEGAP - minH;
            this.pipes.push({ x: canvas.width + 10, topH: minH + Math.random() * maxH });
            this.timer = 0;
        }
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            this.pipes[i].x -= PIPESPD;
            if (this.pipes[i].x + PIPEW < -20) this.pipes.splice(i, 1);
        }
    }
};

// ─── LEADERBOARD ─────────────────────────────────────────────────
// Global leaderboard uses Firebase Realtime Database (free tier).
// To activate: console.firebase.google.com → New project → Realtime Database
// → Start in TEST mode → copy the URL below (ends with .firebaseio.com)
// Without it, scores are still saved locally per-browser.
const FIREBASE_URL = 'https://r3tard3d-bird-default-rtdb.firebaseio.com';

let lbData        = [];   // [{nickname, score}, ...] top 10
let nicknameInput = '';   // text being typed in nickname entry

function lbSavedNick() { return localStorage.getItem('r3b_nick') || ''; }

function lbAddLocal(nick, sc) {
    const local = JSON.parse(localStorage.getItem('r3b_lb') || '{}');
    if (!local[nick] || local[nick].score < sc)
        local[nick] = { nickname: nick, score: sc };
    localStorage.setItem('r3b_lb', JSON.stringify(local));
    lbData = Object.values(local).sort((a,b)=>b.score-a.score).slice(0,10);
}

async function lbSubmit(nick, sc) {
    if (!nick || sc <= 0) return;
    localStorage.setItem('r3b_nick', nick);
    lbAddLocal(nick, sc);
    if (!FIREBASE_URL) return;
    try {
        // Keep only best score per nickname
        const existing = await fetch(`${FIREBASE_URL}/lb/${encodeURIComponent(nick)}.json`);
        const cur = await existing.json();
        if (cur && typeof cur.score === 'number' && cur.score >= sc) return; // not a new best
        await fetch(`${FIREBASE_URL}/lb/${encodeURIComponent(nick)}.json`, {
            method: 'PUT',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ nickname: nick, score: sc, ts: Date.now() })
        });
    } catch(e) {}
}

async function lbFetch() {
    if (!FIREBASE_URL) {
        const local = JSON.parse(localStorage.getItem('r3b_lb') || '{}');
        lbData = Object.values(local).sort((a,b) => b.score - a.score).slice(0, 10);
        return;
    }
    try {
        const r = await fetch(`${FIREBASE_URL}/lb.json`);
        const d = await r.json();
        if (d && typeof d === 'object' && !d.error) {
            Object.keys(_lbCache).forEach(k => delete _lbCache[k]);
            Object.assign(_lbCache, d);
            _lbUpdateFromCache();
        }
    } catch(e) {
        const local = JSON.parse(localStorage.getItem('r3b_lb') || '{}');
        if (Object.keys(_lbCache).length === 0)
            lbData = Object.values(local).sort((a,b) => b.score - a.score).slice(0, 10);
    }
}

// ─── LIVE LEADERBOARD (Firebase SSE) ────────────────────────────
const _lbCache = {};
let _lbEs = null;

function _lbUpdateFromCache() {
    lbData = Object.values(_lbCache)
        .filter(v => v && typeof v.score === 'number')
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
}

function lbConnect() {
    if (!FIREBASE_URL || typeof EventSource === 'undefined') {
        setInterval(lbFetch, 10000);
        return;
    }
    if (_lbEs) return;
    try {
        _lbEs = new EventSource(`${FIREBASE_URL}/lb.json`);
        _lbEs.addEventListener('put', e => {
            try {
                const { path, data } = JSON.parse(e.data);
                if (path === '/') {
                    Object.keys(_lbCache).forEach(k => delete _lbCache[k]);
                    if (data && typeof data === 'object') Object.assign(_lbCache, data);
                } else {
                    const key = decodeURIComponent(path.slice(1));
                    if (data === null) delete _lbCache[key];
                    else _lbCache[key] = data;
                }
                _lbUpdateFromCache();
            } catch(_) {}
        });
        _lbEs.addEventListener('patch', e => {
            try {
                const { path, data } = JSON.parse(e.data);
                if (data && typeof data === 'object') {
                    if (path === '/') Object.assign(_lbCache, data);
                    else _lbCache[decodeURIComponent(path.slice(1))] = data;
                    _lbUpdateFromCache();
                }
            } catch(_) {}
        });
        _lbEs.onerror = () => {
            _lbEs.close();
            _lbEs = null;
            setTimeout(lbConnect, 15000);
        };
    } catch(_) {
        setInterval(lbFetch, 10000);
    }
}

// ─── NICKNAME HTML INPUT OVERLAY ─────────────────────────────────
// A transparent <input> with pointer-events:none that is focused
// programmatically so mobile keyboards appear when the user taps.
let _nickEl = null;

function _ensureNickEl() {
    if (_nickEl) return;
    _nickEl = document.createElement('input');
    _nickEl.type        = 'text';
    _nickEl.maxLength   = 20;
    _nickEl.autocomplete = 'off';
    _nickEl.autocorrect  = 'off';
    _nickEl.autocapitalize = 'characters';
    _nickEl.spellcheck   = false;
    Object.assign(_nickEl.style, {
        position      : 'fixed',
        top           : '0', left: '0',
        width         : '1px', height: '1px',
        opacity       : '0',
        pointerEvents : 'none',   // never blocks canvas clicks
        border        : 'none',
        outline       : 'none',
        fontSize      : '16px',   // prevent iOS auto-zoom
        zIndex        : '100',
    });
    _nickEl.addEventListener('input', () => { nicknameInput = _nickEl.value; });
    _nickEl.addEventListener('keydown', e => {
        e.stopPropagation(); // prevent double-firing with handleKey
        if (e.key === 'Enter')     { e.preventDefault(); _nickCommit(); }
        if (e.key === 'Escape')    { e.preventDefault(); _nickSkipFn(); }
        if (e.key === 'Backspace') { /* handled by browser, input event fires */ }
    });
    document.body.appendChild(_nickEl);
}

function _nickShow() {
    _ensureNickEl();
    _nickEl.value = nicknameInput || '';
    _nickEl.style.display = 'block';
    // requestAnimationFrame ensures focus fires within the current user-gesture
    requestAnimationFrame(() => { _nickEl.focus(); _nickEl.select(); });
}

function _nickHide() {
    if (!_nickEl) return;
    _nickEl.style.display = 'none';
    _nickEl.blur();
}

function _nickCommit() {
    const nick = (nicknameInput || '').trim().slice(0, 20);
    if (nick) lbSubmit(nick, score);
    _nickHide();
    state = 'DEAD'; deadTimer = 0;
}

function _nickSkipFn() {
    _nickHide();
    state = 'DEAD'; deadTimer = 0;
}

// ─── SCREEN CRACKS ───────────────────────────────────────────────
const cracks = [];
function generateCracks(ox, oy) {
    cracks.length = 0;
    for (let i = 0; i < 11; i++) {
        const angle = (i/11)*Math.PI*2 + (Math.random()-0.5)*0.7;
        const len   = Math.min(canvas.width,canvas.height)*(0.22+Math.random()*0.32);
        const segs  = 3 + Math.floor(Math.random()*3);
        const pts   = [{x:ox,y:oy}];
        let cx=ox, cy=oy, a=angle;
        for (let s=0;s<segs;s++) {
            a += (Math.random()-0.5)*0.45;
            const d = (len/segs)*(0.6+Math.random()*0.8);
            cx += Math.cos(a)*d; cy += Math.sin(a)*d;
            pts.push({x:cx,y:cy});
        }
        cracks.push(pts);
    }
}

// ─── MOUSE TRACKING ──────────────────────────────────────────────
let mouseX = -999, mouseY = -999;
canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouseX = (e.clientX-r.left)*canvas.width/r.width;
    mouseY = (e.clientY-r.top)*canvas.height/r.height;
});

// ─── EASING ──────────────────────────────────────────────────────
function easeOut(t, d) { const x = Math.min(t/d, 1); return 1-(1-x)*(1-x); }
function easeOutBack(t, d) {
    const x = Math.min(t/d, 1);
    const c1 = 1.70158, c3 = c1+1;
    return 1 + c3*Math.pow(x-1,3) + c1*Math.pow(x-1,2);
}

// ─── COLOUR UTILITIES ────────────────────────────────────────────
function _hexBrighter(hex, t) {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgb(${Math.min(255,r+255*t)|0},${Math.min(255,g+255*t)|0},${Math.min(255,b+255*t)|0})`;
}
function _hexDarker(hex, t) {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgb(${(r*(1-t))|0},${(g*(1-t))|0},${(b*(1-t))|0})`;
}

// ─── PRESS STATE (button push effect) ────────────────────────────
let _pressX = -999, _pressY = -999;

// ─── STAR FIELD ──────────────────────────────────────────────────
const _stars = Array.from({length: 75}, () => ({
    xf: Math.random(),
    yf: 0.04 + Math.random() * 0.76,
    r:  0.4 + Math.random() * 1.6,
    a:  0.25 + Math.random() * 0.75,
    t:  Math.random() * Math.PI * 2
}));

function _drawStars() {
    const W = canvas.width, H = canvas.height - GH;
    _stars.forEach(s => {
        const a = s.a * (0.45 + Math.sin(frameCount * 0.038 + s.t) * 0.55);
        ctx.beginPath();
        ctx.arc(s.xf * W, s.yf * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
        ctx.fill();
    });
}

// ─── CITY PARALLAX ───────────────────────────────────────────────
function _genSkyline(count, segW, minH, maxH, seed) {
    const s = []; let r = seed;
    for (let i = 0; i < count; i++) {
        r = (r * 16807) % 2147483647;
        const h = minH + (r / 2147483647) * (maxH - minH);
        r = (r * 16807) % 2147483647;
        const w = segW * (0.5 + (r / 2147483647) * 0.9);
        s.push({ w, h });
    }
    return s;
}
const _cityFar  = _genSkyline(52, 58, 0.09, 0.30, 0x5A3E7B);
const _cityNear = _genSkyline(40, 42, 0.05, 0.17, 0x2F9AC4);

function _drawCityLayer(segs, colorFill, scrollSpd) {
    const H = canvas.height, W = canvas.width, gY = H - GH;
    const totalW = segs.reduce((s, b) => s + b.w, 0);
    const off = (frameCount * scrollSpd) % totalW;
    ctx.fillStyle = colorFill;
    for (let copy = -1; copy <= Math.ceil(W / totalW) + 1; copy++) {
        let dx = copy * totalW - off;
        for (const b of segs) {
            if (dx > W) break;
            if (dx + b.w > 0) ctx.fillRect(dx, gY - b.h * H, b.w - 1, b.h * H);
            dx += b.w;
        }
    }
}

// ─── PARTICLE SYSTEM ─────────────────────────────────────────────
const _particles = [];

function spawnParticles(x, y) {
    const palette = ['#e74c3c','#FFD700','#9b59b6','#3498db','#2ecc71','#e67e22','#ff69b4','#fff'];
    for (let i = 0; i < 26; i++) {
        const angle = (i / 26) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
        const spd   = 2.5 + Math.random() * 7.5;
        _particles.push({
            x, y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 2.5,
            r:  2.5 + Math.random() * 4.5,
            life: 1,
            decay: 0.020 + Math.random() * 0.018,
            color: palette[i % palette.length],
            grav: 0.16 + Math.random() * 0.14
        });
    }
}

function updateDrawParticles() {
    for (let i = _particles.length - 1; i >= 0; i--) {
        const p = _particles[i];
        p.x += p.vx; p.y += p.vy;
        p.vy += p.grav; p.vx *= 0.97;
        p.life -= p.decay;
        if (p.life <= 0) { _particles.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * Math.max(0.2, p.life), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// ─── BIRD ────────────────────────────────────────────────────────
const bird = {
    x: BIRDX, y: BIRDY0, vy: 0, rot: 0,

    reset() { this.x = BIRDX; this.y = BIRDY0; this.vy = 0; this.rot = 0; },
    flap()  { this.vy = FLAP_V; },

    update() {
        this.vy  = Math.min(this.vy + GRAVITY_V, canvas.height * 0.022);
        this.y  += this.vy;
        this.rot = Math.max(-25, Math.min(90, this.vy / GRAVITY_V * 3.3));
    },

    // showBg: draw bg layer (customizer / menu preview)
    // r: optional radius override
    draw(ox, oy, or_, showBg, r) {
        const bx = ox  ?? this.x;
        const by = oy  ?? this.y;
        const br = or_ ?? this.rot;
        const R  = r   ?? BIRDR;
        const d  = R * 2;

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(br * Math.PI / 180);
        ctx.scale(-1, 1);

        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.clip();

        if (showBg) {
            const bgImg = IMG.backgrounds[TRAITS.backgrounds[sel.backgrounds]];
            if (imgReady(bgImg)) {
                ctx.drawImage(bgImg, -R, -R, d, d);
            } else {
                ctx.fillStyle = '#2a2a3e';
                ctx.fillRect(-R, -R, d, d);
            }
        }

        const eyeImg = IMG.eyes[TRAITS.eyes[sel.eyes]];
        if (imgReady(eyeImg)) ctx.drawImage(eyeImg, -R, -R, d, d);

        const mouthImg = IMG.mouth[TRAITS.mouth[sel.mouth]];
        if (imgReady(mouthImg)) ctx.drawImage(mouthImg, -R, -R, d, d);

        ctx.restore();
    },

    isDead() {
        return this.y + BIRDHR > canvas.height - GH || this.y - BIRDHR < 0;
    }
};

function imgReady(img) { return img && img.complete && img.naturalWidth > 0; }

// ─── PIPES ───────────────────────────────────────────────────────
let pipes     = [];
let pipeTimer = 0;

function spawnPipe() {
    const minH = GH + 40;
    const maxH = canvas.height - GH - PIPEGAP - minH;
    const topH = minH + Math.random() * maxH;
    // moving pipes start appearing from tier 1 onward, ~40% chance
    const moving = currentTier >= 1 && Math.random() < 0.4;
    const vy = moving ? (1.2 + Math.random() * 1.6) * (Math.random() < 0.5 ? 1 : -1) : 0;
    pipes.push({ x: canvas.width + 10, topH, botY: topH + PIPEGAP, scored: false, vy });
}

function updatePipes() {
    if (++pipeTimer >= PIPE_INT) { spawnPipe(); pipeTimer = 0; }
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= PIPESPD;
        // vertical movement for moving pipes
        if (pipes[i].vy) {
            const minH = GH + 44, maxH = canvas.height - GH - PIPEGAP - 44;
            pipes[i].topH += pipes[i].vy;
            if (pipes[i].topH <= minH || pipes[i].topH >= maxH) pipes[i].vy = -pipes[i].vy;
            pipes[i].topH = Math.max(minH, Math.min(maxH, pipes[i].topH));
            pipes[i].botY = pipes[i].topH + PIPEGAP;
        }
        if (!pipes[i].scored && pipes[i].x + PIPEW < bird.x - BIRDHR) {
            pipes[i].scored = true;
            score++;
            scoreAnim = 18;
            plusOneY  = canvas.height * 0.14;
            plusOneT  = 20;
            // check tier change — randomise background, tint ground colour
            const newTierIdx = TIERS.reduce((acc,t,i)=> score>=t.min?i:acc, 0);
            if (newTierIdx !== currentTier) {
                currentTier = newTierIdx;
                currentBg   = Math.floor(Math.random() * TRAITS.backgrounds.length);
            }
        }
        if (pipes[i].x + PIPEW < -5) pipes.splice(i, 1);
    }
}

function hitsPipe() {
    for (const p of pipes) {
        if (bird.x + BIRDHR - 8 > p.x && bird.x - BIRDHR + 8 < p.x + PIPEW) {
            if (bird.y - BIRDHR + 8 < p.topH) return true;
            if (bird.y + BIRDHR - 8 > p.botY) return true;
        }
    }
    return false;
}

// ─── PIXEL TITLE ─────────────────────────────────────────────────
const TITLE_CHARS = [
    {c:'R',bg:'#F7C948'},{c:'3',bg:'#5BC236'},{c:'T',bg:'#7B52AB'},
    {c:'A',bg:'#4A90D9'},{c:'R',bg:'#E84393'},{c:'D',bg:'#00B4CC'},
    {c:'3',bg:'#F5821F'},{c:'D',bg:'#E84393'},
    null,
    {c:'B',bg:'#7B52AB'},{c:'I',bg:'#4A90D9'},
    {c:'R',bg:'#5BC236'},{c:'D',bg:'#F7C948'}
];

function drawPixelTitle(cx, cy, size, wave) {
    const bw   = size * 0.85;
    const bh   = size * 1.18;
    const gap  = size * 0.1;
    const spW  = size * 0.35;
    let totalW = 0;
    TITLE_CHARS.forEach(ch => { totalW += ch ? bw + gap : spW; });
    totalW -= gap;

    let x = cx - totalW / 2;
    ctx.font = `bold ${size}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    TITLE_CHARS.forEach((ch, i) => {
        if (!ch) { x += spW; return; }
        const yOff = wave ? Math.sin(frameCount * 0.06 + i * 0.45) * size * 0.18 : 0;
        const top  = cy - bh * 0.5 + yOff;

        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.roundRect(x+3, top+3, bw, bh * 0.88, size * 0.11);
        ctx.fill();

        // box
        ctx.fillStyle = ch.bg;
        ctx.beginPath();
        ctx.roundRect(x, top, bw, bh * 0.88, size * 0.11);
        ctx.fill();

        // shine
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.roundRect(x+2, top+2, bw-4, bh * 0.28, [size*0.11, size*0.11, 0, 0]);
        ctx.fill();

        // letter
        ctx.fillStyle = 'white';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 4;
        ctx.fillText(ch.c, x + bw/2, top + bh * 0.44);
        ctx.shadowBlur = 0;

        x += bw + gap;
    });
}

// ─── DRAW: MENU (portal level) ───────────────────────────────────
const PORTALS = [
    { yFrac:0.32, label:'▶  PLAY',      color:'#27ae60', glow:'#2ecc71', action:()=>startGame() },
    { yFrac:0.68, label:'🎨  CUSTOMIZE', color:'#8e44ad', glow:'#9b59b6', action:()=>{ state='CUSTOMIZER'; } },
];

let mBirdFlapTimer = 0;

function updateMenuBird() {
    // float in place — pure sine, no physics
    mBird.x = canvas.width  * 0.26;
    mBird.y = canvas.height * 0.5
            + Math.sin(frameCount * 0.055) * canvas.height * 0.038
            + (mBirdFlapTimer > 0 ? -Math.sin((mBirdFlapTimer/12)*Math.PI)*canvas.height*0.04 : 0);
    if (mBirdFlapTimer > 0) mBirdFlapTimer--;
}

function menuBtn(x, y, w, h, r, color, glowColor, _unused) {
    const hov   = mouseX > x && mouseX < x+w && mouseY > y && mouseY < y+h;
    const press = _pressX > x && _pressX < x+w && _pressY > y && _pressY < y+h;
    const breathe = (Math.sin(frameCount * 0.055) + 1) * 0.5;

    ctx.save();

    // outer glow / shadow
    ctx.shadowColor   = press ? 'rgba(0,0,0,0.65)' : glowColor;
    ctx.shadowBlur    = press ? 4 : hov ? 30 : 8 + breathe * 9;
    ctx.shadowOffsetY = press ? 1 : 3;

    // gradient fill
    const g = ctx.createLinearGradient(x, y, x, y + h);
    if (press) {
        g.addColorStop(0, _hexDarker(color, 0.15));
        g.addColorStop(1, _hexDarker(color, 0.38));
    } else {
        g.addColorStop(0, _hexBrighter(color, hov ? 0.28 : 0.18));
        g.addColorStop(0.55, color);
        g.addColorStop(1, _hexDarker(color, hov ? 0.32 : 0.22));
    }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();

    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // top shine
    const shineOff = press ? h * 0.1 : 2;
    const sg = ctx.createLinearGradient(x, y + shineOff, x, y + h * 0.5);
    sg.addColorStop(0, `rgba(255,255,255,${press ? 0.06 : hov ? 0.28 : 0.20})`);
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.roundRect(x+2, y+shineOff, w-4, h*0.46, [r,r,0,0]); ctx.fill();

    // bottom dark lip
    ctx.fillStyle = `rgba(0,0,0,${press ? 0.12 : 0.30})`;
    ctx.beginPath(); ctx.roundRect(x+3, y+h-5, w-6, 5, [0,0,r,r]); ctx.fill();

    // border
    ctx.strokeStyle = hov || press ? glowColor : 'rgba(255,255,255,0.14)';
    ctx.lineWidth   = hov ? 2.5 : 1.5;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke();

    ctx.restore();
}

// Draws the live game world (selected bg + demo pipes + ground + flying bird)
// then applies a dark overlay+vignette so UI drawn on top stays readable.
// overlayAlpha: 0.54 for menu (lighter), 0.72 for customizer (heavier)
function drawDemoWorld(overlayAlpha) {
    const W = canvas.width, H = canvas.height;
    drawBackground(); // uses sel.backgrounds — updates live as user picks a bg

    const t0 = TIERS[0];
    for (const p of demo.pipes) {
        ctx.fillStyle = t0.pc;
        ctx.fillRect(p.x, 0, PIPEW, p.topH - 22);
        ctx.fillStyle = t0.pd;
        ctx.fillRect(p.x - 7, p.topH - 22, PIPEW + 14, 22);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(p.x + 6, 0, 12, p.topH - 22);

        ctx.fillStyle = t0.pc;
        ctx.fillRect(p.x, p.topH + PIPEGAP + 22, PIPEW, H);
        ctx.fillStyle = t0.pd;
        ctx.fillRect(p.x - 7, p.topH + PIPEGAP, PIPEW + 14, 22);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(p.x + 6, p.topH + PIPEGAP + 22, 12, H);
    }

    drawGround(true); // always normal green in demo

    const dRot = Math.max(-22, Math.min(70, demo.bird.vy / GRAVITY_V * 2.8));
    bird.draw(BIRDX, demo.bird.y, dRot, false, null);

    ctx.fillStyle = `rgba(0,0,0,${overlayAlpha})`;
    ctx.fillRect(0, 0, W, H);
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.16, W / 2, H / 2, H * 0.86);
    vig.addColorStop(0, 'rgba(0,0,0,0.05)');
    vig.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
}

function drawMenu() {
    const W = canvas.width, H = canvas.height;
    menuTimer++;
    demo.update();
    drawDemoWorld(0.52);

    // ── pixel title ──
    const ts = Math.min(Math.round(W * 0.038), 32);
    drawPixelTitle(W / 2, H * 0.2, ts, true);

    // ── centered buttons ──
    const bw   = Math.min(W * 0.52, 340);
    const bh   = Math.min(Math.round(H * 0.1), 64);
    const bx   = W / 2 - bw / 2;
    const gap  = Math.round(H * 0.018);
    const by1  = H * 0.35, by2 = by1 + bh + gap, by3 = by2 + bh + gap;

    const hovPlay = mouseX > bx && mouseX < bx + bw && mouseY > by1 && mouseY < by1 + bh;
    const hovCust = mouseX > bx && mouseX < bx + bw && mouseY > by2 && mouseY < by2 + bh;
    const hovLb   = mouseX > bx && mouseX < bx + bw && mouseY > by3 && mouseY < by3 + bh;

    menuBtn(bx, by1, bw, bh, 14, '#1e8449', '#2ecc71', hovPlay);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(H * 0.032)}px Arial`;
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 5;
    ctx.fillText('▶  PLAY', W / 2, by1 + bh / 2);
    ctx.shadowBlur = 0;
    UI.menuPlay = { x: bx, y: by1, w: bw, h: bh };

    menuBtn(bx, by2, bw, bh, 14, '#5b2c8d', '#9b59b6', hovCust);
    ctx.font = `bold ${Math.round(H * 0.028)}px Arial`;
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 5;
    ctx.fillText('🎨  Customize Your R3tard', W / 2, by2 + bh / 2);
    ctx.shadowBlur = 0;
    UI.menuCustomize = { x: bx, y: by2, w: bw, h: bh };

    menuBtn(bx, by3, bw, bh, 14, '#0d3b5e', '#1a7abf', hovLb);
    ctx.font = `bold ${Math.round(H * 0.028)}px Arial`;
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 5;
    ctx.fillText('🏆  LEADERBOARD', W / 2, by3 + bh / 2);
    ctx.shadowBlur = 0;
    UI.menuLb = { x: bx, y: by3, w: bw, h: bh };

    // best score
    const lbY0 = by3 + bh + Math.round(H * 0.022);
    if (best > 0) {
        ctx.font = `bold ${Math.round(H * 0.02)}px Arial`;
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`🏆  Best: ${best}`, W / 2, lbY0);
    }

    // leaderboard panel (always shown)
    const show   = Math.min(lbData.length, 5);
    const rowH2  = Math.round(H * 0.034);
    const panW   = Math.min(W * 0.72, 400);
    const panH   = rowH2 * Math.max(show, 1) + rowH2 + 12;
    const panX   = W / 2 - panW / 2;
    const panY   = lbY0 + Math.round(H * 0.028);
    rr(panX, panY, panW, panH, 14, 'rgba(0,0,20,0.75)', 'rgba(120,80,220,0.6)', 1.5);

    ctx.font = `bold ${Math.round(H * 0.018)}px Arial`;
    ctx.fillStyle = 'rgba(210,170,255,0.95)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('LEADERBOARD', W / 2, panY + rowH2 * 0.62);

    if (show === 0) {
        ctx.font = `${Math.round(H * 0.016)}px Arial`;
        ctx.fillStyle = 'rgba(180,180,180,0.6)';
        ctx.fillText('No scores yet — play to get on the board!', W / 2, panY + rowH2 * 1.5);
    } else {
        const medals = ['🥇','🥈','🥉'];
        for (let i = 0; i < show; i++) {
            const ey = panY + rowH2 * (i + 1) + 10;
            const entry = lbData[i];
            const medal = medals[i] || `${i+1}.`;
            ctx.font = `bold ${Math.round(H * 0.017)}px Arial`;
            ctx.textAlign = 'left'; ctx.fillStyle = i === 0 ? '#FFD700' : '#ddd';
            ctx.fillText(`${medal} ${entry.nickname}`, panX + 16, ey + rowH2 / 2);
            ctx.textAlign = 'right'; ctx.fillStyle = i === 0 ? '#FFD700' : '#bbb';
            ctx.fillText(entry.score, panX + panW - 16, ey + rowH2 / 2);
        }
    }
    ctx.textAlign = 'center';
}

// ─── DRAW: GAME ELEMENTS ─────────────────────────────────────────
// bgIdx: which background index to draw (defaults to sel.backgrounds for menu/customizer)
function drawBackground(bgIdx) {
    const idx   = bgIdx !== undefined ? bgIdx : sel.backgrounds;
    const bgImg = IMG.backgrounds[TRAITS.backgrounds[idx]];
    if (imgReady(bgImg)) {
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height - GH);
    } else {
        const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
        g.addColorStop(0, '#1a1a2e'); g.addColorStop(1, '#16213e');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // stars + parallax city layers
    _drawStars();
    _drawCityLayer(_cityFar,  'rgba(0,0,18,0.52)',  PIPESPD * 0.13);
    _drawCityLayer(_cityNear, 'rgba(0,0,10,0.70)', PIPESPD * 0.26);
    // world tier tint overlay (only applies in-game; 0 tint on tier 0)
    const t = getTier();
    if (t.tint) {
        ctx.fillStyle = t.tint;
        ctx.fillRect(0, 0, canvas.width, canvas.height - GH);
    }
}

function getTier() {
    for (let i=TIERS.length-1;i>=0;i--) if (score>=TIERS[i].min) return TIERS[i];
    return TIERS[0];
}

function drawPipes() {
    const t = getTier();
    for (const p of pipes) {
        // ── top pipe ──────────────────────────────────────────────
        ctx.fillStyle = t.pc;
        ctx.fillRect(p.x, 0, PIPEW, p.topH - 22);
        // gradient L→R for depth
        const pg1 = ctx.createLinearGradient(p.x, 0, p.x + PIPEW, 0);
        pg1.addColorStop(0,   'rgba(255,255,255,0.13)');
        pg1.addColorStop(0.3, 'rgba(255,255,255,0)');
        pg1.addColorStop(0.8, 'rgba(0,0,0,0)');
        pg1.addColorStop(1,   'rgba(0,0,0,0.22)');
        ctx.fillStyle = pg1;
        ctx.fillRect(p.x, 0, PIPEW, p.topH - 22);
        // bright left-edge highlight
        ctx.fillStyle = 'rgba(255,255,255,0.20)';
        ctx.fillRect(p.x + 3, 0, 5, p.topH - 22);

        // cap top
        ctx.fillStyle = t.pd;
        ctx.fillRect(p.x - 7, p.topH - 22, PIPEW + 14, 22);
        const cg1 = ctx.createLinearGradient(p.x-7, p.topH-22, p.x-7, p.topH);
        cg1.addColorStop(0, 'rgba(255,255,255,0.18)');
        cg1.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.fillStyle = cg1;
        ctx.fillRect(p.x - 7, p.topH - 22, PIPEW + 14, 22);

        // ── bottom pipe ───────────────────────────────────────────
        ctx.fillStyle = t.pc;
        ctx.fillRect(p.x, p.botY + 22, PIPEW, canvas.height);
        const pg2 = ctx.createLinearGradient(p.x, 0, p.x + PIPEW, 0);
        pg2.addColorStop(0,   'rgba(255,255,255,0.13)');
        pg2.addColorStop(0.3, 'rgba(255,255,255,0)');
        pg2.addColorStop(0.8, 'rgba(0,0,0,0)');
        pg2.addColorStop(1,   'rgba(0,0,0,0.22)');
        ctx.fillStyle = pg2;
        ctx.fillRect(p.x, p.botY + 22, PIPEW, canvas.height);
        ctx.fillStyle = 'rgba(255,255,255,0.20)';
        ctx.fillRect(p.x + 3, p.botY + 22, 5, canvas.height);

        // cap bottom
        ctx.fillStyle = t.pd;
        ctx.fillRect(p.x - 7, p.botY, PIPEW + 14, 22);
        const cg2 = ctx.createLinearGradient(p.x-7, p.botY, p.x-7, p.botY+22);
        cg2.addColorStop(0, 'rgba(255,255,255,0.18)');
        cg2.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.fillStyle = cg2;
        ctx.fillRect(p.x - 7, p.botY, PIPEW + 14, 22);

        // moving pipe indicator
        if (p.vy) {
            const arrow = p.vy > 0 ? '▼' : '▲';
            ctx.font = `bold ${Math.round(PIPEW * 0.5)}px Arial`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText(arrow, p.x + PIPEW / 2, p.topH - 11);
            ctx.fillText(arrow, p.x + PIPEW / 2, p.botY + 11);
        }
    }
}

function drawGround(forceNormal) {
    const t   = forceNormal ? TIERS[0] : getTier();
    const off = (frameCount * PIPESPD) % 44;
    ctx.fillStyle = t.gd;
    ctx.fillRect(0, canvas.height - GH, canvas.width, GH);
    ctx.fillStyle = t.gc;
    ctx.fillRect(0, canvas.height - GH, canvas.width, 18);
    ctx.fillStyle = t.gc2;
    for (let gx = -off; gx < canvas.width + 44; gx += 44) {
        ctx.beginPath(); ctx.arc(gx+10, canvas.height-GH, 9, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.arc(gx+28, canvas.height-GH, 7, Math.PI, 0); ctx.fill();
    }
}

function drawScore() {
    const base = Math.round(canvas.height * 0.084);
    const scale = scoreAnim > 0 ? 1 + 0.4*(scoreAnim/18) : 1;
    if (scoreAnim > 0) scoreAnim--;
    const fs = Math.round(base * scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `bold ${fs}px Arial`;
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 7;
    ctx.fillText(score, canvas.width/2, canvas.height*0.14);
    ctx.shadowBlur = 0;
    // floating +1
    if (plusOneT > 0) {
        plusOneT--;
        ctx.globalAlpha = plusOneT/20;
        ctx.font=`bold ${Math.round(base*0.55)}px Arial`;
        ctx.fillStyle='#FFD700';
        ctx.fillText('+1', canvas.width/2 + base*0.8, plusOneY - (20-plusOneT)*1.4);
        ctx.globalAlpha=1;
    }
}

// ─── DRAW: CUSTOMIZER ────────────────────────────────────────────
const UI = {};

function rr(x, y, w, h, r, fill, stroke, lw) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill)   { ctx.fillStyle   = fill;    ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke;  ctx.lineWidth = lw||2; ctx.stroke(); }
}

function drawCustomizer() {
    demo.update();
    drawDemoWorld(0.68);

    const W = canvas.width, H = canvas.height, cx = W/2;

    // ── title ──
    const ts = Math.min(Math.round(W*0.028), 22);
    drawPixelTitle(cx, H*0.032, ts, false);

    // ── preview panel ──
    const pSz = Math.min(Math.round(W*0.52), Math.round(H*0.4));
    const pX  = cx - pSz/2, pY = Math.round(H*0.06);

    // animated rainbow border
    const hue = (frameCount * 1.2) % 360;
    ctx.save();
    ctx.shadowColor = `hsl(${hue},80%,60%)`;
    ctx.shadowBlur  = 22;
    ctx.strokeStyle = `hsl(${hue},80%,60%)`;
    ctx.lineWidth   = 3;
    ctx.beginPath(); ctx.roundRect(pX-1, pY-1, pSz+2, pSz+2, 20); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath(); ctx.roundRect(pX, pY, pSz, pSz, 18); ctx.clip();
    const bgImg = IMG.backgrounds[TRAITS.backgrounds[sel.backgrounds]];
    if (imgReady(bgImg)) ctx.drawImage(bgImg, pX, pY, pSz, pSz);
    else { ctx.fillStyle='#1a1a2e'; ctx.fillRect(pX, pY, pSz, pSz); }
    const eyeImg = IMG.eyes[TRAITS.eyes[sel.eyes]];
    if (imgReady(eyeImg)) ctx.drawImage(eyeImg, pX, pY, pSz, pSz);
    const mouthImg = IMG.mouth[TRAITS.mouth[sel.mouth]];
    if (imgReady(mouthImg)) ctx.drawImage(mouthImg, pX, pY, pSz, pSz);
    ctx.restore();

    // ── trait rows ──
    const selY0 = pY + pSz + Math.round(H*0.022);
    const rowH  = Math.round(H*0.088);
    const AW    = Math.min(Math.round(rowH*0.95), 58); // fixed-size arrows, not screen-fraction
    const AH    = Math.round(rowH*0.72);
    const pad   = Math.round(W*0.032);
    const fs    = Math.round(H*0.024);

    CATS.forEach((cat, i) => {
        const ry = selY0 + i*rowH;

        const accent = ['#9b59b6','#3498db','#e74c3c'][i];
        // row bg
        rr(pad, ry, W-pad*2, rowH-6, 10, '#0e0e1c', null);

        // small label top-left (inside row, outside arrow zone)
        const labelX = pad + AW + 18;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.font = `bold ${Math.round(H*0.014)}px Arial`;
        ctx.fillStyle = accent;
        ctx.fillText(CAT_LABELS[cat], labelX, ry + rowH*0.3);

        // trait name centered (bright, bold)
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `bold ${fs}px Arial`;
        ctx.fillStyle = 'white';
        ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=4;
        ctx.fillText(TRAITS[cat][sel[cat]], cx, ry+rowH/2+2);
        ctx.shadowBlur=0;

        // left arrow button
        const lx=pad+6, ly=ry+Math.round((rowH-AH)/2);
        const hovL = mouseX>lx&&mouseX<lx+AW&&mouseY>ly&&mouseY<ly+AH;
        rr(lx, ly, AW, AH, 8, hovL?'#2a2a42':'#181828', accent, 1.5);
        ctx.font=`${Math.round(H*0.03)}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle = hovL ? 'white' : '#bbb';
        ctx.fillText('◀', lx+AW/2, ly+AH/2);
        UI[`${cat}_prev`] = {x:lx,y:ly,w:AW,h:AH};

        // right arrow button (explicit fillStyle reset after rr changes it)
        const rx2=W-pad-AW-6, ry2=ly;
        const hovR = mouseX>rx2&&mouseX<rx2+AW&&mouseY>ry2&&mouseY<ry2+AH;
        rr(rx2, ry2, AW, AH, 8, hovR?'#2a2a42':'#181828', accent, 1.5);
        ctx.fillStyle = hovR ? 'white' : '#bbb'; // must reset after rr
        ctx.font=`${Math.round(H*0.03)}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('▶', rx2+AW/2, ry2+AH/2);
        UI[`${cat}_next`] = {x:rx2,y:ry2,w:AW,h:AH};
    });

    // ── action buttons ──
    const btnY = selY0 + CATS.length*rowH + Math.round(H*0.018);
    const btnH = Math.round(H*0.08);
    const btnW = Math.round((W-pad*3)/2);
    const bfs  = Math.round(H*0.024);

    const hovRand = mouseX>pad&&mouseX<pad+btnW&&mouseY>btnY&&mouseY<btnY+btnH;
    menuBtn(pad, btnY, btnW, btnH, 12, '#2c2c4a', '#9b59b6', hovRand);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font=`bold ${bfs}px Arial`; ctx.fillStyle='white';
    ctx.fillText('⚡  RANDOM', pad+btnW/2, btnY+btnH/2);
    UI.random = {x:pad,y:btnY,w:btnW,h:btnH};

    const playX = pad*2+btnW;
    const hovPlay2 = mouseX>playX&&mouseX<playX+btnW&&mouseY>btnY&&mouseY<btnY+btnH;
    menuBtn(playX, btnY, btnW, btnH, 12, '#1e8449', '#2ecc71', hovPlay2);
    ctx.fillStyle='white'; ctx.font=`bold ${bfs}px Arial`;
    ctx.fillText('▶  PLAY', playX+btnW/2, btnY+btnH/2);
    UI.play = {x:playX,y:btnY,w:btnW,h:btnH};

    if (best > 0) {
        ctx.font=`bold ${Math.round(H*0.02)}px Arial`; ctx.fillStyle='#FFD700';
        ctx.fillText(`🏆  Best: ${best}`, cx, btnY+btnH+Math.round(H*0.04));
    }
}

// ─── DRAW: DYING ─────────────────────────────────────────────────
function drawDying() {
    dyingTimer++;
    // bird continues to fall visually
    bird.vy = Math.min(bird.vy + GRAVITY_V*0.6, canvas.height*0.015);
    bird.y += bird.vy;
    drawBackground();
    drawPipes();
    drawGround();
    bird.draw(null, null, Math.min(bird.rot+3,90), false, null);

    // phase 1 (0-22): CSS glitch on canvas element
    if (dyingTimer <= 22) {
        const sx = (Math.random()-0.5)*10;
        const sy = (Math.random()-0.5)*5;
        canvas.style.transform = `translate(${sx}px,${sy}px)`;
        canvas.style.filter = `saturate(4) hue-rotate(${Math.floor(Math.random()*3)*120}deg) contrast(1.6)`;
        // scanlines
        ctx.fillStyle='rgba(0,0,0,0.18)';
        for (let y=0;y<canvas.height;y+=3) ctx.fillRect(0,y,canvas.width,1.5);
    } else {
        canvas.style.transform='';
        canvas.style.filter='';
    }

    // phase 2 (18-50): crack lines
    if (dyingTimer > 18) {
        const prog = Math.min((dyingTimer-18)/28, 1);
        cracks.forEach((pts, ci) => {
            if (ci/cracks.length > prog) return;
            const visLen = Math.floor((pts.length-1)*Math.min((dyingTimer-18-ci*1.5)/12,1));
            if (visLen < 1) return;
            ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
            for (let p=1;p<=visLen;p++) ctx.lineTo(pts[p].x, pts[p].y);
            ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=4; ctx.stroke();
            ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=1.5; ctx.stroke();
        });
    }

    // phase 3 (45-65): fade to black
    if (dyingTimer > 45) {
        ctx.fillStyle=`rgba(0,0,0,${Math.min((dyingTimer-45)/20,1)})`;
        ctx.fillRect(0,0,canvas.width,canvas.height);
    }

    if (dyingTimer >= 65) {
        canvas.style.transform='';
        canvas.style.filter='';
        deadTimer=0;
        if (!lbSavedNick() && score > 0) {
            nicknameInput = '';
            state = 'NICKNAME';
            _nickShow();
        } else {
            state = 'DEAD';
        }
    }
}

// ─── DRAW: GAME OVER ─────────────────────────────────────────────
function drawDead() {
    deadTimer++;
    const W = canvas.width, H = canvas.height, cx = W / 2;

    // dark red overlay
    const overlayA = easeOut(deadTimer, 20) * 0.68;
    ctx.fillStyle = `rgba(10,0,0,${overlayA})`;
    ctx.fillRect(0, 0, W, H);

    // panel — slightly taller so buttons never crowd stats
    const panelW = Math.min(Math.round(W * 0.78), 440);
    const panelH = Math.round(H * 0.68);
    const panelX = cx - panelW / 2;
    const slideP = easeOutBack(deadTimer, 28);
    const panelY = H * 0.14 + (1 - Math.min(slideP, 1)) * (-H * 0.45);

    // red glow behind panel
    ctx.save();
    ctx.shadowColor = `rgba(220,0,0,${easeOut(deadTimer, 25) * 0.6})`;
    ctx.shadowBlur  = 70;
    ctx.fillStyle   = 'rgba(0,0,0,0.01)';
    ctx.fillRect(panelX + 20, panelY + 20, panelW - 40, panelH - 40);
    ctx.restore();

    // panel body
    rr(panelX, panelY, panelW, panelH, 22, '#0d0d1e', null);
    const tg = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY);
    tg.addColorStop(0, 'rgba(192,57,43,0)'); tg.addColorStop(0.5, 'rgba(192,57,43,0.9)'); tg.addColorStop(1, 'rgba(192,57,43,0)');
    ctx.fillStyle = tg; ctx.fillRect(panelX, panelY, panelW, 2);

    const textA = easeOut(Math.max(deadTimer - 6, 0), 16);
    ctx.globalAlpha = Math.min(textA, 1);

    // character face above panel
    const faceR = Math.min(Math.round(H * 0.075), 62);
    const faceY = panelY - faceR * 0.3;
    const fg = ctx.createRadialGradient(cx, faceY, 0, cx, faceY, faceR * 2);
    fg.addColorStop(0, 'rgba(192,57,43,0.35)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(cx, faceY, faceR * 2, 0, Math.PI * 2); ctx.fill();
    bird.draw(cx, faceY, 0, true, faceR);
    ctx.save(); ctx.translate(cx, faceY);
    ctx.beginPath(); ctx.arc(0, 0, faceR + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();

    // YOU DIED
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const titleFS = Math.min(Math.round(H * 0.068), 58);
    ctx.font = `900 ${titleFS}px Arial`;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = titleFS * 0.1;
    ctx.strokeText('YOU DIED', cx, panelY + panelH * 0.23);
    ctx.fillStyle = '#e74c3c'; ctx.fillText('YOU DIED', cx, panelY + panelH * 0.23);

    // R3TARD
    const subFS = Math.min(Math.round(H * 0.036), 30);
    ctx.font = `bold ${subFS}px 'Press Start 2P', monospace`;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = subFS * 0.12;
    ctx.strokeText('R3TARD', cx, panelY + panelH * 0.35);
    ctx.fillStyle = '#FFD700'; ctx.fillText('R3TARD', cx, panelY + panelH * 0.35);

    // divider
    const dg = ctx.createLinearGradient(panelX + panelW * 0.08, 0, panelX + panelW * 0.92, 0);
    dg.addColorStop(0, 'rgba(255,255,255,0)'); dg.addColorStop(0.5, 'rgba(255,255,255,0.2)'); dg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = dg; ctx.fillRect(panelX + panelW * 0.08, panelY + panelH * 0.44, panelW * 0.84, 1);

    // stats — two columns, well above buttons
    const statFS = Math.min(Math.round(H * 0.028), 23);
    const col1x  = panelX + panelW * 0.28;
    const col2x  = panelX + panelW * 0.65;
    const row1y  = panelY + panelH * 0.48;
    const row2y  = panelY + panelH * 0.58;

    ctx.font = `${statFS}px Arial`; ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'left';
    ctx.fillText('Score', col1x, row1y);
    ctx.fillText('Best',  col1x, row2y);

    ctx.font = `bold ${Math.round(statFS * 1.25)}px Arial`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'white';   ctx.fillText(score, col2x, row1y);
    ctx.fillStyle = '#FFD700'; ctx.fillText(
        score > 0 && score >= best ? `${best} 🏆` : best,
        col2x, row2y
    );

    // buttons (side-by-side) — appear after short delay
    const btnA = easeOut(Math.max(deadTimer - 26, 0), 16);
    ctx.globalAlpha = Math.min(btnA, 1);

    const bh    = Math.round(panelH * 0.10);
    const bpad  = panelW * 0.05;
    const bgap  = Math.round(panelW * 0.04);
    const btot  = panelW - bpad * 2;
    const bwEa  = (btot - bgap) / 2;
    const bxL   = panelX + bpad;
    const bxR   = bxL + bwEa + bgap;
    const bby   = panelY + panelH * 0.68;

    // Play Again (green, left)
    menuBtn(bxL, bby, bwEa, bh, 12, '#1e8449', '#2ecc71',
        mouseX > bxL && mouseX < bxL + bwEa && mouseY > bby && mouseY < bby + bh);
    ctx.font = `bold ${Math.min(Math.round(H * 0.024), 20)}px Arial`;
    ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 4;
    ctx.fillText('▶ Play Again', bxL + bwEa / 2, bby + bh / 2);
    ctx.shadowBlur = 0;
    UI.restart = { x: bxL, y: bby, w: bwEa, h: bh };

    // Change Character (purple, right)
    menuBtn(bxR, bby, bwEa, bh, 12, '#5b2c8d', '#9b59b6',
        mouseX > bxR && mouseX < bxR + bwEa && mouseY > bby && mouseY < bby + bh);
    ctx.font = `bold ${Math.min(Math.round(H * 0.022), 18)}px Arial`;
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 4;
    ctx.fillText('Change Your', bxR + bwEa / 2, bby + bh * 0.38);
    ctx.fillText('R3tard', bxR + bwEa / 2, bby + bh * 0.72);
    ctx.shadowBlur = 0;
    UI.customize = { x: bxR, y: bby, w: bwEa, h: bh };

    // Back to Main Menu (navy, full-width, second row)
    const bby2    = bby + bh + Math.round(H * 0.013);
    menuBtn(bxL, bby2, btot, bh, 12, '#0d3b5e', '#1a7abf',
        mouseX > bxL && mouseX < bxL + btot && mouseY > bby2 && mouseY < bby2 + bh);
    ctx.font = `bold ${Math.min(Math.round(H * 0.022), 18)}px Arial`;
    ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 4;
    ctx.fillText('← Main Menu', cx, bby2 + bh / 2);
    ctx.shadowBlur = 0;
    UI.backMenu = { x: bxL, y: bby2, w: btot, h: bh };

    ctx.globalAlpha = 1;
}

// ─── DRAW: NICKNAME ENTRY ────────────────────────────────────────
function drawNickname() {
    const W = canvas.width, H = canvas.height, cx = W/2;

    // dark overlay over whatever is behind
    ctx.fillStyle = 'rgba(0,0,0,0.84)';
    ctx.fillRect(0, 0, W, H);

    const pw = Math.min(W * 0.72, 460);
    const ph = Math.round(H * 0.38);
    const px = cx - pw/2, py = H * 0.31;

    // panel
    rr(px, py, pw, ph, 20, '#0d0d1e', null);
    const tg2 = ctx.createLinearGradient(px, py, px+pw, py);
    tg2.addColorStop(0,'rgba(155,89,182,0)'); tg2.addColorStop(0.5,'rgba(155,89,182,0.9)'); tg2.addColorStop(1,'rgba(155,89,182,0)');
    ctx.fillStyle=tg2; ctx.fillRect(px, py, pw, 2);

    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font=`bold ${Math.round(H*0.036)}px Arial`;
    ctx.fillStyle='white';
    ctx.fillText('ENTER YOUR NAME', cx, py + ph*0.2);

    // input box
    const iw = pw*0.82, ih = Math.round(H*0.072);
    const ix = cx - iw/2, iy = py + ph*0.38;
    rr(ix, iy, iw, ih, 12, '#17172a', '#9b59b6', 2.5);
    const cursor = Math.floor(Date.now()/520)%2 ? '|' : '';
    ctx.font=`${Math.round(H*0.034)}px 'Press Start 2P', monospace`;
    ctx.fillStyle='white';
    ctx.fillText((nicknameInput || '') + cursor, cx, iy + ih/2);

    ctx.font=`${Math.round(H*0.017)}px Arial`;
    ctx.fillStyle='rgba(255,255,255,0.45)';
    ctx.fillText('type your name  ·  max 16 chars', cx, py + ph*0.66);

    // buttons
    const bh2 = Math.round(ph*0.16);
    const bw2 = pw*0.36;
    const by2 = py + ph*0.78;
    const bxSkip = cx - bw2 - 10, bxSave = cx + 10;

    const hovSkip = mouseX>bxSkip&&mouseX<bxSkip+bw2&&mouseY>by2&&mouseY<by2+bh2;
    menuBtn(bxSkip, by2, bw2, bh2, 10, '#222240', '#666699', hovSkip);
    ctx.fillStyle=hovSkip?'white':'rgba(255,255,255,0.6)'; ctx.font=`bold ${Math.round(H*0.022)}px Arial`;
    ctx.fillText('SKIP', bxSkip+bw2/2, by2+bh2/2);
    UI.nickSkip = {x:bxSkip, y:by2, w:bw2, h:bh2};

    const hovSave = mouseX>bxSave&&mouseX<bxSave+bw2&&mouseY>by2&&mouseY<by2+bh2;
    menuBtn(bxSave, by2, bw2, bh2, 10, '#5b2c8d', '#9b59b6', hovSave);
    ctx.fillStyle='white';
    ctx.fillText('SAVE ↵', bxSave+bw2/2, by2+bh2/2);
    UI.nickSave = {x:bxSave, y:by2, w:bw2, h:bh2};
}

// ─── DRAW: LEADERBOARD OVERLAY ───────────────────────────────────
function drawLeaderboard() {
    const W = canvas.width, H = canvas.height, cx = W / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, 0, W, H);

    const pw = Math.min(W * 0.82, 480);
    const show = Math.min(lbData.length, 10);
    const rowH3 = Math.round(H * 0.054);
    const cbh = Math.round(H * 0.065);
    const ph = rowH3 * (show + 2) + cbh + 44;
    const px = cx - pw / 2;
    const py = Math.max((H - ph) / 2, 20);

    rr(px, py, pw, ph, 22, '#0d0d1e', 'rgba(155,89,182,0.7)', 2);

    // gradient top bar
    const tg = ctx.createLinearGradient(px, py, px + pw, py);
    tg.addColorStop(0, 'rgba(155,89,182,0)');
    tg.addColorStop(0.5, 'rgba(155,89,182,0.9)');
    tg.addColorStop(1, 'rgba(155,89,182,0)');
    ctx.fillStyle = tg; ctx.fillRect(px, py, pw, 2);

    // title
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(H * 0.038)}px Arial`;
    ctx.fillStyle = 'white';
    ctx.fillText('🏆  LEADERBOARD', cx, py + rowH3 * 0.8);

    // divider
    const dg = ctx.createLinearGradient(px + pw * 0.06, 0, px + pw * 0.94, 0);
    dg.addColorStop(0, 'rgba(255,255,255,0)'); dg.addColorStop(0.5, 'rgba(255,255,255,0.25)'); dg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = dg; ctx.fillRect(px + pw * 0.06, py + rowH3 * 1.3, pw * 0.88, 1);

    if (show === 0) {
        ctx.font = `${Math.round(H * 0.022)}px Arial`;
        ctx.fillStyle = 'rgba(200,200,200,0.5)';
        ctx.fillText('No scores yet — be the first!', cx, py + rowH3 * 2.5);
    } else {
        const medals = ['🥇', '🥈', '🥉'];
        for (let i = 0; i < show; i++) {
            const ey = py + rowH3 * (i + 1.5) + 14;
            const entry = lbData[i];
            const isMe = lbSavedNick() === entry.nickname;
            ctx.font = `bold ${Math.round(H * 0.028)}px Arial`;
            ctx.fillStyle = i === 0 ? '#FFD700' : isMe ? '#7ecfff' : 'rgba(230,230,230,0.9)';
            ctx.textAlign = 'left';
            ctx.fillText(`${medals[i] || (i + 1) + '.'} ${entry.nickname}${isMe ? ' ◀ you' : ''}`, px + 22, ey);
            ctx.textAlign = 'right';
            ctx.fillStyle = i === 0 ? '#FFD700' : '#bbb';
            ctx.fillText(entry.score, px + pw - 22, ey);
        }
    }

    // close button
    const cbw = Math.min(pw * 0.5, 200);
    const cbx = cx - cbw / 2, cby = py + ph - cbh - 16;
    const hovClose = mouseX > cbx && mouseX < cbx + cbw && mouseY > cby && mouseY < cby + cbh;
    menuBtn(cbx, cby, cbw, cbh, 12, '#222240', '#666699', hovClose);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(H * 0.025)}px Arial`;
    ctx.fillStyle = hovClose ? 'white' : 'rgba(255,255,255,0.75)';
    ctx.fillText('✕  CLOSE', cx, cby + cbh / 2);
    UI.lbClose = { x: cbx, y: cby, w: cbw, h: cbh };
}

// ─── HIT TEST ────────────────────────────────────────────────────
function hits(key, x, y) {
    const e = UI[key];
    return e && x >= e.x && x <= e.x+e.w && y >= e.y && y <= e.y+e.h;
}

// ─── INPUT ───────────────────────────────────────────────────────
function canvasXY(e) {
    const r  = canvas.getBoundingClientRect();
    const sx = canvas.width  / r.width;
    const sy = canvas.height / r.height;
    const s  = e.touches ? e.touches[0] : e;
    return { x: (s.clientX-r.left)*sx, y: (s.clientY-r.top)*sy };
}

function handleInput(e) {
    const {x,y} = canvasXY(e);

    if (state === 'MENU') {
        if (hits('menuPlay',      x, y)) { startGame();                                     return; }
        if (hits('menuCustomize', x, y)) { state = 'CUSTOMIZER';                            return; }
        if (hits('menuLb',        x, y)) { lbFetch(); state = 'LEADERBOARD';                return; }
        demo.bird.vy = FLAP_V;
        return;
    }

    if (state === 'LEADERBOARD') {
        if (hits('lbClose', x, y)) { state = 'MENU'; return; }
        return;
    }

    if (state === 'CUSTOMIZER') {
        for (const cat of CATS) {
            const n = TRAITS[cat].length;
            if (hits(`${cat}_prev`, x, y)) { sel[cat]=(sel[cat]-1+n)%n; return; }
            if (hits(`${cat}_next`, x, y)) { sel[cat]=(sel[cat]+1)%n;   return; }
        }
        if (hits('random', x, y)) {
            sel.backgrounds = Math.floor(Math.random()*TRAITS.backgrounds.length);
            sel.eyes        = EYES_RANDOM[Math.floor(Math.random()*EYES_RANDOM.length)];
            sel.mouth       = Math.floor(Math.random()*TRAITS.mouth.length);
            return;
        }
        if (hits('play', x, y)) startGame();
        return;
    }

    if (state === 'PLAYING') { bird.flap(); return; }

    if (state === 'DEAD') {
        if (hits('restart',   x, y)) { startGame(); return; }
        if (hits('customize', x, y)) { state = 'CUSTOMIZER'; return; }
        if (hits('backMenu',  x, y)) { state = 'MENU'; return; }
    }

    if (state === 'NICKNAME') {
        if (hits('nickSkip', x, y)) { _nickSkipFn();  return; }
        if (hits('nickSave', x, y)) { _nickCommit();  return; }
        // Tap anywhere else → focus the hidden input (shows mobile keyboard)
        _nickEl && _nickEl.focus();
        return;
    }
}

function handleKey(e) {
    // NICKNAME keyboard is handled by _nickEl's own keydown listener.
    // This block is a desktop fallback when the hidden input isn't focused.
    if (state === 'NICKNAME') {
        if (e.key === 'Enter')     { e.preventDefault(); _nickCommit();  return; }
        if (e.key === 'Escape')    { e.preventDefault(); _nickSkipFn();  return; }
        if (e.key === 'Backspace') { e.preventDefault(); nicknameInput = nicknameInput.slice(0,-1); return; }
        if (e.key.length === 1 && nicknameInput.length < 20) { nicknameInput += e.key; }
        return;
    }

    if (state === 'LEADERBOARD') {
        if (e.key === 'Escape') { state = 'MENU'; return; }
        return;
    }

    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (state === 'MENU')        { demo.bird.vy = FLAP_V; return; }
        if (state === 'PLAYING')     { bird.flap(); return; }
        if (state === 'DEAD')        { startGame(); return; }
        if (state === 'CUSTOMIZER' && e.code === 'Space') startGame();
    }
}

canvas.addEventListener('click',      handleInput);
canvas.addEventListener('touchstart', e => { e.preventDefault(); const p=canvasXY(e); _pressX=p.x; _pressY=p.y; handleInput(e); }, {passive:false});
canvas.addEventListener('touchend',   () => { _pressX=-999; _pressY=-999; });
canvas.addEventListener('mousedown',  e => { const p=canvasXY(e); _pressX=p.x; _pressY=p.y; });
canvas.addEventListener('mouseup',    () => { _pressX=-999; _pressY=-999; });
document.addEventListener('keydown',  handleKey);

// ─── GAME FLOW ───────────────────────────────────────────────────
function startGame() {
    state        = 'PLAYING';
    score        = 0;
    prevScore    = 0;
    currentTier  = 0;
    currentBg    = sel.backgrounds;
    pipes        = [];
    pipeTimer    = PIPE_INT - 28;
    bird.reset();
    bird.flap();
    startMusicOnce();
}

function killBird() {
    state      = 'DYING';
    dyingTimer = 0;
    generateCracks(bird.x, bird.y);
    stopMusic();
    spawnParticles(bird.x, bird.y);
    if (score > best) {
        best = score;
        localStorage.setItem('r3b_best', best);
    }
    // auto-submit if player has a saved nickname
    const savedNick = lbSavedNick();
    if (savedNick && score > 0) lbSubmit(savedNick, score);
}

// ─── MAIN LOOP ───────────────────────────────────────────────────
function loop() {
    frameCount++;

    if (state === 'PLAYING') {
        bird.update();
        updatePipes();
        if (bird.isDead() || hitsPipe()) killBird();
    }

    if (state === 'MENU') {
        drawMenu();
    } else if (state === 'CUSTOMIZER') {
        drawCustomizer();
    } else if (state === 'DYING') {
        drawDying();
        updateDrawParticles();
    } else if (state === 'NICKNAME') {
        drawBackground(currentBg);
        drawPipes();
        drawGround();
        bird.draw(null, null, null, false, null);
        drawScore();
        updateDrawParticles();
        drawDead();
        drawNickname();
    } else if (state === 'LEADERBOARD') {
        drawMenu();
        drawLeaderboard();
    } else {
        drawBackground(currentBg);
        drawPipes();
        drawGround();
        bird.draw(null, null, null, false, null);
        drawScore();
        updateDrawParticles();
        if (state === 'DEAD') drawDead();
    }

    requestAnimationFrame(loop);
}

// ─── BOOT ────────────────────────────────────────────────────────
initMenuBird();
preloadImages();
loop();
