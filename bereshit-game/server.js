'use strict';
const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const C = require('./content');

const PORT = process.env.PORT || 3000;
const HOST_PIN = process.env.HOST_PIN || ''; // אופציונלי: קוד סודי למארח
const PUBLIC_URL = process.env.PUBLIC_URL || ''; // אופציונלי: כתובת ציבורית קבועה

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (q, r) => r.sendFile(path.join(__dirname, 'public', 'play.html')));
app.get('/host', (q, r) => r.sendFile(path.join(__dirname, 'public', 'host.html')));
const server = http.createServer(app);
const io = new Server(server);

// ---------- helpers ----------
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const now = () => Date.now();
const AVATARS = ['🦊','🐼','🐸','🦄','🐯','🐵','🦉','🐙','🦋','🐢','🦁','🐨','🐰','🐻','🦖','🐳','🦩','🐝','🐞','🦔','🐧','🐷','🦜','🐲','🐊','🦈','🦘','🦦'];
const avatarBag = [];
const nextAvatar = () => {
  if (!avatarBag.length) avatarBag.push(...shuffle(AVATARS));
  return avatarBag.pop();
};

const BOARD_PHASES = new Set(['r1_reveal', 'r2_board', 'r3_board', 'r4_scatter', 'r4_reveal', 'final']);
const TIMED = { r1_name: 25, r1_vote: 15, r2_play: 30, r3_play: 30, r4_tower: 20, r4_q: 15 };
const ARK_COUNT = 8;
const R1_ROUNDS = 3;

// ---------- state ----------
const G = {
  phase: 'lobby',
  seq: 0,
  laterSeq: -1,
  endsAt: 0,
  dur: 0,
  timer: null,
  players: new Map(), // token -> player
  byPid: new Map(),
  nextPid: 1,
  prevRanks: {},
  board: null,
  r1animals: [],
  r1i: 0,
  r1: null,
  r2: null,
  r3: null,
  r4: null,
  trivia: [],
  qi: 0,
  q: null,
  joinUrl: '',
  qr: '',
};

const allPlayers = () => [...G.players.values()];
const connected = () => allPlayers().filter((p) => p.connected);
const pub = (p) => ({ pid: p.pid, name: p.name, avatar: p.avatar, score: p.score });
const ranking = () => allPlayers().sort((a, b) => b.score - a.score || a.pid - b.pid);

function makeBoard(topN = 5) {
  const list = ranking();
  const rankOf = {};
  list.forEach((p, i) => {
    const rank = i + 1;
    const prev = G.prevRanks[p.pid];
    rankOf[p.pid] = { rank, delta: prev ? prev - rank : 0 };
  });
  G.board = {
    top: list.slice(0, topN).map((p) => ({ ...pub(p), delta: rankOf[p.pid].delta })),
    rankOf,
    total: list.length,
  };
  G.prevRanks = Object.fromEntries(list.map((p, i) => [p.pid, i + 1]));
}

// ---------- phase machine ----------
// G.seq מתחלף בכל מעבר שלב. טיימר ששייך לשלב קודם לא יקדם את השלב הנוכחי,
// גם אם לשניהם אותו שם (r1_name לכל חיה, r4_q לכל שאלה).
function go(phase) {
  clearTimeout(G.timer);
  G.seq++;
  G.phase = phase;
  const seq = G.seq;
  const secs = TIMED[phase] || 0;
  G.dur = secs * 1000;
  G.endsAt = secs ? now() + G.dur : 0;
  if (secs) {
    G.timer = setTimeout(() => {
      if (G.seq === seq) advance();
    }, G.dur + 150);
  }
  pushAll();
}

function later(phase, ms = 700) {
  if (G.laterSeq === G.seq) return; // כבר תוזמן מעבר לשלב הזה
  G.laterSeq = G.seq;
  const seq = G.seq;
  setTimeout(() => {
    if (G.seq === seq && G.phase === phase) advance();
  }, ms);
}

