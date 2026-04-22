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
    state = 'MENU';
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
// 'MENU' | 'CUSTOMIZER' | 'PLAYING' | 'DEAD'
let state      = 'MENU';
let menuTimer  = 0;
let deadTimer  = 0;

const sel = { backgrounds: 4, eyes: 5, mouth: 6 };
let score      = 0;
let best       = +localStorage.getItem('r3b_best') || 0;
let frameCount = 0;
const PIPE_INT = 95;

// ─── EASING ──────────────────────────────────────────────────────
function easeOut(t, d) { const x = Math.min(t/d, 1); return 1-(1-x)*(1-x); }
function easeOutBack(t, d) {
    const x = Math.min(t/d, 1);
    const c1 = 1.70158, c3 = c1+1;
    return 1 + c3*Math.pow(x-1,3) + c1*Math.pow(x-1,2);
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
    pipes.push({ x: canvas.width + 10, topH, botY: topH + PIPEGAP, scored: false });
}

function updatePipes() {
    if (++pipeTimer >= PIPE_INT) { spawnPipe(); pipeTimer = 0; }
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= PIPESPD;
        if (!pipes[i].scored && pipes[i].x + PIPEW < bird.x - BIRDHR) {
            pipes[i].scored = true; score++;
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

// ─── DRAW: MENU ──────────────────────────────────────────────────
function drawMenu() {
    const W = canvas.width, H = canvas.height, cx = W/2;
    menuTimer++;

    // starfield background
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    // animated stars
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const stars = [
        [0.06,0.08],[0.17,0.05],[0.31,0.11],[0.45,0.04],[0.58,0.09],
        [0.72,0.06],[0.88,0.12],[0.13,0.18],[0.27,0.22],[0.51,0.15],
        [0.66,0.2],[0.79,0.17],[0.92,0.07],[0.04,0.28],[0.38,0.25],
        [0.84,0.3],[0.22,0.35],[0.60,0.32],[0.75,0.38],[0.95,0.24]
    ];
    stars.forEach(([fx,fy], i) => {
        const r = 0.8 + Math.abs(Math.sin(frameCount * 0.04 + i)) * 1.2;
        ctx.beginPath();
        ctx.arc(fx*W, fy*H*0.7, r, 0, Math.PI*2);
        ctx.fill();
    });

    // pixel title (wave animation)
    const titleSize = Math.min(Math.round(W * 0.044), 38);
    drawPixelTitle(cx, H * 0.26, titleSize, true);

    // character floating preview
    const floatY = H * 0.52 + Math.sin(frameCount * 0.05) * H * 0.012;
    const previewR = Math.min(Math.round(H * 0.1), 80);
    bird.draw(cx, floatY, 0, true, previewR);

    // tap to play — pulsing
    const pulse = 0.75 + 0.25 * Math.abs(Math.sin(frameCount * 0.055));
    const tfs   = Math.round(H * 0.025);
    ctx.globalAlpha = pulse;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${tfs}px Arial`;
    ctx.fillStyle = 'white';
    ctx.fillText('TAP  /  CLICK  /  SPACE  TO  PLAY', cx, H * 0.7);
    ctx.globalAlpha = 1;

    // buttons
    const btnW = Math.min(Math.round(W * 0.55), 300);
    const btnH = Math.round(H * 0.072);
    const btnX = cx - btnW/2;

    // PLAY button
    const btnY1 = H * 0.77;
    rr(btnX, btnY1, btnW, btnH, 14, '#27ae60', null);
    ctx.font = `bold ${Math.round(H * 0.028)}px Arial`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▶  PLAY', cx, btnY1 + btnH/2);
    UI.menuPlay = { x: btnX, y: btnY1, w: btnW, h: btnH };

    // CUSTOMIZE button
    const btnY2 = btnY1 + btnH + Math.round(H * 0.018);
    rr(btnX, btnY2, btnW, btnH, 14, '#181828', 'rgba(255,255,255,0.18)', 1.5);
    ctx.font = `bold ${Math.round(H * 0.024)}px Arial`;
    ctx.fillStyle = '#ccc';
    ctx.fillText('🎨  CUSTOMIZE CHARACTER', cx, btnY2 + btnH/2);
    UI.menuCustomize = { x: btnX, y: btnY2, w: btnW, h: btnH };

    // best score badge
    if (best > 0) {
        ctx.font = `${Math.round(H * 0.018)}px Arial`;
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`🏆  Best: ${best}`, cx, btnY2 + btnH + Math.round(H * 0.04));
    }
}

// ─── DRAW: GAME ELEMENTS ─────────────────────────────────────────
function drawBackground() {
    const bgImg = IMG.backgrounds[TRAITS.backgrounds[sel.backgrounds]];
    if (imgReady(bgImg)) {
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height - GH);
    } else {
        const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
        g.addColorStop(0, '#1a1a2e'); g.addColorStop(1, '#16213e');
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
        ctx.beginPath(); ctx.arc(gx+10, canvas.height-GH, 9, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.arc(gx+28, canvas.height-GH, 7, Math.PI, 0); ctx.fill();
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
    ctx.fillText(score, canvas.width/2, canvas.height*0.14);
    ctx.shadowBlur = 0;
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#07070f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const W = canvas.width, H = canvas.height, cx = W/2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(H*0.018)}px Arial`;
    ctx.fillStyle = '#555';
    ctx.fillText('R3TARD3D BIRD  ·  BUILD YOUR CHARACTER', cx, H*0.03);

    const pSz = Math.min(Math.round(W*0.55), Math.round(H*0.38));
    const pX  = cx - pSz/2, pY = Math.round(H*0.05);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(pX, pY, pSz, pSz, 18);
    ctx.clip();

    const bgImg = IMG.backgrounds[TRAITS.backgrounds[sel.backgrounds]];
    if (imgReady(bgImg)) ctx.drawImage(bgImg, pX, pY, pSz, pSz);
    else { ctx.fillStyle='#1a1a2e'; ctx.fillRect(pX, pY, pSz, pSz); }

    const eyeImg = IMG.eyes[TRAITS.eyes[sel.eyes]];
    if (imgReady(eyeImg)) ctx.drawImage(eyeImg, pX, pY, pSz, pSz);

    const mouthImg = IMG.mouth[TRAITS.mouth[sel.mouth]];
    if (imgReady(mouthImg)) ctx.drawImage(mouthImg, pX, pY, pSz, pSz);

    ctx.restore();
    rr(pX, pY, pSz, pSz, 18, null, 'rgba(255,255,255,0.15)', 1.5);

    const selY0 = pY + pSz + Math.round(H*0.025);
    const rowH  = Math.round(H*0.09);
    const AW    = Math.round(W*0.1);
    const AH    = Math.round(rowH*0.76);
    const pad   = Math.round(W*0.035);
    const fs    = Math.round(H*0.022);

    CATS.forEach((cat, i) => {
        const ry = selY0 + i*rowH;
        rr(pad, ry, W-pad*2, rowH-8, 10, '#111120', 'rgba(255,255,255,0.08)', 1);

        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.font = `bold ${Math.round(H*0.015)}px Arial`;
        ctx.fillStyle = '#555';
        ctx.fillText(CAT_LABELS[cat], pad+14, ry+8);

        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `bold ${fs}px Arial`;
        ctx.fillStyle = '#eee';
        ctx.fillText(TRAITS[cat][sel[cat]], W/2, ry+rowH/2-4);

        const lx=pad+2, ly=ry+Math.round((rowH-AH)/2);
        rr(lx, ly, AW, AH, 8, '#181828', 'rgba(255,255,255,0.12)', 1);
        ctx.font=`${Math.round(H*0.028)}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle='#bbb';
        ctx.fillText('◀', lx+AW/2, ly+AH/2);
        UI[`${cat}_prev`] = {x:lx,y:ly,w:AW,h:AH};

        const rx2=W-pad-AW-2, ry2=ly;
        rr(rx2, ry2, AW, AH, 8, '#181828', 'rgba(255,255,255,0.12)', 1);
        ctx.fillText('▶', rx2+AW/2, ry2+AH/2);
        UI[`${cat}_next`] = {x:rx2,y:ry2,w:AW,h:AH};
    });

    const btnY = selY0 + CATS.length*rowH + Math.round(H*0.015);
    const btnH = Math.round(H*0.077);
    const btnW = Math.round((W-pad*3)/2);
    const bfs  = Math.round(H*0.021);

    rr(pad, btnY, btnW, btnH, 12, '#181828', 'rgba(255,255,255,0.12)', 1);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font=`bold ${bfs}px Arial`; ctx.fillStyle='#ccc';
    ctx.fillText('⚡  RANDOM', pad+btnW/2, btnY+btnH/2);
    UI.random = {x:pad,y:btnY,w:btnW,h:btnH};

    const playX = pad*2+btnW;
    rr(playX, btnY, btnW, btnH, 12, '#27ae60', null, 0);
    ctx.fillStyle='#fff'; ctx.font=`bold ${bfs}px Arial`;
    ctx.fillText('▶  PLAY', playX+btnW/2, btnY+btnH/2);
    UI.play = {x:playX,y:btnY,w:btnW,h:btnH};

    if (best > 0) {
        ctx.font=`${Math.round(H*0.018)}px Arial`; ctx.fillStyle='#FFD700';
        ctx.fillText(`🏆  Best: ${best}`, W/2, btnY+btnH+Math.round(H*0.04));
    }
}

// ─── DRAW: GAME OVER ─────────────────────────────────────────────
function drawDead() {
    deadTimer++;
    const W = canvas.width, H = canvas.height, cx = W/2;

    // red-tinted overlay fades in
    const overlayA = easeOut(deadTimer, 18) * 0.62;
    ctx.fillStyle = `rgba(20,0,0,${overlayA})`;
    ctx.fillRect(0, 0, W, H);

    // panel slides in from top
    const panelW  = Math.min(Math.round(W*0.82), 420);
    const panelH  = Math.round(H*0.58);
    const panelX  = cx - panelW/2;
    const slideP  = easeOutBack(deadTimer, 30);
    const panelY  = H*0.18 + (1-Math.min(slideP,1)) * (-H*0.4);

    // glow behind panel
    const glowA = easeOut(deadTimer, 25) * 0.5;
    ctx.save();
    ctx.shadowColor = `rgba(200,0,0,${glowA})`;
    ctx.shadowBlur  = 60;
    ctx.fillStyle   = 'transparent';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.restore();

    // panel background
    rr(panelX, panelY, panelW, panelH, 20, '#0c0c18', 'rgba(180,0,0,0.35)', 2);

    // red top accent bar
    rr(panelX, panelY, panelW, 5, [20,20,0,0], '#c0392b', null);

    const textA = easeOut(Math.max(deadTimer-8, 0), 18);
    ctx.globalAlpha = Math.min(textA, 1);

    // character face preview at top of panel
    const faceR  = Math.min(Math.round(H*0.07), 60);
    const faceY  = panelY - faceR * 0.4;
    bird.draw(cx, faceY, 0, true, faceR);
    // ring around face
    ctx.save();
    ctx.translate(cx, faceY);
    ctx.beginPath(); ctx.arc(0, 0, faceR+3, 0, Math.PI*2);
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();

    // "YOU DIED" text
    const titleFS = Math.min(Math.round(H*0.065), 56);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${titleFS}px Arial`;
    // stroke outline
    ctx.strokeStyle = '#7b0000'; ctx.lineWidth = titleFS*0.08;
    ctx.strokeText('YOU DIED', cx, panelY + panelH*0.28);
    ctx.fillStyle = '#e74c3c';
    ctx.fillText('YOU DIED', cx, panelY + panelH*0.28);

    // "R3TARD" in yellow below
    const subFS = Math.min(Math.round(H*0.038), 32);
    ctx.font = `bold ${subFS}px 'Press Start 2P', monospace`;
    ctx.strokeStyle = '#5a4000'; ctx.lineWidth = subFS*0.1;
    ctx.strokeText('R3TARD', cx, panelY + panelH*0.42);
    ctx.fillStyle = '#FFD700';
    ctx.fillText('R3TARD', cx, panelY + panelH*0.42);

    // divider
    ctx.globalAlpha = Math.min(textA, 1) * 0.3;
    ctx.fillStyle = '#fff';
    ctx.fillRect(panelX + panelW*0.1, panelY + panelH*0.51, panelW*0.8, 1);
    ctx.globalAlpha = Math.min(textA, 1);

    // score row
    const statFS = Math.min(Math.round(H*0.028), 24);
    ctx.font = `${statFS}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Score`, panelX + panelW*0.3, panelY + panelH*0.59);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(statFS*1.3)}px Arial`;
    ctx.fillText(score, panelX + panelW*0.62, panelY + panelH*0.59);

    ctx.font = `${statFS}px Arial`;
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`Best`, panelX + panelW*0.3, panelY + panelH*0.7);
    ctx.font = `bold ${Math.round(statFS*1.3)}px Arial`;
    ctx.fillText(best, panelX + panelW*0.62, panelY + panelH*0.7);

    if (score > 0 && score >= best) {
        ctx.font = `bold ${Math.round(statFS*0.85)}px Arial`;
        ctx.fillStyle = '#2ecc71';
        ctx.textAlign = 'center';
        ctx.fillText('🏆  NEW RECORD!', cx, panelY + panelH*0.78);
    }

    // buttons appear after delay
    const btnA = easeOut(Math.max(deadTimer-28, 0), 16);
    ctx.globalAlpha = Math.min(btnA, 1);

    const btnH2 = Math.round(panelH*0.14);
    const btnW2 = panelW*0.82;
    const btnX2 = panelX + (panelW-btnW2)/2;
    const btnY2 = panelY + panelH - btnH2 - Math.round(panelH*0.06);

    rr(btnX2, btnY2, btnW2, btnH2, 12, '#27ae60', null);
    ctx.font = `bold ${Math.min(Math.round(H*0.026),22)}px Arial`;
    ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('▶  Play Again', cx, btnY2+btnH2/2);
    UI.restart = {x:btnX2,y:btnY2,w:btnW2,h:btnH2};

    ctx.globalAlpha = Math.min(btnA, 1) * 0.6;
    ctx.font = `${Math.round(H*0.02)}px Arial`;
    ctx.fillStyle = '#aaa';
    ctx.fillText('← Change Character', cx, panelY + panelH + Math.round(H*0.045));
    UI.customize = {x:panelX, y:panelY+panelH+Math.round(H*0.025), w:panelW, h:Math.round(H*0.04)};

    ctx.globalAlpha = 1;
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
        if (hits('menuPlay', x, y))      { startGame(); return; }
        if (hits('menuCustomize', x, y)) { state = 'CUSTOMIZER'; return; }
        startGame();
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
    }
}

function handleKey(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (state === 'MENU')        { startGame(); return; }
        if (state === 'PLAYING')     { bird.flap(); return; }
        if (state === 'DEAD')        { startGame(); return; }
        if (state === 'CUSTOMIZER' && e.code === 'Space') startGame();
    }
}

canvas.addEventListener('click',      handleInput);
canvas.addEventListener('touchstart', e => { e.preventDefault(); handleInput(e); }, {passive:false});
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
    state     = 'DEAD';
    deadTimer = 0;
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

    if (state === 'MENU') {
        drawMenu();
    } else if (state === 'CUSTOMIZER') {
        drawCustomizer();
    } else {
        drawBackground();
        drawPipes();
        drawGround();
        bird.draw(null, null, null, false, null);
        drawScore();
        if (state === 'DEAD') drawDead();
    }

    requestAnimationFrame(loop);
}

// ─── BOOT ────────────────────────────────────────────────────────
preloadImages();
loop();
