// ═══════════════════════════════════════════════════════════════
//  R3TARD3D BIRD
// ═══════════════════════════════════════════════════════════════

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
canvas.width  = 480;
canvas.height = 640;

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

// ─── GAME STATE ──────────────────────────────────────────────────
// 'CUSTOMIZER' | 'PLAYING' | 'DEAD'
let state = 'CUSTOMIZER';

const sel = { backgrounds: 4, eyes: 5, mouth: 6 }; // OG / LASER / JUICY
let score     = 0;
let best      = +localStorage.getItem('r3b_best') || 0;
let frameCount= 0;

// ─── PHYSICS ─────────────────────────────────────────────────────
const GRAVITY  = 0.46;
const FLAP_VEL = -9.2;
const PIPE_W   = 78;
const PIPE_GAP = 175;
const PIPE_SPD = 3.0;
const PIPE_INT = 95;
const GROUND_H = 80;

// ─── BIRD ────────────────────────────────────────────────────────
const bird = {
    x: 120, y: 300, vy: 0, rot: 0,
    R:  35,   // draw radius
    HR: 26,   // hitbox radius

    reset() { this.y = 300; this.vy = 0; this.rot = 0; },
    flap()  { this.vy = FLAP_VEL; },

    update() {
        this.vy  = Math.min(this.vy + GRAVITY, 14);
        this.y  += this.vy;
        this.rot = Math.max(-25, Math.min(90, this.vy * 4.5));
    },

    draw(ox, oy, or_) {
        const bx = ox  ?? this.x;
        const by = oy  ?? this.y;
        const br = or_ ?? this.rot;
        const d  = this.R * 2;

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(br * Math.PI / 180);

        // circular clip
        ctx.beginPath();
        ctx.arc(0, 0, this.R, 0, Math.PI * 2);
        ctx.clip();

        // background layer
        const bgImg = IMG.backgrounds[TRAITS.backgrounds[sel.backgrounds]];
        if (imgReady(bgImg)) {
            ctx.drawImage(bgImg, -this.R, -this.R, d, d);
        } else {
            ctx.fillStyle = '#2a2a3e';
            ctx.fillRect(-this.R, -this.R, d, d);
        }

        // eyes layer
        const eyeImg = IMG.eyes[TRAITS.eyes[sel.eyes]];
        if (imgReady(eyeImg)) ctx.drawImage(eyeImg, -this.R, -this.R, d, d);

        // mouth layer
        const mouthImg = IMG.mouth[TRAITS.mouth[sel.mouth]];
        if (imgReady(mouthImg)) ctx.drawImage(mouthImg, -this.R, -this.R, d, d);

        ctx.restore();

        // white ring
        ctx.save();
        ctx.translate(bx, by);
        ctx.beginPath();
        ctx.arc(0, 0, this.R + 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
    },

    isDead() {
        return this.y + this.HR > canvas.height - GROUND_H || this.y - this.HR < 0;
    }
};

function imgReady(img) {
    return img && img.complete && img.naturalWidth > 0;
}

// ─── PIPES ───────────────────────────────────────────────────────
let pipes     = [];
let pipeTimer = 0;

function spawnPipe() {
    const minH = 80;
    const maxH = canvas.height - GROUND_H - PIPE_GAP - minH;
    const topH = minH + Math.random() * maxH;
    pipes.push({ x: canvas.width + 10, topH, botY: topH + PIPE_GAP, scored: false });
}

function updatePipes() {
    if (++pipeTimer >= PIPE_INT) { spawnPipe(); pipeTimer = 0; }
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= PIPE_SPD;
        if (!pipes[i].scored && pipes[i].x + PIPE_W < bird.x - bird.HR) {
            pipes[i].scored = true;
            score++;
        }
        if (pipes[i].x + PIPE_W < -5) pipes.splice(i, 1);
    }
}

function hitsPipe() {
    for (const p of pipes) {
        if (bird.x + bird.HR - 8 > p.x && bird.x - bird.HR + 8 < p.x + PIPE_W) {
            if (bird.y - bird.HR + 8 < p.topH)  return true;
            if (bird.y + bird.HR - 8 > p.botY)  return true;
        }
    }
    return false;
}

// ─── DRAW: GAME ELEMENTS ─────────────────────────────────────────
function drawBackground() {
    const bgImg = IMG.backgrounds[TRAITS.backgrounds[sel.backgrounds]];
    if (imgReady(bgImg)) {
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height - GROUND_H);
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
        ctx.fillRect(p.x, 0, PIPE_W, p.topH - 22);
        ctx.fillStyle = '#388E3C';
        ctx.fillRect(p.x - 7, p.topH - 22, PIPE_W + 14, 22);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(p.x + 6, 0, 12, p.topH - 22);

        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(p.x, p.botY + 22, PIPE_W, canvas.height);
        ctx.fillStyle = '#388E3C';
        ctx.fillRect(p.x - 7, p.botY, PIPE_W + 14, 22);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(p.x + 6, p.botY + 22, 12, canvas.height);
    }
}

