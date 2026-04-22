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

// Eyes valid for random (exclude NONE)
const EYES_RANDOM = TRAITS.eyes
    .map((n, i) => i)
    .filter(i => TRAITS.eyes[i] !== 'NONE');

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
const totalCount = CATS.reduce((s, c) => s + TRAITS[c].length, 0);
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
}

// ─── RESPONSIVE CANVAS ───────────────────────────────────────────
// Dynamic constants, recalculated on resize
let GH, BIRDX, BIRDY0, BIRDR, BIRDHR, PIPEW, PIPEGAP, PIPESPD, GRAVITY_V, FLAP_V;

function recalc() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    GH       = Math.round(canvas.height * 0.12);
    BIRDR    = Math.min(Math.round(canvas.height * 0.054), 55);
    BIRDHR   = Math.round(BIRDR * 0.74);
    BIRDX    = Math.round(canvas.width * 0.25);
    BIRDY0   = Math.round(canvas.height * 0.47);
    PIPEW    = Math.min(Math.round(canvas.width * 0.16), 110);
    PIPEGAP  = Math.round(canvas.height * 0.28);
    PIPESPD  = Math.min(canvas.width * 0.0063, 7);
    GRAVITY_V= canvas.height * 0.00072;
    FLAP_V   = -(canvas.height * 0.0145);
}

recalc();
window.addEventListener('resize', () => {
    recalc();
    bird.x = BIRDX;
    if (state !== 'PLAYING') bird.y = BIRDY0;
});

// ─── GAME STATE ──────────────────────────────────────────────────
let state = 'CUSTOMIZER';

const sel = { backgrounds: 4, eyes: 5, mouth: 6 }; // OG / LASER / JUICY
let score      = 0;
let best       = +localStorage.getItem('r3b_best') || 0;
let frameCount = 0;
const PIPE_INT = 95;

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

    // showRing: true in customizer preview, false in game
    draw(ox, oy, or_, showRing) {
        const bx = ox  ?? this.x;
        const by = oy  ?? this.y;
        const br = or_ ?? this.rot;
        const d  = BIRDR * 2;

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(br * Math.PI / 180);
        ctx.scale(-1, 1); // flip horizontally so character faces right

        // circular clip
        ctx.beginPath();
        ctx.arc(0, 0, BIRDR, 0, Math.PI * 2);
        ctx.clip();

        // background layer
        const bgImg = IMG.backgrounds[TRAITS.backgrounds[sel.backgrounds]];
        if (imgReady(bgImg)) {
            ctx.drawImage(bgImg, -BIRDR, -BIRDR, d, d);
        } else {
            ctx.fillStyle = '#2a2a3e';
            ctx.fillRect(-BIRDR, -BIRDR, d, d);
        }

        // eyes layer
        const eyeImg = IMG.eyes[TRAITS.eyes[sel.eyes]];
        if (imgReady(eyeImg)) ctx.drawImage(eyeImg, -BIRDR, -BIRDR, d, d);

        // mouth layer
        const mouthImg = IMG.mouth[TRAITS.mouth[sel.mouth]];
        if (imgReady(mouthImg)) ctx.drawImage(mouthImg, -BIRDR, -BIRDR, d, d);

        ctx.restore();

        // optional ring (customizer preview only)
        if (showRing) {
            ctx.save();
            ctx.translate(bx, by);
            ctx.beginPath();
            ctx.arc(0, 0, BIRDR + 1.5, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.restore();
        }
    },

    isDead() {
        return this.y + BIRDHR > canvas.height - GH || this.y - BIRDHR < 0;
    }
};

function imgReady(img) {
    return img && img.complete && img.naturalWidth > 0;
}

// ─── PIPES ───────────────────────────────────────────────────────
let pipes     = [];
let pipeTimer = 0;

function spawnPipe() {
    const minH = GH + 40;
    const maxH = canvas.height - GH - PIPEGAP - minH;
    const topH = minH + Math.random() * maxH;
    pipes.push({ x: canvas.width + 10, topH, botY: topH + PIPEGAP, scored: false });
}