function advance() {
  const ph = G.phase;
  switch (ph) {
    case 'lobby':
      if (!allPlayers().length) return;
      G.r1animals = shuffle(C.NAMING).slice(0, R1_ROUNDS);
      return go('r1_intro');
    case 'r1_intro':
      G.r1i = 0;
      return beginAnimal();
    case 'r1_name': {
      const r = G.r1;
      r.entries = shuffle([...r.names.entries()].map(([pid, text]) => ({ pid, text }))).map((e, i) => ({ ...e, i }));
      if (r.entries.length < 2) {
        finishR1();
        return go('r1_reveal');
      }
      return go('r1_vote');
    }
    case 'r1_vote':
      finishR1();
      return go('r1_reveal');
    case 'r1_reveal':
      G.r1i++;
      return G.r1i < R1_ROUNDS ? beginAnimal() : go('r2_intro');
    case 'r2_intro':
      initR2();
      return go('r2_play');
    case 'r2_play':
      finishR2();
      return go('r2_board');
    case 'r2_board':
      return go('r3_intro');
    case 'r3_intro':
      initR3();
      return go('r3_play');
    case 'r3_play':
      finishR3();
      return go('r3_board');
    case 'r3_board':
      return go('r4_intro');
    case 'r4_intro':
      initR4();
      return go('r4_tower');
    case 'r4_tower':
      finishTower();
      return go('r4_scatter');
    case 'r4_scatter':
      G.trivia = pickTrivia();
      G.qi = 0;
      return beginQ();
    case 'r4_q':
      finishQ();
      return go('r4_reveal');
    case 'r4_reveal':
      G.qi++;
      if (G.qi < G.trivia.length) return beginQ();
      makeBoard(10);
      return go('final');
    case 'final':
      return restart();
  }
}

function restart() {
  for (const p of allPlayers()) {
    if (!p.connected) {
      G.players.delete(p.token);
      G.byPid.delete(p.pid);
      continue;
    }
    p.score = 0;
    p.r2 = p.r3 = p.q = null;
    p.team = null;
    p.taps = 0;
  }
  G.prevRanks = {};
  G.board = null;
  go('lobby');
}

// ---------- round 1: אדמה ----------
function beginAnimal() {
  G.r1 = { animal: G.r1animals[G.r1i], names: new Map(), entries: [], votes: new Map(), results: [] };
  go('r1_name');
}

function finishR1() {
  const r = G.r1;
  const counts = new Array(r.entries.length).fill(0);
  for (const idx of r.votes.values()) if (counts[idx] != null) counts[idx]++;
  const max = Math.max(0, ...counts);
  r.results = r.entries
    .map((e, i) => ({ pid: e.pid, text: e.text, votes: counts[i], winner: max > 0 && counts[i] === max }))
    .sort((a, b) => b.votes - a.votes);
  for (const x of r.results) {
    const p = G.byPid.get(x.pid);
    if (!p) continue;
    x.pts = 30 + x.votes * 100 + (x.winner ? 200 : 0);
    x.name = p.name;
    x.avatar = p.avatar;
    p.score += x.pts;
  }
  makeBoard();
}

// ---------- round 2: אכל ----------
const newR2 = () => ({ basket: 0, bomb: rnd(3, 12), eaten: 0, state: 'playing' });
function initR2() {
  G.r2 = {};
  for (const p of allPlayers()) p.r2 = newR2();
}
function finishR2() {
  for (const p of allPlayers()) {
    if (!p.r2) continue;
    if (p.r2.state === 'playing') {
      p.r2.state = p.r2.basket > 0 ? 'greedy' : 'idle';
      p.r2.basket = 0;
    }
  }
  makeBoard();
}

// ---------- round 3: שחת ----------
const newR3 = () => ({ animal: -1, state: 'free', pts: 0 });
function initR3() {
  G.r3 = { waiting: new Array(ARK_COUNT).fill(null), pairs: [], cap: Math.max(1, Math.floor(connected().length * 0.35)), last: '' };
  for (const p of allPlayers()) p.r3 = newR3();
}
function releaseWaiting(p) {
  if (!G.r3 || !p.r3) return;
  for (let i = 0; i < ARK_COUNT; i++) if (G.r3.waiting[i] === p.pid) G.r3.waiting[i] = null;
  if (p.r3.state === 'free') p.r3.animal = -1;
}
function finishR3() {
  for (const p of allPlayers()) {
    if (p.r3 && p.r3.state !== 'boarded') p.r3.state = 'drowned';
  }
  makeBoard();
}