function drawGround() {
    ctx.fillStyle = '#5d3a1a';
    ctx.fillRect(0, canvas.height - GROUND_H, canvas.width, GROUND_H);
    ctx.fillStyle = '#2e7d32';
    ctx.fillRect(0, canvas.height - GROUND_H, canvas.width, 18);
    ctx.fillStyle = '#43a047';
    const off = (frameCount * PIPE_SPD) % 44;
    for (let gx = -off; gx < canvas.width + 44; gx += 44) {
        ctx.beginPath();
        ctx.arc(gx + 10, canvas.height - GROUND_H, 9, Math.PI, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(gx + 28, canvas.height - GROUND_H, 7, Math.PI, 0);
        ctx.fill();
    }
}

function drawScore() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 54px Arial';
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 7;
    ctx.fillText(score, canvas.width / 2, 90);
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

    // ── background ──
    ctx.fillStyle = '#07070f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ── header ──
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = '#555';
    ctx.fillText('R3TARD3D BIRD  ·  BUILD YOUR CHARACTER', canvas.width / 2, 18);

    // ── preview square ──
    const pSz = 240, pX = (canvas.width - pSz) / 2, pY = 32;

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
    const selY0 = pY + pSz + 16;
    const rowH  = 58;
    const AW = 44, AH = 44;

    CATS.forEach((cat, i) => {
        const ry = selY0 + i * rowH;
        const cx = canvas.width / 2;

        rr(12, ry, canvas.width - 24, rowH - 8, 10, '#111120', 'rgba(255,255,255,0.08)', 1);

        // category label
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 10px Arial';
        ctx.fillStyle = '#555';
        ctx.fillText(CAT_LABELS[cat], 26, ry + 7);

        // trait name
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#eee';
        ctx.fillText(TRAITS[cat][sel[cat]], cx, ry + rowH / 2 - 4);

        // left arrow
        const lx = 16, ly = ry + 7;
        rr(lx, ly, AW, AH, 8, '#181828', 'rgba(255,255,255,0.12)', 1);
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#bbb';
        ctx.fillText('◀', lx + AW / 2, ly + AH / 2);
        UI[`${cat}_prev`] = { x: lx, y: ly, w: AW, h: AH };

        // right arrow
        const rx2 = canvas.width - 16 - AW, ry2 = ry + 7;
        rr(rx2, ry2, AW, AH, 8, '#181828', 'rgba(255,255,255,0.12)', 1);
        ctx.fillText('▶', rx2 + AW / 2, ry2 + AH / 2);
        UI[`${cat}_next`] = { x: rx2, y: ry2, w: AW, h: AH };
    });

    // ── buttons ──
    const btnY = selY0 + CATS.length * rowH + 10;

    rr(16, btnY, 198, 50, 12, '#181828', 'rgba(255,255,255,0.12)', 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px Arial';
    ctx.fillStyle = '#ccc';
    ctx.fillText('⚡  RANDOM', 115, btnY + 25);
    UI.random = { x: 16, y: btnY, w: 198, h: 50 };

    rr(266, btnY, 198, 50, 12, '#27ae60', null, 0);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px Arial';
    ctx.fillText('▶   PLAY', 365, btnY + 25);
    UI.play = { x: 266, y: btnY, w: 198, h: 50 };

    // ── best score chip ──
    if (best > 0) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '12px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`🏆  Best: ${best}`, canvas.width / 2, btnY + 68);
    }
}

// ─── DRAW: GAME OVER ─────────────────────────────────────────────
function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const pw = 300, ph = 270;
    const px = (canvas.width - pw) / 2;
    const py = (canvas.height - ph) / 2 - 20;
    const cx = canvas.width / 2;

    rr(px, py, pw, ph, 18, '#0c0c1a', 'rgba(255,255,255,0.12)', 1.5);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#e74c3c';
    ctx.fillText('УМЕР 💀', cx, py + 52);

    ctx.font = '21px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Счёт:  ${score}`, cx, py + 108);

    ctx.font = '17px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`Рекорд:  ${best}`, cx, py + 142);

    if (score > 0 && score >= best) {
        ctx.font = 'bold 15px Arial';
        ctx.fillStyle = '#2ecc71';
        ctx.fillText('🏆 Новый рекорд!', cx, py + 172);
    }

    // restart button
    const bx = px + 20, by = py + ph - 62, bw = pw - 40, bh = 46;
    rr(bx, by, bw, bh, 12, '#27ae60', null, 0);
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('Заново', cx, by + bh / 2);
    UI.restart = { x: bx, y: by, w: bw, h: bh };

    // back to customizer
    ctx.font = '13px Arial';
    ctx.fillStyle = '#666';
    ctx.fillText('← Поменять персонажа', cx, py + ph + 26);
    UI.customize = { x: px, y: py + ph + 12, w: pw, h: 26 };
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
            CATS.forEach(cat => sel[cat] = Math.floor(Math.random() * TRAITS[cat].length));
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
        bird.draw();
        drawScore();
        if (state === 'DEAD') drawDead();
    }

    requestAnimationFrame(loop);
}

// ─── BOOT ────────────────────────────────────────────────────────
preloadImages();
loop();
