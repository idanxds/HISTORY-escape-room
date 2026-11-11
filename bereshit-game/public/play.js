/* בראשית: המשחק — הטלפון של השחקן */
(function () {
  'use strict';
  const { el, verse, ROUNDS, ARK, Q, SNAKE, FRUITS, fmt, plus, rankText } = B;
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
    const token = store.get('token');
    socket.emit('join', { token, name }, (a) => {
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

  function showJoin(err) {
    lastKey = 'join';
    screen = null;
    $('me').classList.add('hidden');
    document.body.className = 'play theme-lobby';
    const input = el('input', { maxlength: 14, placeholder: 'השם שלכם', autocomplete: 'nickname', enterkeyhint: 'go', 'aria-label': 'השם שלכם' });
    input.value = store.get('name');
    const msg = el('div', { class: 'err' }, err || '');
    const go = () => {
      const n = input.value.replace(/\s+/g, ' ').trim();
      if (!n) { msg.textContent = 'צריך לכתוב שם 🙂'; input.focus(); return; }
      FX.unlock();
      join(n);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    scr.replaceChildren(el('div', { class: 'join enter' },
      el('div', { class: 'big-em' }, '🌍'),
      el('h1', null, 'בראשית: ', el('span', null, 'המשחק')),
      verse(Q.open),
      input,
      el('button', { class: 'btn', onclick: go }, 'הצטרפו למשחק ←'),
      msg));
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
      case 'r4_q': return v.phase + ':' + v.qn;
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

  // טיימר קטן בטלפון
  function timer() {
    const span = el('span');
    const node = el('div', { class: 'timer', style: '--size:58px' },
      el('svg', null), span);
    // SVG חייב namespace
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    const mk = (cls) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('class', cls); c.setAttribute('cx', 50); c.setAttribute('cy', 50); c.setAttribute('r', 44); return c; };
    const track = mk('track');
    const prog = mk('prog');
    const CIRC = 2 * Math.PI * 44;
    prog.style.strokeDasharray = CIRC;
    svg.append(track, prog);
    node.replaceChild(svg, node.firstChild);
    const tick = () => {
      if (!view || !view.endsAt) { node.classList.add('hidden'); return; }
      node.classList.remove('hidden');
      const ms = B.left(view);
      const s = Math.ceil(ms / 1000);
      span.textContent = s;
      prog.style.strokeDashoffset = CIRC * (1 - ms / (view.dur || 1));
      node.classList.toggle('low', s <= 5);
    };
    tick();
    const id = setInterval(tick, 250);
    return { node: el('div', { class: 'timer-row' }, node), stop: () => clearInterval(id) };
  }

  function waitCard(icon, title, sub, ...extra) {
    return el('div', { class: 'wait enter' },
      el('div', { class: 'big-em' }, icon),
      el('h2', null, title),
      sub ? el('div', { class: 'lead muted' }, sub) : null,
      ...extra,
      el('div', { class: 'look' }, 'הסתכלו על המסך הגדול'));
  }

  function rankLine(v) {
    const d = v.me.delta;
    return el('div', { class: 'lead' }, rankText(v.me.rank, v.me.total),
      d > 0 ? el('span', { class: 'delta-up' }, ` ▲${d}`) : d < 0 ? el('span', { class: 'delta-down' }, ` ▼${-d}`) : null);
  }

  // ---------- המסכים ----------
  const SCREENS = {};

  SCREENS.unknown = () => ({ node: waitCard('⏳', 'רגע…', '') });

  SCREENS.lobby = (v) => ({
    node: el('div', { class: 'wait enter' },
      el('div', { class: 'big-em pop' }, v.me.avatar),
      el('h1', null, 'אתם בפנים!'),
      el('div', { class: 'lead' }, v.me.name),
      el('div', { class: 'card panel' }, verse(Q.open)),
      el('div', { class: 'lead muted' }, 'מחכים שהמארח יתחיל את המשחק…'),
      el('button', { class: 'btn ghost', style: 'width:auto;font-size:.95em;padding:.6em 1.2em', onclick: () => {
        store.del('token'); store.del('name'); location.reload();
      } }, 'לא אני? החליפו שם')),
  });

  function intro(n) {
    return () => {
      const R = ROUNDS[n];
      return {
        node: el('div', { class: 'wait enter' },
          el('div', { class: 'faint' }, `סבב ${n} מתוך 4`),
          el('h1', { class: 'pop', style: 'font-size:3.4em' }, R.word, ' ', R.icon),
          el('div', { class: 'muted' }, `״${R.title929}״`),
          el('div', { class: 'card panel' }, verse(R.verses[R.verses.length - 1])),
          el('div', { class: 'card panel', style: 'text-align:start' },
            el('ol', { style: 'margin:0;padding-inline-start:1.2em;line-height:1.55' }, R.how.map((t) => el('li', null, t)))),
          el('div', { class: 'look' }, 'הסתכלו על המסך הגדול')),
      };
    };
  }
  SCREENS.r1_intro = intro(1);
  SCREENS.r2_intro = intro(2);
  SCREENS.r3_intro = intro(3);
  SCREENS.r4_intro = intro(4);

  // ----- סבב 1 -----
  SCREENS.r1_name = (v) => {
    const t = timer();
    const input = el('input', { class: 'name-input', maxlength: 24, placeholder: 'שם מצחיק לחיה…', enterkeyhint: 'send', 'aria-label': 'שם לחיה' });
    input.value = v.myText || '';
    const status = el('div', { class: 'sent' });
    const btn = el('button', { class: 'btn' }, 'שלחו');
    const send = () => {
      const s = input.value.trim();
      if (!s) { input.focus(); return; }
      socket.emit('r1:name', s);
      input.blur();
      buzz(20);
    };
    btn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    return {
      node: el('div', { class: 'enter', style: 'display:flex;flex-direction:column;gap:1em' },
        t.node,
        el('div', { class: 'card panel' },
          el('div', { class: 'big-em' }, v.animal.emoji),
          el('div', { class: 'lead', style: 'font-weight:700' }, v.animal.cap)),
        el('div', { class: 'muted', style: 'text-align:center' }, 'איך הייתם קוראים לה?'),
        input, btn, status),
      update(x) {
        if (x.myText) {
          status.textContent = `✓ נשלח: "${x.myText}" — אפשר לשנות עד סוף הזמן`;
          btn.textContent = 'עדכנו';
        }
      },
      destroy: t.stop,
    };
  };

  SCREENS.r1_vote = (v) => {
    const t = timer();
    const others = v.entries.filter((e) => !e.mine);
    const btns = v.entries.map((e) => el('button', {
      disabled: e.mine,
      onclick: () => { socket.emit('r1:vote', e.i); buzz(20); },
    }, e.text, e.mine ? ' (שלכם)' : ''));
    return {
      node: el('div', { class: 'enter', style: 'display:flex;flex-direction:column;gap:1em' },
        t.node,
        el('h2', { style: 'text-align:center' }, 'הצביעו לשם הכי טוב!'),
        others.length ? el('div', { class: 'vote-list' }, btns) : el('div', { class: 'card panel lead' }, 'אין שמות אחרים להצביע להם 🙂')),
      update(x) { v.entries.forEach((e, i) => btns[i].classList.toggle('on', x.voted === e.i)); },
      destroy: t.stop,
    };
  };

  SCREENS.r1_reveal = (v) => {
    const m = v.mine;
    return {
      node: m
        ? el('div', { class: 'wait enter' },
            el('div', { class: 'big-em pop' }, m.winner ? '👑' : '🗳️'),
            el('h2', null, m.winner ? 'השם שלכם ניצח!' : `קיבלתם ${m.votes} קולות`),
            el('div', { class: 'card panel lead', style: 'font-weight:700' }, `"${m.text}"`),
            el('div', { class: 'pts' }, plus(m.pts)),
            rankLine(v),
            el('div', { class: 'look' }, 'הסתכלו על המסך הגדול'))
        : waitCard('🤐', 'לא שלחתם שם הפעם', 'בפעם הבאה!', rankLine(v)),
    };
  };

  // ----- סבב 2 -----
  SCREENS.r2_play = (v) => {
    const r = v.r2;
    if (!r) return { node: waitCard('🌳', 'הסבב כבר התחיל', 'תצטרפו בסבב הבא!') };
    if (r.state === 'banked') return { node: waitCard('🧺', `שמרתם ${fmt(r.eaten * 100)} נקודות!`, 'עצרתם בזמן. חכמים!') };
    if (r.state === 'out') {
      buzz([80, 60, 160]);
      return { node: el('div', { class: 'wait expelled' },
        el('div', { class: 'big-em' }, '🚪'),
        el('h2', null, 'אכלתם מעץ הדעת!'),
        el('div', { class: 'lead muted' }, 'גורשתם מהגן — הסל אבד, ועוד 100 נקודות.'),
        el('div', { class: 'card panel' }, verse(Q.r2out)),
        el('div', { class: 'look' }, 'הסתכלו על המסך הגדול')) };
    }
    // משחקים
    const t = timer();
    const basket = el('div', { class: 'basket' }, fmt(r.basket));
    const fruit = el('span', { class: 'fr' }, FRUITS[0]);
    const snake = el('div', { class: 'snake panel' });
    const showSnake = () => {
      const s = SNAKE[(Math.random() * SNAKE.length) | 0];
      snake.replaceChildren(el('span', { class: 's' }, '🐍'),
        el('div', null, el('div', { class: 't' + (s.ref ? '' : ' plain') }, s.ref ? `״${s.text}״` : s.text), s.ref ? el('small', null, s.ref) : null));
    };
    showSnake();
    const stop = el('button', { class: 'btn alt', onclick: () => { socket.emit('r2:stop'); buzz(30); } }, '✋ עצרו ושמרו');
    const eat = el('button', { class: 'eat-btn', onclick: () => {
      socket.emit('r2:eat');
      fruit.textContent = FRUITS[(Math.random() * FRUITS.length) | 0];
      buzz(12);
      if (Math.random() < 0.45) showSnake();
    } }, fruit, 'אִכלו!');
    let shown = r.basket;
    return {
      node: el('div', { class: 'enter', style: 'display:flex;flex-direction:column;gap:.9em' },
        t.node,
        el('div', { style: 'text-align:center' }, basket, el('div', { class: 'basket-l' }, 'בסל שלכם')),
        eat, stop, snake),
      update(x) {
        if (!x.r2) return;
        basket.textContent = fmt(x.r2.basket);
        if (x.r2.basket > shown) { basket.classList.remove('gain'); void basket.offsetWidth; basket.classList.add('gain'); }
        shown = x.r2.basket;
        stop.disabled = x.r2.basket <= 0;
      },
      destroy: t.stop,
    };
  };

  SCREENS.r2_board = (v) => {
    const r = v.r2;
    const M = {
      banked: ['🧺', 'עצרתם בזמן!', `שמרתם ${fmt(r && r.eaten * 100)} נקודות.`],
      out: ['🚪', 'גורשתם מהגן', 'אכלתם מעץ הדעת.'],
      greedy: ['⌛', 'הזמן נגמר…', 'לא עצרתם — הסל אבד.'],
      idle: ['😶', 'לא אכלתם כלום', 'גם זו אסטרטגיה.'],
    };
    const [i, a, b] = (r && M[r.state]) || ['🌳', 'הסבב נגמר', ''];
    return { node: waitCard(i, a, b, rankLine(v)) };
  };

  // ----- סבב 3 -----
  SCREENS.r3_play = (v) => {
    const r = v.r3;
    if (!r) return { node: waitCard('🚢', 'הסבב כבר התחיל', 'תצטרפו בסבב הבא!') };
    if (r.state === 'boarded') {
      buzz([40, 40, 40]);
      const a = ARK[r.animal] || { e: '🚢', name: '' };
      return { node: waitCard(`${a.e}${a.e}`, 'עליתם לתיבה!', `מצאתם בן זוג. ${plus(r.pts)}`, el('div', { class: 'card panel' }, verse(Q.r3b))) };
    }
    if (r.state === 'drowned') return { node: waitCard('🌊', 'נשארתם בחוץ', 'לא מצאתם בן זוג בזמן.') };
    const t = timer();
    const btns = ARK.map((a, i) => el('button', { disabled: v.full, onclick: () => { socket.emit('r3:pick', i); buzz(15); } },
      el('span', { class: 'e' }, a.e), el('span', { class: 'n' }, a.name)));
    const status = el('div', { class: 'lead', style: 'text-align:center;min-height:3em' });
    return {
      node: el('div', { class: 'enter', style: 'display:flex;flex-direction:column;gap:.9em' },
        t.node,
        el('h2', { style: 'text-align:center' }, 'בחרו חיה ומצאו בן זוג!'),
        v.full ? el('div', { class: 'card panel' }, el('h2', null, 'התיבה מלאה!'), verse(Q.r3full)) : null,
        el('div', { class: 'ark-pick' }, btns),
        status),
      update(x) {
        if (!x.r3) return;
        btns.forEach((b, i) => b.classList.toggle('on', x.r3.animal === i));
        const a = ARK[x.r3.animal];
        status.textContent = a ? `מחכים לעוד ${a.name} ${a.e}… חפשו מי בחר כמוכם!` : 'כשמישהו יבחר את אותה חיה — תעלו יחד.';
      },
      destroy: t.stop,
    };
  };

  SCREENS.r3_board = (v) => {
    const r = v.r3;
    if (r && r.state === 'boarded') return { node: waitCard('🚢', 'שרדתם את המבול!', plus(r.pts), rankLine(v)) };
    return { node: waitCard('🌊', r ? 'נשארתם בחוץ' : 'הסבב נגמר', r ? 'בפעם הבאה — מהר יותר!' : '', rankLine(v)) };
  };

  // ----- סבב 4 -----
  SCREENS.r4_tower = (v) => {
    const team = v.team || {};
    if (team.idx == null) return { node: waitCard('🧱', 'הבנייה כבר התחילה', 'תצטרפו לשאלות!') };
    const t = timer();
    let pending = 0;
    let mine = 0;
    const count = el('div', { class: 'tap-count' }, '0');
    const tap = (e) => {
      e.preventDefault();
      pending++;
      mine++;
      count.textContent = fmt(mine);
      buzz(6);
    };
    const btn = el('button', { class: 'tap-btn', style: `--tc:${B.TEAM_COLORS[team.idx]}` }, el('span', { class: 'e' }, team.emoji), 'בנו!');
    btn.addEventListener('pointerdown', tap);
    const flush = setInterval(() => { if (pending > 0) { socket.emit('r4:tap', pending); pending = 0; } }, 200);
    return {
      node: el('div', { class: 'enter', style: 'display:flex;flex-direction:column;gap:.9em;align-items:center' },
        t.node,
        el('h2', null, `${team.emoji} ${team.name}`),
        btn,
        el('div', null, count, el('span', { class: 'muted' }, ' לבנים שלכם'))),
      destroy() { clearInterval(flush); t.stop(); if (pending > 0) socket.emit('r4:tap', pending); },
    };
  };

  SCREENS.r4_scatter = (v) => {
    const team = v.team || {};
    const won = team.idx != null && v.winner === team.idx;
    const tie = v.winner === -1;
    return {
      node: waitCard(won ? '🏆' : tie ? '🤝' : '🧱',
        won ? 'הצוות שלכם ניצח!' : tie ? 'תיקו!' : team.idx == null ? 'סוף הבנייה' : 'הצוות השני בנה גבוה יותר',
        v.pts ? plus(v.pts) : '',
        el('div', { class: 'card panel' }, verse(Q.r4scatter))),
    };
  };

  SCREENS.r4_q = (v) => {
    const t = timer();
    const wrap = el('div', { class: 'answers' });
    const btns = v.q.options.map((o, i) => el('button', { onclick: () => {
      if (wrap.classList.contains('locked')) return;
      wrap.classList.add('locked');
      btns[i].classList.add('on');
      socket.emit('r4:ans', i);
      buzz(20);
    } }, o));
    wrap.append(...btns);
    const status = el('div', { class: 'lead muted', style: 'text-align:center;min-height:1.5em' });
    return {
      node: el('div', { class: 'enter', style: 'display:flex;flex-direction:column;gap:.9em' },
        t.node,
        el('div', { class: 'faint', style: 'text-align:center' }, `שאלה ${v.qn} מתוך ${v.qtotal}`),
        el('h2', { style: 'text-align:center;line-height:1.3' }, v.q.text),
        wrap, status),
      update(x) {
        if (x.ans != null) {
          wrap.classList.add('locked');
          btns.forEach((b, i) => b.classList.toggle('on', i === x.ans));
          status.textContent = 'עניתם! מחכים לשאר…';
        }
      },
      destroy: t.stop,
    };
  };

  SCREENS.r4_reveal = (v) => {
    const src = v.src || {};
    const answered = v.ans != null;
    if (answered) buzz(v.right ? [30, 40, 30] : [120]);
    return {
      node: el('div', { class: 'wait enter' },
        el('div', { class: 'verdict pop ' + (v.right ? 'good' : 'bad') }, !answered ? 'לא עניתם' : v.right ? 'נכון! ✓' : 'לא נכון ✗'),
        v.right ? el('div', { class: 'pts' }, plus(v.pts)) : null,
        el('div', { class: 'lead' }, 'התשובה: ', el('b', null, v.answer)),
        el('div', { class: 'card panel' }, verse({ quote: src.quote, ref: src.ref }),
          src.note ? el('div', { class: 'muted', style: 'margin-top:.6em;line-height:1.5' }, src.note) : null),
        el('div', { class: 'look' }, 'הסתכלו על המסך הגדול')),
    };
  };

  SCREENS.final = (v) => {
    const top = v.top || [];
    if (v.me.rank && v.me.rank <= 3) setTimeout(() => FX.confetti(4000), 300);
    return {
      node: el('div', { class: 'wait enter' },
        el('div', { class: 'big-em pop' }, v.me.rank === 1 ? '🏆' : v.me.rank === 2 ? '🥈' : v.me.rank === 3 ? '🥉' : v.me.avatar),
        el('h1', null, rankText(v.me.rank, v.me.total)),
        el('div', { class: 'pts' }, `${fmt(v.me.score)} נקודות`),
        top.length ? el('div', { class: 'card panel', style: 'text-align:start' },
          top.map((p, i) => el('div', { style: 'display:flex;gap:.5em;padding:.25em 0;font-weight:700' },
            el('span', null, ['🥇', '🥈', '🥉'][i]), el('span', { style: 'flex:1' }, `${p.avatar} ${p.name}`), el('span', null, fmt(p.score))))) : null,
        el('div', { class: 'card panel' }, verse(Q.final)),
        el('a', { href: B.link929(1), target: '_blank', rel: 'noopener', class: 'lead' }, 'לקרוא את ספר בראשית ב-929 ←')),
    };
  };
})();