// ---------- round 4: פוץ ----------
const TEAMS = [{ name: 'צוות הלבנים', emoji: '🧱' }, { name: 'צוות החימר', emoji: '🏺' }];
function initR4() {
  const list = shuffle(allPlayers());
  const counts = [0, 0];
  list.forEach((p, i) => {
    p.team = i % 2;
    p.taps = 0;
    p.lastTap = 0;
    counts[p.team]++;
  });
  G.r4 = { bricks: [0, 0], counts, winner: -1 };
}
function finishTower() {
  const [a, b] = G.r4.bricks;
  G.r4.winner = a === b ? -1 : a > b ? 0 : 1;
  for (const p of allPlayers()) {
    p.r4pts = Math.min(p.taps || 0, 100) * 4 + (p.team === G.r4.winner ? 300 : 0);
    p.score += p.r4pts;
  }
  makeBoard();
}
// כל משחק מגריל שאלות מתוך המאגר, מסדר אותן לפי סדר הפרקים בבראשית,
// ומערבב את מקום התשובה הנכונה (אחרת היא תמיד באותה משבצת על המסך הגדול).
function pickTrivia() {
  const n = Math.min(C.TRIVIA_PER_GAME || 6, C.TRIVIA.length);
  const used = new Set();
  const picked = [];
  for (const t of shuffle(C.TRIVIA)) {
    if (picked.length >= n) break;
    if (t.group && used.has(t.group)) continue; // לא שתי שאלות מאותה קבוצה
    if (t.group) used.add(t.group);
    picked.push(t);
  }
  return picked
    .sort((a, b) => a.ch - b.ch || a.v - b.v)
    .map((t) => {
      const order = shuffle([0, 1, 2, 3]);
      return { ...t, options: order.map((i) => t.options[i]), correct: order.indexOf(t.correct) };
    });
}
const srcOf = (q) => ({ ch: q.ch, v: q.v, ref: q.ref, quote: q.quote, note: q.note || '' });
const newQ = () => ({ perm: shuffle([0, 1, 2, 3]), ans: null, pts: 0, correct: false, at: 0 });
function beginQ() {
  G.q = G.trivia[G.qi];
  G.qStats = [0, 0, 0, 0];
  for (const p of allPlayers()) p.q = newQ();
  go('r4_q');
}
function finishQ() {
  for (const p of allPlayers()) {
    if (!p.q) continue;
    if (p.q.ans != null) {
      const orig = p.q.perm[p.q.ans];
      G.qStats[orig]++;
      if (p.q.correct) p.score += p.q.pts;
    }
  }
  makeBoard();
}

// ---------- ensure state for late joiners ----------
function ensure(p) {
  if (G.phase === 'r2_play' && !p.r2) p.r2 = newR2();
  if (G.phase === 'r3_play' && !p.r3) p.r3 = newR3();
  if (G.phase === 'r4_tower' && p.team == null) {
    const c = G.r4.counts;
    p.team = c[0] <= c[1] ? 0 : 1;
    c[p.team]++;
    p.taps = 0;
  }
  if (G.phase === 'r4_q' && !p.q) p.q = newQ();
}

// ---------- early finish ----------
function checkEarly() {
  const ph = G.phase;
  const cp = connected();
  if (!cp.length) return;
  if (ph === 'r1_name' && cp.every((p) => G.r1.names.has(p.pid))) later(ph);
  if (ph === 'r1_vote' && cp.every((p) => G.r1.votes.has(p.pid))) later(ph);
  if (ph === 'r2_play' && cp.every((p) => p.r2 && p.r2.state !== 'playing')) later(ph);
  if (ph === 'r4_q' && cp.every((p) => p.q && p.q.ans != null)) later(ph);
}