function updatePipes() {
    if (++pipeTimer >= PIPE_INT) { spawnPipe(); pipeTimer = 0; }
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= PIPESPD;
        if (!pipes[i].scored && pipes[i].x + PIPEW < bird.x - BIRDHR) {
            pipes[i].scored = true;
            score++;
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

// ─── DRAW: GAME ELEMENTS ─────────────────────────────────────────
function drawBackground() {
    const bgImg = IMG.backgrounds[TRAITS.backgrounds[sel.backgrounds]];
    if (imgReady(bgImg)) {
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height - GH);
    } else {
        const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
        g.addColorStop(0, '#1a1a2e');
        g.addColorStop(1, '#16213e');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawPipes() {
    for (const p of pipes) {
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(p.x, 0, PIPEW, p.topH - 22);
        ctx.fillStyle = '#388E3C';
        ctx.fillRect(p.x - 7, p.topH - 22, PIPEW + 14, 22);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(p.x + 6, 0, 12, p.topH - 22);

        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(p.x, p.botY + 22, PIPEW, canvas.height);
        ctx.fillStyle = '#388E3C';
        ctx.fillRect(p.x - 7, p.botY, PIPEW + 14, 22);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(p.x + 6, p.botY + 22, 12, canvas.height);
    }
}

function drawGround() {
    ctx.fillStyle = '#5d3a1a';
    ctx.fillRect(0, canvas.height - GH, canvas.width, GH);
    ctx.fillStyle = '#2e7d32';
    ctx.fillRect(0, canvas.height - GH, canvas.width, 18);
    ctx.fillStyle = '#43a047';
    const off = (frameCount * PIPESPD) % 44;
    for (let gx = -off; gx < canvas.width + 44; gx += 44) {
        ctx.beginPath();
        ctx.arc(gx + 10, canvas.height - GH, 9, Math.PI, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(gx + 28, canvas.height - GH, 7, Math.PI, 0);
        ctx.fill();
    }
}

function drawScore() {
    const fs = Math.round(canvas.height * 0.084);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `bold ${fs}px Arial`;
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 7;
    ctx.fillText(score, canvas.width / 2, canvas.height * 0.14);
    ctx.shadowBlur = 0;
}

// ─── DRAW: CUSTOMIZER ────────────────────────────────────────────
const UI = {};

function rr(x, y, w, h, r, fill, stroke, lw) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill)   { ctx.fillStyle = fill;     ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}

function drawCustomizer() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#07070f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const W = canvas.width, H = canvas.height;
    const cx = W / 2;

    // ── header ──
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(H * 0.018)}px Arial`;
    ctx.fillStyle = '#555';
    ctx.fillText('R3TARD3D BIRD  ·  BUILD YOUR CHARACTER', cx, H * 0.03);

    // ── preview square ──
    const pSz = Math.min(Math.round(W * 0.55), Math.round(H * 0.38));
    const pX  = cx - pSz / 2;
    const pY  = Math.round(H * 0.05);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(pX, pY, pSz, pSz, 18);
    ctx.clip();

    const bgImg = IMG.backgrounds[TRAITS.backgrounds[sel.backgrounds]];
    if (imgReady(bgImg)) {
        ctx.drawImage(bgImg, pX, pY, pSz, pSz);
    } else {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(pX, pY, pSz, pSz);
    }
    const eyeImg = IMG.eyes[TRAITS.eyes[sel.eyes]];
    if (imgReady(eyeImg)) ctx.drawImage(eyeImg, pX, pY, pSz, pSz);

    const mouthImg = IMG.mouth[TRAITS.mouth[sel.mouth]];
    if (imgReady(mouthImg)) ctx.drawImage(mouthImg, pX, pY, pSz, pSz);

    ctx.restore();
    rr(pX, pY, pSz, pSz, 18, null, 'rgba(255,255,255,0.15)', 1.5);

    // ── selectors ──
    const selY0 = pY + pSz + Math.round(H * 0.025);
    const rowH  = Math.round(H * 0.09);
    const AW    = Math.round(W * 0.1);
    const AH    = Math.round(rowH * 0.76);
    const pad   = Math.round(W * 0.035);
    const fs    = Math.round(H * 0.022);

    CATS.forEach((cat, i) => {
        const ry = selY0 + i * rowH;

        rr(pad, ry, W - pad * 2, rowH - 8, 10, '#111120', 'rgba(255,255,255,0.08)', 1);

        // category label
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = `bold ${Math.round(H * 0.015)}px Arial`;
        ctx.fillStyle = '#555';
        ctx.fillText(CAT_LABELS[cat], pad + 14, ry + 8);

        // trait name
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${fs}px Arial`;
        ctx.fillStyle = '#eee';
        ctx.fillText(TRAITS[cat][sel[cat]], cx, ry + rowH / 2 - 4);

        // left arrow
        const lx = pad + 2, ly = ry + Math.round((rowH - AH) / 2);
        rr(lx, ly, AW, AH, 8, '#181828', 'rgba(255,255,255,0.12)', 1);
        ctx.font = `${Math.round(H * 0.028)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#bbb';
        ctx.fillText('◀', lx + AW / 2, ly + AH / 2);
        UI[`${cat}_prev`] = { x: lx, y: ly, w: AW, h: AH };

        // right arrow
        const rx2 = W - pad - AW - 2, ry2 = ly;
        rr(rx2, ry2, AW, AH, 8, '#181828', 'rgba(255,255,255,0.12)', 1);
        ctx.fillText('▶', rx2 + AW / 2, ry2 + AH / 2);
        UI[`${cat}_next`] = { x: rx2, y: ry2, w: AW, h: AH };
    });

    // ── buttons ──
    const btnY = selY0 + CATS.length * rowH + Math.round(H * 0.015);
    const btnH = Math.round(H * 0.077);
    const btnW = Math.round((W - pad * 3) / 2);
    const bfs  = Math.round(H * 0.021);

    rr(pad, btnY, btnW, btnH, 12, '#181828', 'rgba(255,255,255,0.12)', 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${bfs}px Arial`;
    ctx.fillStyle = '#ccc';
    ctx.fillText('⚡  RANDOM', pad + btnW / 2, btnY + btnH / 2);
    UI.random = { x: pad, y: btnY, w: btnW, h: btnH };

    const playX = pad * 2 + btnW;
    rr(playX, btnY, btnW, btnH, 12, '#27ae60', null, 0);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${bfs}px Arial`;
    ctx.fillText('▶  PLAY', playX + btnW / 2, btnY + btnH / 2);
    UI.play = { x: playX, y: btnY, w: btnW, h: btnH };

    // best score
    if (best > 0) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${Math.round(H * 0.018)}px Arial`;
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`🏆  Best: ${best}`, cx, btnY + btnH + Math.round(H * 0.04));
    }
}

