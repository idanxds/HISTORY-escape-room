/* בראשית: המשחק — הטלפון של השחקן.
 * ההסברים מופיעים על המסך הגדול. בטלפון: רק הכפתורים והדרך לבצע את המשימה. */
(function () {
  'use strict';
  const { el, ROUNDS, ARK, FRUITS, MATERIALS, fmt, plus, rankText } = B;
  const $ = (id) => document.getElementById(id);
  const scr = $('screen');
  const socket = io();

  const store = {
    get: (k) => { try { return localStorage.getItem('bereshit-' + k) || ''; } catch (e) { return ''; } },
    set: (k, v) => { try { localStorage.setItem('bereshit-' + k, v); } catch (e) { /* פרטי */ } },
    del: (k) => { try { localStorage.removeItem('bereshit-' + k); } catch (e) { /* */ } },
  };

  let joined = false;
  let view = null;
  let screen = null;
  let lastKey = '';
  const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* */ } };

  // ---------- כניסה ----------
  function join(name) {
    socket.emit('join', { token: store.get('token'), name }, (a) => {
      if (a && a.ok) {
        joined = true;
        store.set('token', a.token);
        store.set('name', a.name || name);
        keepAwake();
      } else {
        joined = false;
        store.del('token');
        showJoin(name ? 'משהו השתבש. נסו שוב.' : '');
      }
    });
  }

  function nameForm(label, value, onSubmit) {
    const input = el('input', { maxlength: 14, placeholder: 'השם שלכם', autocomplete: 'nickname', enterkeyhint: 'go', 'aria-label': 'השם שלכם' });
    input.value = value || '';
    const msg = el('div', { class: 'err' });
    const go = () => {
      const n = input.value.replace(/\s+/g, ' ').trim();
      if (!n) { msg.textContent = 'צריך לכתוב שם 🙂'; input.focus(); return; }
      FX.unlock();
      onSubmit(n, msg);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    return { input, msg, node: el('div', { class: 'form' }, input, el('button', { class: 'btn', onclick: go }, label), msg) };
  }

  function showJoin(err) {
    lastKey = 'join';
    if (screen && screen.destroy) screen.destroy();
    screen = null;
    $('me').classList.add('hidden');
    document.body.className = 'play theme-lobby';
    const f = nameForm('הצטרפו למשחק ←', store.get('name'), (n) => join(n));
    f.msg.textContent = err || '';
    scr.replaceChildren(el('div', { class: 'join enter' },
      el('div', { class: 'big-em' }, '🌍'),
      el('h1', null, 'בראשית: ', el('span', null, 'המשחק')),
      f.node));
  }

  socket.on('connect', () => {
    $('conn').classList.add('hidden');
    const name = store.get('name');
    if (store.get('token') || name) join(name);
    else showJoin();
  });
  socket.on('disconnect', () => { if (joined) $('conn').classList.remove('hidden'); });
  socket.on('view', (v) => { B.sync(v); render(v); });

  // מסך דולק במהלך המשחק (נתמך רק ב-https)
  let lock = null;
  async function keepAwake() {
    try { if ('wakeLock' in navigator && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } } catch (e) { /* לא נתמך */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && joined) keepAwake(); });

  // ---------- ציור ----------
  function keyOf(v) {
    switch (v.phase) {
      case 'r1_name': return v.phase + ':' + (v.animal && v.animal.cap);
      case 'r1_vote': return v.phase + ':' + (v.entries || []).map((e) => e.i + e.text).join('|');
      case 'r2_play': return v.phase + ':' + (v.r2 ? v.r2.state : '-');
      case 'r3_play': return v.phase + ':' + (v.r3 ? v.r3.state : '-') + ':' + v.full;
      case 'r4_q':
      case 'r4_reveal': return v.phase + ':' + v.qn;
      default: return v.phase;
    }
  }

  function render(v) {
    view = v;
    const round = B.ROUND_OF[v.phase] || 0;
    document.body.className = 'play theme-' + (round ? 'r' + round : v.phase === 'final' ? 'final' : 'lobby');
    $('me').classList.remove('hidden');
    $('meAv').textContent = v.me.avatar;
    $('meName').textContent = v.me.name;
    $('meScore').textContent = fmt(v.me.score);
    const key = keyOf(v);
    if (key !== lastKey) {
      if (screen && screen.destroy) screen.destroy();
      lastKey = key;
      screen = (SCREENS[v.phase] || SCREENS.unknown)(v);
      scr.replaceChildren(screen.node);
      window.scrollTo(0, 0);
    }
    if (screen.update) screen.update(v);
  }

  // מסך המתנה קצר: אייקון + כותרת + שורה אחת לכל היותר
  function card(icon, title, sub) {
    return el('div', { class: 'wait enter' },
      el('div', { class: 'big-em pop' }, icon),
      el('h2', null, title),
      sub ? el('div', { class: 'lead' }, sub) : null);
  }

  function rankLine(v) {
    const d = v.me.delta;
    return el('div', { class: 'lead muted' }, rankText(v.me.rank, v.me.total),
      d > 0 ? el('span', { class: 'delta-up' }, ` ▲${d}`) : d < 0 ? el('span', { class: 'delta-down' }, ` ▼${-d}`) : null);
  }

  const watch = () => el('div', { class: 'look' }, 'הסתכלו על המסך הגדול');

  // ---------- המסכים ----------
  const SCREENS = {};

  SCREENS.unknown = () => ({ node: card('⏳', 'רגע…') });

  // לובי: שינוי שם משנה את אותו שחקן (לא יוצר שחקן חדש)
  SCREENS.lobby = (v) => {
    const name = el('div', { class: 'lead', style: 'font-weight:700' }, v.me.name);
    const editBox = el('div', { class: 'hidden', style: 'width:100%' });
    const edit = el('button', { class: 'btn ghost small', onclick: () => {
      const f = nameForm('שמרו שם חדש', '', (n, msg) => {
        socket.emit('rename', { name: n }, (a) => {
          if (a && a.ok) { store.set('name', a.name); editBox.classList.add('hidden'); edit.classList.remove('hidden'); }
          else msg.textContent = 'לא הצלחנו לשנות. נסו שוב.';
        });
      });
      editBox.replaceChildren(f.node);
      editBox.classList.remove('hidden');
      edit.classList.add('hidden');
      f.input.focus();
    } }, '✏️ שינוי שם');
    return {
      node: el('div', { class: 'wait enter' },
        el('div', { class: 'big-em pop' }, v.me.avatar),
        el('h1', null, 'אתם בפנים!'),
        name, edit, editBox,
        el('div', { class: 'lead muted' }, 'מחכים שהמשחק יתחיל…')),
      update(x) { name.textContent = x.me.name; },
    };
  };

  function intro(n) {
    return () => {
      const R = ROUNDS[n];
      return { node: el('div', { class: 'wait enter' },
        el('div', { class: 'faint' }, `סבב ${n} מתוך 4`),
        el('h1', { class: 'pop', style: 'font-size:3.4em' }, R.word, ' ', R.icon),
        watch()) };
    };
  }
  SCREENS.r1_intro = intro(1);
  SCREENS.r2_intro = intro(2);
  SCREENS.r3_intro = intro(3);
  SCREENS.r4_intro = intro(4);

  // ----- סבב 1: שולחים שם פעם אחת, והוא לא מוצג שוב בטלפון -----
  SCREENS.r1_name = (v) => {
    const input = el('input', { class: 'name-input', maxlength: 24, placeholder: 'השם שלכם…', enterkeyhint: 'send', 'aria-label': 'השם המצחיק שלכם' });
    const btn = el('button', { class: 'btn' }, 'שלחו');
    const form = el('div', { class: 'form enter' }, input, btn);
    const done = el('div', { class: 'hidden' }, card('✅', 'נשלח!', 'מחכים לכולם…'));
    const send = () => {
      const s = input.value.trim();
      if (!s) { input.focus(); return; }
      socket.emit('r1:name', s);
      input.value = '';
      input.blur();
      form.classList.add('hidden'); // מסתירים מיד, גם לפני שהשרת עונה
      done.classList.remove('hidden');
      buzz(20);
    };
    btn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    return {
      node: el('div', { class: 'stack' }, form, done),
      update(x) { if (x.sent) { form.classList.add('hidden'); done.classList.remove('hidden'); } },
    };
  };

  SCREENS.r1_vote = (v) => {
    const others = v.entries.filter((e) => !e.mine);
    const btns = others.map((e) => el('button', { onclick: () => { socket.emit('r1:vote', e.i); buzz(20); } }, e.text));
    return {
      node: others.length ? el('div', { class: 'vote-list enter' }, btns) : card('🙂', 'אין שמות להצביע להם'),
      update(x) { others.forEach((e, i) => btns[i].classList.toggle('on', x.voted === e.i)); },
    };
  };

  SCREENS.r1_reveal = (v) => {
    const m = v.mine;
    if (!m) return { node: el('div', { class: 'stack' }, card('🤐', 'לא שלחתם שם הפעם'), rankLine(v)) };
    return { node: el('div', { class: 'stack' },
      card(m.winner ? '👑' : '🗳️', m.winner ? 'השם שלכם ניצח!' : `${m.votes} קולות`),
      el('div', { class: 'pts' }, plus(m.pts)), rankLine(v)) };
  };

  // ----- סבב 2: הגן — 9 עצים, אחד מהם עץ הדעת -----
  function garden(r, clickable) {
    const size = r.size || 9;
    const cells = Array.from({ length: size }, (_, i) => {
      const picked = r.picked.includes(i);
      const isBomb = i === r.bomb;
      const b = el('button', { class: 'tree' + (picked ? ' picked' : '') + (isBomb ? ' bomb' : ''), disabled: !clickable || picked },
        picked ? (isBomb ? '🐍' : FRUITS[i % FRUITS.length]) : isBomb ? '❓' : '🌳');
      if (clickable && !picked) b.addEventListener('click', () => { socket.emit('r2:eat', i); buzz(12); b.disabled = true; });
      return b;
    });
    return el('div', { class: 'garden' }, cells);
  }

  SCREENS.r2_play = (v) => {
    const r = v.r2;
    if (!r) return { node: card('🌳', 'תצטרפו בסבב הבא!') };
    if (r.state === 'banked') return { node: el('div', { class: 'stack' }, card('🧺', 'שמרתם!', plus(r.eaten * 100)), garden(r, false)) };
    if (r.state === 'out') {
      buzz([80, 60, 160]);
      return { node: el('div', { class: 'stack expelled' }, card('🚪', 'עץ הדעת!', 'גורשתם מהגן'), garden(r, false)) };
    }
    const basket = el('div', { class: 'basket' }, fmt(r.basket));
    const wrap = el('div');
    const stop = el('button', { class: 'btn alt', onclick: () => { socket.emit('r2:stop'); buzz(30); } }, '✋ עצרו ושמרו');
    let shown = r.basket;
    return {
      node: el('div', { class: 'stack enter' }, el('div', { style: 'text-align:center' }, basket, el('div', { class: 'basket-l' }, 'בסל')), wrap, stop),
      update(x) {
        if (!x.r2) return;
        wrap.replaceChildren(garden(x.r2, true));
        basket.textContent = fmt(x.r2.basket);
        if (x.r2.basket > shown) { basket.classList.remove('gain'); void basket.offsetWidth; basket.classList.add('gain'); }
        shown = x.r2.basket;
        stop.disabled = x.r2.basket <= 0;
      },
    };
  };

  SCREENS.r2_board = (v) => {
    const r = v.r2;
    const M = {
      banked: ['🧺', 'עצרתם בזמן!', plus(r && r.eaten * 100)],
      out: ['🚪', 'גורשתם מהגן', ''],
      greedy: ['⌛', 'הזמן נגמר — הסל אבד', ''],
      idle: ['😶', 'לא קטפתם כלום', ''],
    };
    const [i, a, b] = (r && M[r.state]) || ['🌳', 'הסבב נגמר', ''];
    return { node: el('div', { class: 'stack' }, card(i, a, b), r ? garden(r, false) : null, rankLine(v)) };
  };

  // ----- סבב 3: בוחרים חיה -----
  SCREENS.r3_play = (v) => {
    const r = v.r3;
    if (!r) return { node: card('🚢', 'תצטרפו בסבב הבא!') };
    if (r.state === 'boarded') {
      buzz([40, 40, 40]);
      const a = ARK[r.animal] || { e: '🚢' };
      return { node: el('div', { class: 'stack' }, card(`${a.e}${a.e}`, 'עליתם לתיבה!'), el('div', { class: 'pts' }, plus(r.pts))) };
    }
    if (r.state === 'drowned') return { node: card('🌊', 'נשארתם בחוץ') };
    if (v.full) return { node: card('🚪', 'התיבה מלאה') };
    const btns = ARK.map((a, i) => el('button', { onclick: () => { socket.emit('r3:pick', i); buzz(15); } },
      el('span', { class: 'e' }, a.e), el('span', { class: 'n' }, a.name)));
    const status = el('div', { class: 'lead', style: 'text-align:center;min-height:1.6em' });
    return {
      node: el('div', { class: 'stack enter' }, el('div', { class: 'ark-pick' }, btns), status),
      update(x) {
        if (!x.r3) return;
        btns.forEach((b, i) => b.classList.toggle('on', x.r3.animal === i));
        const a = ARK[x.r3.animal];
        status.textContent = a ? `${a.e} מחכים לבן זוג…` : '';
      },
    };
  };

  SCREENS.r3_board = (v) => {
    const r = v.r3;
    const ok = r && r.state === 'boarded';
    return { node: el('div', { class: 'stack' }, card(ok ? '🚢' : '🌊', ok ? 'שרדתם את המבול!' : 'נשארתם בחוץ', ok ? plus(r.pts) : ''), rankLine(v)) };
  };

  // ----- סבב 4: משחק אריחים — לבנים וחמר נופלים, מקישים רק על החומר של הצוות כשהוא בפס -----
  SCREENS.r4_tower = (v) => {
    const team = v.team || {};
    if (team.idx == null) return { node: card('🧱', 'תצטרפו לשאלות!') };
    const mine = team.idx;
    const LANES = 3;
    const ZONE = [0.70, 0.93]; // פס הפגיעה (חלק יחסי מגובה המסלול)
    const field = el('div', { class: 'tiles' });
    const band = el('div', { class: 'hit-band' });
    const lanes = Array.from({ length: LANES }, () => el('div', { class: 'lane' }));
    field.append(...lanes, band);
    const hitsEl = el('b', null, '0');
    const wrongEl = el('b', null, '0');
    const node = el('div', { class: 'tile-game enter' },
      el('div', { class: 'tile-head' },
        el('span', { class: 'chip big' }, 'הקישו על ', el('span', { class: 'mat' }, MATERIALS[mine].e)),
        el('span', { class: 'chip' }, '✓ ', hitsEl), el('span', { class: 'chip' }, '✗ ', wrongEl)),
      field);

    let tiles = [];
    let hits = 0, wrong = 0, sendHits = 0, sendWrong = 0;
    let raf = 0, last = 0, spawnIn = 400, t0 = 0, lastLane = -1;
    const H = () => field.clientHeight || 400;

    function spawn(elapsed) {
      let lane = Math.floor(Math.random() * LANES);
      if (lane === lastLane && Math.random() < 0.6) lane = (lane + 1) % LANES;
      lastLane = lane;
      const mat = Math.random() < 0.6 ? mine : 1 - mine; // רוב האריחים שלכם, השאר מטעים
      const d = el('div', { class: 'tile m' + mat }, MATERIALS[mat].e);
      lanes[lane].appendChild(d);
      tiles.push({ lane, mat, y: -0.12, d, done: false });
      const p = Math.min(1, elapsed / 22000);
      spawnIn = 640 - 240 * p + Math.random() * 140; // מהר יותר עם הזמן
    }

    function frame(t) {
      if (!t0) { t0 = t; last = t; }
      const dt = Math.min(64, t - last);
      last = t;
      const elapsed = t - t0;
      const speed = 1 / (2300 - 900 * Math.min(1, elapsed / 22000)); // חלק מהגובה לכל ms
      spawnIn -= dt;
      if (spawnIn <= 0) spawn(elapsed);
      const h = H();
      for (const tl of tiles) {
        tl.y += speed * dt;
        tl.d.style.transform = `translateY(${tl.y * h}px)`;
        if (!tl.done && tl.y > ZONE[1] + 0.02) {
          tl.done = true;
          if (tl.mat === mine) { tl.d.classList.add('missed'); lanes[tl.lane].classList.add('flash-miss'); setTimeout(() => lanes[tl.lane].classList.remove('flash-miss'), 180); }
        }
      }
      tiles = tiles.filter((tl) => { if (tl.y > 1.15) { tl.d.remove(); return false; } return true; });
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    lanes.forEach((ln, li) => ln.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // האריח הכי קרוב למרכז הפס במסלול הזה
      const mid = (ZONE[0] + ZONE[1]) / 2;
      let best = null;
      for (const tl of tiles) {
        if (tl.lane !== li || tl.done) continue;
        const c = tl.y + 0.06; // מרכז האריח
        if (c >= ZONE[0] && c <= ZONE[1] && (!best || Math.abs(c - mid) < Math.abs(best.y + 0.06 - mid))) best = tl;
      }
      if (!best) { ln.classList.add('flash-empty'); setTimeout(() => ln.classList.remove('flash-empty'), 120); return; }
      best.done = true;
      if (best.mat === mine) {
        hits++; sendHits++; hitsEl.textContent = hits;
        best.d.classList.add('hit'); buzz(8);
      } else {
        wrong++; sendWrong++; wrongEl.textContent = wrong;
        best.d.classList.add('bad'); buzz([40, 30, 40]);
        node.classList.remove('shake'); void node.offsetWidth; node.classList.add('shake');
      }
    }));

    const flush = () => {
      if (sendHits > 0) { socket.emit('r4:tap', sendHits); sendHits = 0; }
      if (sendWrong > 0) { socket.emit('r4:wrong', sendWrong); sendWrong = 0; }
    };
    const fl = setInterval(flush, 250);
    return { node, destroy() { cancelAnimationFrame(raf); clearInterval(fl); flush(); } };
  };

  SCREENS.r4_scatter = (v) => {
    const team = v.team || {};
    const won = team.idx != null && v.winner === team.idx;
    const tie = v.winner === -1;
    return { node: el('div', { class: 'stack' },
      card(won ? '🏆' : tie ? '🤝' : '🧱', won ? 'הצוות שלכם ניצח!' : tie ? 'תיקו!' : team.idx == null ? 'סוף הבנייה' : 'הצוות השני ניצח'),
      v.pts ? el('div', { class: 'pts' }, plus(v.pts)) : null,
      team.idx != null ? el('div', { class: 'lead muted', style: 'text-align:center' }, `✓ ${v.hits || 0}   ✗ ${v.wrong || 0}`) : null) };
  };

  // ----- שאלות: בטלפון רק התשובות (השאלה על המסך הגדול) -----
  SCREENS.r4_q = (v) => {
    const wrap = el('div', { class: 'answers' });
    const btns = v.q.options.map((o, i) => el('button', { onclick: () => {
      if (wrap.classList.contains('locked')) return;
      wrap.classList.add('locked');
      btns[i].classList.add('on');
      socket.emit('r4:ans', i);
      buzz(20);
    } }, o));
    wrap.append(...btns);
    return {
      node: el('div', { class: 'stack enter' }, el('div', { class: 'faint', style: 'text-align:center' }, `${v.qn} / ${v.qtotal}`), wrap),
      update(x) {
        if (x.ans != null) { wrap.classList.add('locked'); btns.forEach((b, i) => b.classList.toggle('on', i === x.ans)); }
      },
    };
  };

  SCREENS.r4_reveal = (v) => {
    const answered = v.ans != null;
    if (answered) buzz(v.right ? [30, 40, 30] : [120]);
    return { node: el('div', { class: 'wait enter' },
      el('div', { class: 'verdict pop ' + (v.right ? 'good' : 'bad') }, !answered ? 'לא עניתם' : v.right ? 'נכון! ✓' : 'לא נכון ✗'),
      v.right ? el('div', { class: 'pts' }, plus(v.pts)) : null) };
  };

  SCREENS.final = (v) => {
    if (v.me.rank && v.me.rank <= 3) setTimeout(() => FX.confetti(4000), 300);
    return { node: el('div', { class: 'wait enter' },
      el('div', { class: 'big-em pop' }, v.me.rank === 1 ? '🏆' : v.me.rank === 2 ? '🥈' : v.me.rank === 3 ? '🥉' : v.me.avatar),
      el('h1', null, rankText(v.me.rank, v.me.total)),
      el('div', { class: 'pts' }, `${fmt(v.me.score)} נקודות`)) };
  };
})();