// ---------- views ----------
function playerView(p) {
  ensure(p);
  const list = ranking();
  const rank = list.indexOf(p) + 1;
  const ro = G.board && BOARD_PHASES.has(G.phase) ? G.board.rankOf[p.pid] : null;
  const v = {
    phase: G.phase,
    now: now(),
    endsAt: G.endsAt,
    dur: G.dur,
    me: { name: p.name, avatar: p.avatar, score: p.score, rank, total: list.length, delta: ro ? ro.delta : 0 },
  };
  switch (G.phase) {
    case 'r1_name':
      v.animal = G.r1.animal;
      v.myText = G.r1.names.get(p.pid) || '';
      break;
    case 'r1_vote':
      v.entries = G.r1.entries.map((e) => ({ i: e.i, text: e.text, mine: e.pid === p.pid }));
      v.voted = G.r1.votes.has(p.pid) ? G.r1.votes.get(p.pid) : null;
      break;
    case 'r1_reveal': {
      const mine = G.r1.results.find((x) => x.pid === p.pid);
      v.mine = mine ? { text: mine.text, votes: mine.votes, winner: mine.winner, pts: mine.pts } : null;
      break;
    }
    case 'r2_play':
    case 'r2_board':
      // מי שהצטרף בזמן לוח התוצאות לא שיחק בסבב: אין לו מצב, ולא קורסים בגללו
      v.r2 = p.r2 ? { basket: p.r2.basket, state: p.r2.state, eaten: p.r2.eaten } : null;
      break;
    case 'r3_play':
    case 'r3_board':
      v.r3 = p.r3 ? { animal: p.r3.animal, state: p.r3.state, pts: p.r3.pts } : null;
      v.full = G.r3.pairs.length >= G.r3.cap;
      break;
    case 'r4_tower':
      v.team = { idx: p.team, ...TEAMS[p.team] };
      break;
    case 'r4_scatter':
      v.team = { idx: p.team, ...TEAMS[p.team] };
      v.winner = G.r4.winner;
      v.pts = p.r4pts || 0;
      break;
    case 'r4_q':
      v.qn = G.qi + 1;
      v.qtotal = G.trivia.length;
      v.q = { text: G.q.q, options: p.q.perm.map((o) => G.q.options[o]) };
      v.ans = p.q.ans;
      break;
    case 'r4_reveal':
      v.qn = G.qi + 1;
      v.qtotal = G.trivia.length;
      v.src = srcOf(G.q);
      v.answer = G.q.options[G.q.correct];
      if (p.q) {
        v.correctPos = p.q.perm.indexOf(G.q.correct);
        v.ans = p.q.ans;
        v.right = p.q.correct;
        v.pts = p.q.correct ? p.q.pts : 0;
      } else {
        v.ans = null; // הצטרף בזמן החשיפה
      }
      break;
    case 'final':
      v.top = G.board ? G.board.top.slice(0, 3) : [];
      break;
  }
  return v;
}

function hostView() {
  const list = ranking();
  const v = {
    phase: G.phase,
    now: now(),
    endsAt: G.endsAt,
    dur: G.dur,
    n: connected().length,
    live: list.slice(0, 5).map(pub),
    board: BOARD_PHASES.has(G.phase) && G.board ? { top: G.board.top } : null,
  };
  switch (G.phase) {
    case 'lobby':
      v.players = allPlayers().map(pub);
      v.joinUrl = G.joinUrl;
      v.qr = G.qr;
      break;
    case 'r1_name':
      v.animal = G.r1.animal;
      v.submitted = G.r1.names.size;
      v.idx = G.r1i + 1;
      v.of = R1_ROUNDS;
      break;
    case 'r1_vote':
      v.animal = G.r1.animal;
      v.entries = G.r1.entries.map((e) => ({ i: e.i, text: e.text }));
      v.voted = G.r1.votes.size;
      break;
    case 'r1_reveal':
      v.animal = G.r1.animal;
      v.results = G.r1.results.map((x) => ({ text: x.text, name: x.name, avatar: x.avatar, votes: x.votes, winner: x.winner, pts: x.pts }));
      break;
    case 'r2_play':
    case 'r2_board': {
      const st = { playing: 0, banked: 0, out: 0, greedy: 0 };
      for (const p of allPlayers()) {
        if (!p.r2) continue;
        if (p.r2.state === 'playing' || p.r2.state === 'idle') st.playing++;
        else if (st[p.r2.state] != null) st[p.r2.state]++;
      }
      v.stats = st;
      break;
    }
    case 'r3_play':
    case 'r3_board': {
      v.waiting = G.r3.waiting.map((x) => x != null);
      v.pairs = G.r3.pairs.length;
      v.cap = G.r3.cap;
      v.last = G.r3.last;
      let boarded = 0, drowned = 0;
      for (const p of allPlayers()) {
        if (p.r3 && p.r3.state === 'boarded') boarded++;
        if (p.r3 && p.r3.state === 'drowned') drowned++;
      }
      v.boarded = boarded;
      v.drowned = drowned;
      break;
    }
    case 'r4_tower':
      v.bricks = G.r4.bricks;
      v.counts = G.r4.counts;
      v.teams = TEAMS;
      break;
    case 'r4_scatter':
      v.bricks = G.r4.bricks;
      v.winner = G.r4.winner;
      v.teams = TEAMS;
      break;
    case 'r4_q':
      v.qn = G.qi + 1;
      v.qtotal = G.trivia.length;
      v.q = { text: G.q.q, options: G.q.options };
      v.answered = allPlayers().filter((p) => p.q && p.q.ans != null).length;
      break;
    case 'r4_reveal':
      v.qn = G.qi + 1;
      v.qtotal = G.trivia.length;
      v.q = { text: G.q.q, options: G.q.options };
      v.correct = G.q.correct;
      v.dist = G.qStats;
      v.src = srcOf(G.q);
      break;
  }
  return v;
}