// ─── DRAW: GAME OVER ─────────────────────────────────────────────
function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const W  = canvas.width, H = canvas.height;
    const pw = Math.min(Math.round(W * 0.7), 340);
    const ph = Math.round(H * 0.42);
    const px = (W - pw) / 2;
    const py = (H - ph) / 2 - Math.round(H * 0.03);
    const cx = W / 2;

    rr(px, py, pw, ph, 18, '#0c0c1a', 'rgba(255,255,255,0.12)', 1.5);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `bold ${Math.round(H * 0.056)}px Arial`;
    ctx.fillStyle = '#e74c3c';
    ctx.fillText('YOU DIED 💀', cx, py + ph * 0.2);

    ctx.font = `${Math.round(H * 0.033)}px Arial`;
    ctx.fillStyle = '#fff';
    ctx.fillText(`Score:  ${score}`, cx, py + ph * 0.42);

    ctx.font = `${Math.round(H * 0.027)}px Arial`;
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`Best:  ${best}`, cx, py + ph * 0.56);

    if (score > 0 && score >= best) {
        ctx.font = `bold ${Math.round(H * 0.024)}px Arial`;
        ctx.fillStyle = '#2ecc71';
        ctx.fillText('🏆 New record!', cx, py + ph * 0.69);
    }

    // Play Again button
    const bh = Math.round(ph * 0.18);
    const bx = px + pw * 0.08;
    const by = py + ph - bh - Math.round(ph * 0.06);
    const bw = pw * 0.84;
    rr(bx, by, bw, bh, 12, '#27ae60', null, 0);
    ctx.font = `bold ${Math.round(H * 0.026)}px Arial`;
    ctx.fillStyle = '#fff';
    ctx.fillText('Play Again', cx, by + bh / 2);
    UI.restart = { x: bx, y: by, w: bw, h: bh };

    // Change character link
    ctx.font = `${Math.round(H * 0.02)}px Arial`;
    ctx.fillStyle = '#666';
    ctx.fillText('← Change Character', cx, py + ph + Math.round(H * 0.04));
    UI.customize = { x: px, y: py + ph + Math.round(H * 0.025), w: pw, h: Math.round(H * 0.04) };
}

