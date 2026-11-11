/* בראשית: המשחק — מסך המארח (על המקרן) */
(function () {
  'use strict';
  const { el, verse, ROUNDS, ARK, Q, fmt, plus, heb } = B;
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const socket = io();

  let view = null;   // התצוגה האחרונה מהשרת
  let screen = null; // { node, update(v) } של השלב הנוכחי
  let lastKey = '';

  // ---------- חיבור ----------
  function hello() {
    const pin = sessionStorage.getItem('bereshit-pin') || new URLSearchParams(location.search).get('pin') || '';
    socket.emit('host:hello', { pin }, (a) => {
      if (a && a.ok) return;
      const p = prompt('קוד המארח (HOST_PIN):');
      if (p == null) return;
      sessionStorage.setItem('bereshit-pin', p);
      hello();
    });
  }
  socket.on('connect', () => { $('conn').classList.add('hidden'); hello(); });
  socket.on('disconnect', () => $('conn').classList.remove('hidden'));
  socket.on('hview', (v) => { B.sync(v); render(v); });

  // ---------- שליטה ----------
  const next = () => { FX.unlock(); socket.emit('host:next'); };
  $('next').addEventListener('click', (e) => { e.currentTarget.blur(); next(); });
  $('restart').addEventListener('click', (e) => {
    e.currentTarget.blur();
    if (confirm('להתחיל משחק חדש? כל הניקוד יתאפס.')) socket.emit('host:restart');
  });
  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  };
  $('full').addEventListener('click', (e) => { e.currentTarget.blur(); fullscreen(); });
  const muteBtn = $('mute');
  const showMute = () => { muteBtn.textContent = FX.sound.muted ? '🔇' : '🔊'; };
  muteBtn.addEventListener('click', (e) => { e.currentTarget.blur(); FX.sound.toggle(); showMute(); });
  showMute();
  document.addEventListener('keydown', (e) => {
    if (e.target.matches && e.target.matches('input, textarea')) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowLeft') {
      e.preventDefault();
      if (!$('next').disabled) next();
    } else if (e.key === 'f' || e.key === 'F' || e.key === 'כ') fullscreen();
    else if (e.key === 'm' || e.key === 'M' || e.key === 'צ') { FX.sound.toggle(); showMute(); }
  });

  // ---------- טיימר ----------
  const ring = $('timer');
  const prog = ring.querySelector('.prog');
  const CIRC = 2 * Math.PI * 44;
  prog.style.strokeDasharray = CIRC;
  let lastSec = -1;
  function tickTimer() {
    if (!view || !view.endsAt) { ring.classList.add('hidden'); return; }
    ring.classList.remove('hidden');
    const ms = B.left(view);
    const s = Math.ceil(ms / 1000);
    ring.querySelector('span').textContent = s;
    prog.style.strokeDashoffset = CIRC * (1 - ms / (view.dur || 1));
    ring.classList.toggle('low', s <= 5);
    if (s !== lastSec) { if (s > 0 && s <= 5) FX.sound.tick(); lastSec = s; }
  }
  setInterval(tickTimer, 200);

  // ---------- ציור ----------
  // מפתח שמשתנה כשצריך מסך חדש. אותו שלב עם נתונים חדשים = רק עדכון.
  function keyOf(v) {
    if (v.phase === 'r1_name' || v.phase === 'r1_vote' || v.phase === 'r1_reveal') return v.phase + ':' + (v.animal && v.animal.cap);
    if (v.phase === 'r4_q' || v.phase === 'r4_reveal') return v.phase + ':' + v.qn;
    return v.phase;
  }

  function render(v) {
    const prev = view;
    view = v;
    const round = B.ROUND_OF[v.phase] || 0;
    document.body.className = 'host theme-' + (round ? 'r' + round : v.phase === 'final' ? 'final' : 'lobby');
    $('players').textContent = '👥 ' + v.n;
    const chip = $('roundChip');
    chip.classList.toggle('hidden', !round);
    if (round) chip.textContent = `סבב ${round} · ${ROUNDS[round].word} ${ROUNDS[round].icon}`;

    const b = $('next');
    b.textContent = v.phase === 'lobby' ? 'התחילו ←' : v.phase === 'final' ? 'משחק חדש ↺' : v.endsAt ? 'דלגו ⏭' : 'הבא ←';
    b.disabled = v.phase === 'lobby' && !(v.players && v.players.length);

    const key = keyOf(v);
    if (key !== lastKey) {
      lastKey = key;
      screen = (SCREENS[v.phase] || SCREENS.unknown)(v);
      stage.replaceChildren(screen.node);
      onEnter(v, prev);
    }
    if (screen.update) screen.update(v);
    tickTimer();
  }

  function onEnter(v) {
    const ph = v.phase;
    if (ph.endsWith('_intro')) FX.sound.gong();
    else if (ph === 'r1_reveal' || ph === 'r2_board' || ph === 'r3_board' || ph === 'r4_scatter') FX.sound.win();
    else if (ph === 'r4_reveal') FX.sound.pop();
    else if (ph === 'final') { FX.sound.win(); FX.confetti(6000); }
  }

  // ---------- רכיבים ----------
  function head(title, sub) {
    return el('div', { class: 'phase-head enter' },
      el('div', { class: 'grow' }, el('h2', null, title), sub ? el('div', { class: 'sub' }, sub) : null));
  }

  function boardPanel(v, title) {
    const top = (v.board && v.board.top) || [];
    return el('div', { class: 'board panel enter' },
      el('h3', null, title || 'טבלת המובילים'),
      top.length ? el('ol', null, top.map((p, i) => el('li', { style: `animation-delay:${i * 70}ms` },
        el('span', { class: 'rk' }, i + 1),
        el('span', { class: 'avatar' }, p.avatar),
        el('span', { class: 'nm' }, p.name),
        el('span', { class: 'sc' }, fmt(p.score)),
        el('span', { class: 'dl ' + (p.delta > 0 ? 'up' : p.delta < 0 ? 'down' : '') },
          p.delta > 0 ? `▲${p.delta}` : p.delta < 0 ? `▼${-p.delta}` : '')))) : el('div', { class: 'muted' }, 'עוד אין ניקוד'));
  }

  function stat(n, label, cls) {
    const num = el('div', { class: 'n' }, n);
    const node = el('div', { class: 'stat panel ' + (cls || '') }, num, el('div', { class: 'l' }, label));
    return { node, set: (x) => { num.textContent = x; } };
  }

  function link929(ch) {
    return el('a', { href: B.link929(ch), target: '_blank', rel: 'noopener' }, `בראשית פרק ${heb(ch)} ב-929`);
  }

  // ---------- המסכים ----------
  const SCREENS = {};

  SCREENS.unknown = (v) => ({ node: el('div', { class: 'center' }, el('h2', null, v.phase)) });

  SCREENS.lobby = () => {
    const count = el('b', null, '0');
    const list = el('div', { class: 'players' });
    const img = el('img', { alt: 'קוד QR להצטרפות' });
    const url = el('div', { class: 'url' });
    const waiting = el('div', { class: 'muted' }, 'מחכים לשחקנים… סרקו את הקוד בטלפון 📱');
    const node = el('div', { class: 'lobby' },
      el('div', { class: 'hero enter' },
        el('h1', null, 'בראשית: ', el('span', null, 'המשחק')),
        verse(Q.open),
        el('div', { class: 'count-big' }, count, ' שחקנים הצטרפו'),
        waiting,
        list),
      el('div', { class: 'qr panel pop' }, img, el('div', { class: 'muted', style: 'margin-top:.6em' }, 'סרקו כדי להצטרף'), url));
    let sig = '';
    return {
      node,
      update(v) {
        if (v.qr && img.getAttribute('src') !== v.qr) img.src = v.qr;
        url.textContent = (v.joinUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
        const players = v.players || [];
        count.textContent = players.length;
        waiting.classList.toggle('hidden', players.length > 0);
        const s = players.map((p) => p.pid).join(',');
        if (s !== sig) {
          sig = s;
          list.replaceChildren(...players.map((p) => el('span', { class: 'chip' }, el('span', { class: 'avatar' }, p.avatar), p.name)));
          if (players.length) FX.sound.pop();
        }
      },
    };
  };

  function intro(n) {
    return () => {
      const R = ROUNDS[n];
      return {
        node: el('div', { class: 'center intro' },
          el('div', { class: 'num enter' }, `סבב ${n} מתוך 4`),
          el('h1', { class: 'word pop' }, R.word, el('span', { class: 'ico' }, R.icon)),
          el('div', { class: 't929 enter' }, `״${R.title929}״ · `, link929(R.ch)),
          el('div', { class: 'verses enter', style: 'animation-delay:.15s' }, R.verses.map((q) => verse(q))),
          el('div', { class: 'how enter', style: 'animation-delay:.3s' },
            R.how.map((t, i) => el('div', { class: 'panel' }, el('b', null, i + 1), t)))),
      };
    };
  }
  SCREENS.r1_intro = intro(1);
  SCREENS.r2_intro = intro(2);
  SCREENS.r3_intro = intro(3);
  SCREENS.r4_intro = intro(4);

  // ----- סבב 1: אדמה -----
  SCREENS.r1_name = (v) => {
    const sent = el('b', null, '0');
    const total = el('span', null, '0');
    return {
      node: el('div', { class: 'center' },
        head(`תנו לחיה שם! (${v.idx} מתוך ${v.of})`, 'כתבו בטלפון את השם הכי מצחיק שאתם יכולים'),
        el('div', { class: 'animal-card panel pop' },
          el('div', { class: 'em' }, v.animal.emoji), el('div', { class: 'cap' }, v.animal.cap)),
        el('div', { class: 'progress-line' }, sent, ' מתוך ', total, ' שלחו שם')),
      update(x) { sent.textContent = x.submitted; total.textContent = x.n; },
    };
  };

  SCREENS.r1_vote = (v) => {
    const voted = el('b', null, '0');
    const total = el('span', null, '0');
    return {
      node: el('div', { class: 'center' },
        head('הצביעו לשם הכי טוב!', 'בטלפון. אי אפשר להצביע לשם של עצמכם'),
        el('div', { style: 'font-size:3.6em' }, v.animal.emoji),
        el('div', { class: 'entries' }, v.entries.map((e, i) => el('div', { class: 'entry panel', style: `animation-delay:${i * 60}ms` }, e.text))),
        el('div', { class: 'progress-line' }, voted, ' מתוך ', total, ' הצביעו')),
      update(x) { voted.textContent = x.voted; total.textContent = x.n; },
    };
  };

  SCREENS.r1_reveal = (v) => {
    const all = v.results || [];
    const rs = all.slice(0, 8); // עם כיתה שלמה הרשימה לא נכנסת במסך — מציגים את 8 המובילים
    return {
      node: el('div', { class: 'board-wrap' },
        el('div', { class: 'center' },
          head(`${v.animal.emoji} והשם הוא…`, v.animal.cap),
          rs.length
            ? el('div', { class: 'results' + (rs.length > 4 ? ' two' : '') }, rs.map((x, i) => el('div', { class: 'result panel' + (x.winner ? ' win' : ''), style: `animation-delay:${i * 90}ms` },
                el('span', { class: 'crown' }, x.winner ? '👑' : x.avatar),
                el('div', null, el('div', { class: 'txt' }, x.text), el('div', { class: 'who' }, `${x.avatar} ${x.name}`)),
                el('span', { class: 'votes' }, `${x.votes} 🗳️`),
                el('span', { class: 'muted' }, plus(x.pts)))))
            : el('div', { class: 'muted', style: 'font-size:1.4em' }, 'אף אחד לא שלח שם הפעם 🤷'),
          all.length > rs.length ? el('div', { class: 'muted' }, `ועוד ${all.length - rs.length} שמות`) : null,
          verse(Q.r1b)),
        boardPanel(v)),
    };
  };

  // ----- סבב 2: אכל -----
  function gardenStats(withGreedy) {
    const s = {
      playing: stat(0, 'עדיין בגן 😋', 'good'),
      banked: stat(0, 'עצרו ושמרו 🧺'),
      out: stat(0, 'גורשו מהגן 🚪', 'bad'),
      greedy: stat(0, 'הסל אבד ⌛', 'warn'),
    };
    const grid = el('div', { class: 'garden-stats', style: withGreedy ? '' : 'grid-template-columns:repeat(3,1fr)' },
      s.playing.node, s.banked.node, s.out.node, withGreedy ? s.greedy.node : null);
    return { grid, set: (st) => { for (const k of Object.keys(s)) s[k].set((st && st[k]) || 0); } };
  }

  SCREENS.r2_play = () => {
    const gs = gardenStats(false);
    return {
      node: el('div', { class: 'center' },
        head('אִכלו מעצי הגן!', 'כל פרי = 100 לסל. אבל אחד העצים הוא עץ הדעת… עִצרו בזמן!'),
        el('div', { class: 'trees pop' }, '🌳🌴🌳', el('span', { class: 'forbidden' }, '🌳'), '🌲🌳'),
        verse(Q.r2b),
        gs.grid),
      update(x) { gs.set(x.stats); },
    };
  };

  SCREENS.r2_board = (v) => {
    const gs = gardenStats(true);
    gs.set(v.stats);
    return {
      node: el('div', { class: 'board-wrap' },
        el('div', { class: 'center' }, head('סוף הסבב בגן עדן', 'מי עצר בזמן — ומי התפתה?'), gs.grid, verse(Q.r2out)),
        boardPanel(v)),
    };
  };

  // ----- סבב 3: שחת -----
  SCREENS.r3_play = () => {
    const slots = ARK.map((a) => el('div', { class: 'ark-slot panel' },
      el('div', { class: 'e' }, a.e), el('div', { class: 'n' }, a.name), el('div', { class: 'q' }, a.ref)));
    const fill = el('div', { class: 'fill', style: 'width:0%' });
    const pairs = el('b', null, '0');
    const cap = el('span', null, '0');
    const last = el('div', { class: 'ark-last' });
    const full = el('div', { class: 'hidden' }, verse(Q.r3full));
    const node = el('div', { class: 'center' },
      head('שְׁנַיִם שְׁנַיִם — מצאו בן זוג!', 'בחרו חיה בטלפון. מי שבוחר את אותה חיה עולה איתכם לתיבה'),
      el('div', { class: 'ark-meter' }, el('span', { style: 'font-size:2em' }, '🚢'), el('div', { class: 'bar' }, fill),
        el('span', { class: 'progress-line' }, pairs, ' / ', cap, ' זוגות')),
      el('div', { class: 'ark-grid' }, slots),
      last, full);
    let lastMsg = '';
    return {
      node,
      update(x) {
        (x.waiting || []).forEach((w, i) => slots[i] && slots[i].classList.toggle('waiting', !!w));
        pairs.textContent = x.pairs;
        cap.textContent = x.cap;
        fill.style.width = Math.min(100, (100 * x.pairs) / Math.max(1, x.cap)) + '%';
        if (x.last && x.last !== lastMsg) {
          lastMsg = x.last;
          last.textContent = '🛶 ' + x.last;
          last.classList.remove('pop'); void last.offsetWidth; last.classList.add('pop');
          FX.sound.pop();
        }
        full.classList.toggle('hidden', x.pairs < x.cap);
      },
    };
  };

  SCREENS.r3_board = (v) => {
    const a = stat(v.boarded, 'עלו לתיבה 🚢', 'good');
    const b = stat(v.drowned, 'נשארו בחוץ 🌊', 'bad');
    return {
      node: el('div', { class: 'board-wrap' },
        el('div', { class: 'center' }, head('המבול', 'רק מי שמצא בן זוג עלה לתיבה'),
          el('div', { class: 'garden-stats', style: 'grid-template-columns:1fr 1fr;max-width:34em' }, a.node, b.node),
          verse(Q.r3end)),
        boardPanel(v)),
    };
  };

  // ----- סבב 4: פוץ -----
  function towers(v, small) {
    const max = () => Math.max(60, ...(view.bricks || [0, 0]));
    const cols = [0, 1].map((i) => {
      const col = el('div', { class: 'col', style: `--tc:${B.TEAM_COLORS[i]};height:0%` });
      const n = el('div', { class: 'n' }, '0');
      const ppl = el('div', { class: 'muted' });
      const t = v.teams[i];
      const node = el('div', { class: 'tower' }, n, el('div', { class: 'stack', style: small ? 'height:30vh' : '' }, col),
        el('div', { class: 'tn' }, `${t.emoji} ${t.name}`), ppl);
      return { node, col, n, ppl };
    });
    const wrap = el('div', { class: 'towers' }, cols.map((c) => c.node));
    return {
      wrap,
      set(x) {
        const m = max();
        cols.forEach((c, i) => {
          const b = (x.bricks || [0, 0])[i];
          c.n.textContent = fmt(b);
          c.col.style.height = Math.min(100, (100 * b) / m) + '%';
          if (x.counts) c.ppl.textContent = `${x.counts[i]} בונים`;
          c.node.classList.toggle('win', x.winner === i);
        });
      },
    };
  }

  SCREENS.r4_tower = (v) => {
    const t = towers(v);
    return {
      node: el('div', { class: 'center' }, head('בנו את המגדל!', 'לחצו הכי מהר שאפשר — כל לחיצה היא לבנה'), t.wrap, verse(Q.r4b)),
      update: (x) => t.set(x),
    };
  };

  SCREENS.r4_scatter = (v) => {
    const t = towers(v, true);
    const win = v.winner === -1 ? 'תיקו! שני המגדלים באותו גובה' : `${v.teams[v.winner].emoji} ${v.teams[v.winner].name} ניצח!`;
    return {
      node: el('div', { class: 'board-wrap' },
        el('div', { class: 'center' }, head(win, 'אבל אף מגדל לא הושלם…'), t.wrap, verse(Q.r4scatter)),
        boardPanel(v)),
      update: (x) => t.set(x),
    };
  };

  const LETTERS = ['א', 'ב', 'ג', 'ד'];

  SCREENS.r4_q = (v) => {
    const ans = el('b', null, '0');
    const total = el('span', null, '0');
    return {
      node: el('div', { class: 'center' },
        head(`שאלה ${v.qn} מתוך ${v.qtotal}`, 'ענו בטלפון — מהר יותר = יותר נקודות'),
        el('div', { class: 'question pop' }, v.q.text),
        el('div', { class: 'options' }, v.q.options.map((o, i) => el('div', { class: 'option panel enter', style: `animation-delay:${i * 80}ms` },
          el('span', { class: 'letter' }, LETTERS[i]), el('span', null, o)))),
        el('div', { class: 'progress-line' }, ans, ' מתוך ', total, ' ענו')),
      update(x) { ans.textContent = x.answered; total.textContent = x.n; },
    };
  };

  SCREENS.r4_reveal = (v) => {
    const sum = (v.dist || []).reduce((a, b) => a + b, 0);
    const src = v.src || {};
    return {
      node: el('div', { class: 'board-wrap' },
        el('div', { class: 'center', style: 'gap:.9em' },
          el('div', { class: 'question', style: 'font-size:1.9em' }, v.q.text),
          el('div', { class: 'options' }, v.q.options.map((o, i) => el('div', { class: 'option panel ' + (i === v.correct ? 'right' : 'fade') },
            el('span', { class: 'letter' }, i === v.correct ? '✓' : LETTERS[i]), el('span', null, o),
            el('span', { class: 'dist' }, sum ? `${v.dist[i]} 👤` : '')))),
          el('div', { class: 'src panel enter', style: 'animation-delay:.25s' },
            verse({ quote: src.quote, ref: src.ref }),
            src.note ? el('div', { class: 'note' }, src.note) : null,
            el('div', { class: 'note' }, link929(src.ch)))),
        boardPanel(v)),
    };
  };

  SCREENS.final = (v) => {
    const top = (v.board && v.board.top) || [];
    const place = (p, cls, medal) => p
      ? el('div', { class: 'p ' + cls }, el('div', { class: 'who' }, el('span', { class: 'av' }, p.avatar), p.name),
          el('div', { class: 'block' }, medal, el('span', { class: 'sc' }, fmt(p.score) + ' נק׳')))
      : el('div', { class: 'p ' + cls });
    const rest = top.slice(3);
    return {
      node: el('div', { class: 'center' },
        el('h1', { class: 'pop', style: 'font-size:3.4em' }, 'סוף המשחק!'),
        verse(Q.final),
        el('div', { class: 'podium' }, place(top[1], 'p2', '🥈'), place(top[0], 'p1', '🏆'), place(top[2], 'p3', '🥉')),
        rest.length ? el('div', { class: 'players', style: 'justify-content:center' },
          rest.map((p, i) => el('span', { class: 'chip' }, `${i + 4}. ${p.avatar} ${p.name} · ${fmt(p.score)}`))) : null,
        el('div', { class: 'read929' }, 'רוצים לקרוא את הסיפורים במקור? ',
          el('a', { href: B.link929(1), target: '_blank', rel: 'noopener' }, 'ספר בראשית באתר 929'), ' — פרק ביום.')),
    };
  };
})();