function sendPlayer(p) {
  if (p.connected) io.to(p.socketId).emit('view', playerView(p));
}
function pushHost() {
  io.to('host').emit('hview', hostView());
}
function pushAll() {
  for (const p of allPlayers()) sendPlayer(p);
  pushHost();
}
let touchTimer = null;
function touch() {
  if (touchTimer) return;
  touchTimer = setTimeout(() => {
    touchTimer = null;
    pushHost();
  }, 120);
}

// ---------- networking ----------
function lanIp() {
  const nets = os.networkInterfaces();
  const cands = [];
  for (const name of Object.keys(nets)) {
    for (const n of nets[name]) if (n.family === 'IPv4' && !n.internal) cands.push(n.address);
  }
  return cands.find((a) => a.startsWith('192.168.')) || cands.find((a) => a.startsWith('10.')) || cands[0] || 'localhost';
}
async function buildJoin(socket) {
  let url = PUBLIC_URL;
  if (!url) {
    const h = socket.handshake.headers;
    let host = h.host || `localhost:${PORT}`;
    const proto = String(h['x-forwarded-proto'] || 'http').split(',')[0];
    if (/^(localhost|127\.0\.0\.1|\[::1\])/.test(host)) host = `${lanIp()}:${PORT}`;
    url = `${proto}://${host}/`;
  }
  G.joinUrl = url;
  G.qr = await QRCode.toDataURL(url, { margin: 1, width: 520, errorCorrectionLevel: 'M' });
}