// ─── HIT TEST ────────────────────────────────────────────────────
function hits(key, x, y) {
    const e = UI[key];
    return e && x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h;
}

// ─── INPUT ───────────────────────────────────────────────────────
function canvasXY(e) {
    const r  = canvas.getBoundingClientRect();
    const sx = canvas.width  / r.width;
    const sy = canvas.height / r.height;
    const s  = e.touches ? e.touches[0] : e;
    return { x: (s.clientX - r.left) * sx, y: (s.clientY - r.top) * sy };
}

function handleInput(e) {
    const { x, y } = canvasXY(e);

    if (state === 'CUSTOMIZER') {
        for (const cat of CATS) {
            const n = TRAITS[cat].length;
            if (hits(`${cat}_prev`, x, y)) { sel[cat] = (sel[cat] - 1 + n) % n; return; }
            if (hits(`${cat}_next`, x, y)) { sel[cat] = (sel[cat] + 1)     % n; return; }
        }
        if (hits('random', x, y)) {
            sel.backgrounds = Math.floor(Math.random() * TRAITS.backgrounds.length);
            sel.eyes        = EYES_RANDOM[Math.floor(Math.random() * EYES_RANDOM.length)];
            sel.mouth       = Math.floor(Math.random() * TRAITS.mouth.length);
            return;
        }
        if (hits('play', x, y)) startGame();
        return;
    }

    if (state === 'PLAYING') { bird.flap(); return; }

    if (state === 'DEAD') {
        if (hits('restart',   x, y)) { startGame(); return; }
        if (hits('customize', x, y)) { state = 'CUSTOMIZER'; }
    }
}

function handleKey(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (state === 'PLAYING') { bird.flap(); return; }
        if (state === 'DEAD')    { startGame(); return; }
        if (state === 'CUSTOMIZER' && e.code === 'Space') startGame();
    }
}

canvas.addEventListener('click',      handleInput);
canvas.addEventListener('touchstart', e => { e.preventDefault(); handleInput(e); }, { passive: false });
document.addEventListener('keydown',  handleKey);

// ─── GAME FLOW ───────────────────────────────────────────────────
function startGame() {
    state     = 'PLAYING';
    score     = 0;
    pipes     = [];
    pipeTimer = PIPE_INT - 28;
    bird.reset();
    bird.flap();
}

function killBird() {
    state = 'DEAD';
    if (score > best) {
        best = score;
        localStorage.setItem('r3b_best', best);
    }
}

// ─── MAIN LOOP ───────────────────────────────────────────────────
function loop() {
    frameCount++;

    if (state === 'PLAYING') {
        bird.update();
        updatePipes();
        if (bird.isDead() || hitsPipe()) killBird();
    }

    if (state === 'CUSTOMIZER') {
        drawCustomizer();
    } else {
        drawBackground();
        drawPipes();
        drawGround();
        bird.draw(null, null, null, false);
        drawScore();
        if (state === 'DEAD') drawDead();
    }

    requestAnimationFrame(loop);
}

// ─── BOOT ────────────────────────────────────────────────────────
preloadImages();
loop();