io.on('connection', (socket) => {
  const me = () => G.players.get(socket.data.token);
  const isHost = () => socket.data.host === true;

  socket.on('host:hello', async (d, ack) => {
    if (HOST_PIN && (!d || d.pin !== HOST_PIN)) return ack && ack({ ok: false });
    socket.data.host = true;
    socket.join('host');
    try {
      await buildJoin(socket);
    } catch (e) {
      console.error('qr failed', e);
    }
    ack && ack({ ok: true });
    pushHost();
  });
  socket.on('host:next', () => {
    if (isHost()) advance();
  });
  socket.on('host:restart', () => {
    if (isHost()) restart();
  });

  socket.on('join', (d, ack) => {
    d = d || {};
    let p = d.token && G.players.get(d.token);
    if (p) {
      p.socketId = socket.id;
      p.connected = true;
    } else {
      let name = String(d.name || '').replace(/\s+/g, ' ').trim().slice(0, 14);
      if (!name) return ack && ack({ ok: false });
      // שני שחקנים עם אותו שם מבלבלים את הלוח: "נועה" השני הופך ל"נועה 2"
      const taken = new Set(connected().map((x) => x.name));
      if (taken.has(name)) {
        let i = 2;
        while (taken.has(`${name.slice(0, 11)} ${i}`)) i++;
        name = `${name.slice(0, 11)} ${i}`;
      }
      const token = crypto.randomUUID();
      p = { token, pid: G.nextPid++, name, avatar: nextAvatar(), score: 0, socketId: socket.id, connected: true, r2: null, r3: null, q: null, team: null, taps: 0 };
      G.players.set(token, p);
      G.byPid.set(p.pid, p);
    }
    socket.data.token = p.token;
    ack && ack({ ok: true, token: p.token, name: p.name });
    sendPlayer(p);
    touch();
  });

  socket.on('disconnect', () => {
    if (socket.data.host) return;
    const p = me();
    if (!p || p.socketId !== socket.id) return;
    p.connected = false;
    if (G.phase === 'lobby') {
      G.players.delete(p.token);
      G.byPid.delete(p.pid);
    }
    if (G.phase === 'r3_play') releaseWaiting(p);
    touch();
    checkEarly();
  });

  // --- round 1
  socket.on('r1:name', (t) => {
    const p = me();
    if (!p || G.phase !== 'r1_name') return;
    t = String(t || '').trim().slice(0, 24);
    if (!t) return;
    G.r1.names.set(p.pid, t);
    sendPlayer(p);
    touch();
    checkEarly();
  });
  socket.on('r1:vote', (i) => {
    const p = me();
    if (!p || G.phase !== 'r1_vote') return;
    const e = G.r1.entries[i];
    if (!e || e.pid === p.pid) return;
    G.r1.votes.set(p.pid, i);
    sendPlayer(p);
    touch();
    checkEarly();
  });

  // --- round 2
  socket.on('r2:eat', () => {
    const p = me();
    if (!p || G.phase !== 'r2_play') return;
    ensure(p);
    const s = p.r2;
    if (s.state !== 'playing') return;
    s.eaten++;
    if (s.eaten >= s.bomb) {
      s.state = 'out';
      s.basket = 0;
      p.score = Math.max(0, p.score - 100);
    } else {
      s.basket += 100;
    }
    sendPlayer(p);
    touch();
    checkEarly();
  });
  socket.on('r2:stop', () => {
    const p = me();
    if (!p || G.phase !== 'r2_play') return;
    ensure(p);
    const s = p.r2;
    if (s.state !== 'playing' || s.basket <= 0) return;
    p.score += s.basket;
    s.basket = 0;
    s.state = 'banked';
    sendPlayer(p);
    touch();
    checkEarly();
  });

  // --- round 3
  socket.on('r3:pick', (idx) => {
    const p = me();
    if (!p || G.phase !== 'r3_play') return;
    ensure(p);
    idx = Number(idx);
    if (!(idx >= 0 && idx < ARK_COUNT)) return;
    const r = G.r3;
    const s = p.r3;
    if (s.state !== 'free' || r.pairs.length >= r.cap || s.animal === idx) return;
    releaseWaiting(p);
    const otherPid = r.waiting[idx];
    const other = otherPid != null ? G.byPid.get(otherPid) : null;
    if (other && other.connected && other.r3 && other.r3.state === 'free') {
      const n = r.pairs.length;
      const pts = Math.max(150, 1000 - 50 * n);
      for (const q of [p, other]) {
        q.r3.state = 'boarded';
        q.r3.animal = idx;
        q.r3.pts = pts;
        q.score += pts;
      }
      r.pairs.push([p.pid, other.pid]);
      r.waiting[idx] = null;
      r.last = `${p.avatar} ${p.name} + ${other.avatar} ${other.name} עלו לתיבה!`;
      sendPlayer(other);
      if (r.pairs.length >= r.cap) later('r3_play', 1500);
    } else {
      s.animal = idx;
      r.waiting[idx] = p.pid;
    }
    sendPlayer(p);
    touch();
  });

  // --- round 4
  socket.on('r4:tap', (n) => {
    const p = me();
    if (!p || G.phase !== 'r4_tower') return;
    ensure(p);
    const t = now();
    const dt = Math.min(1, Math.max(0.05, (t - (p.lastTap || t - 100)) / 1000));
    p.lastTap = t;
    n = Math.min(Math.floor(Number(n) || 0), Math.ceil(14 * dt));
    if (n <= 0) return;
    p.taps += n;
    G.r4.bricks[p.team] += n;
    touch();
  });
  socket.on('r4:ans', (i) => {
    const p = me();
    if (!p || G.phase !== 'r4_q') return;
    ensure(p);
    i = Number(i);
    if (p.q.ans != null || !(i >= 0 && i < 4)) return;
    p.q.ans = i;
    p.q.correct = p.q.perm[i] === G.q.correct;
    const left = Math.max(0, G.endsAt - now()) / G.dur;
    p.q.pts = p.q.correct ? 400 + Math.round(600 * left) : 0;
    sendPlayer(p);
    touch();
    checkEarly();
  });
});

server.listen(PORT, () => {
  console.log(`\n  בראשית: המשחק רץ!`);
  console.log(`  מסך מארח:   http://localhost:${PORT}/host`);
  console.log(`  שחקנים:     http://${lanIp()}:${PORT}/  (אותה רשת Wi-Fi)\n`);
});
