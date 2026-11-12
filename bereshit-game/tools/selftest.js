'use strict';
// בדיקה עצמית: `npm test`
//
// חלק א — תוכן: כל ציטוט במשחק נבדק מילה במילה (כולל ניקוד) מול נוסח בראשית
//          מאתר 929 (tools/genesis929.json), ובדיקות "נוסח יהודי" (בלי תפוח, בלי שם ה' המפורש).
// חלק ב — משחק מלא: מארח + 12 בוטים משחקים את כל ארבעת הסבבים, כולל מצטרפים מאוחרים,
//          התחברות מחדש, שמות כפולים, ובדיקת ניקוד בכל סבב.
//
// ברירת מחדל: מפעיל שרת משלו על פורט פנוי. אפשר לבדוק שרת קיים: URL=http://localhost:3000 npm test

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { io: ioc } = require('socket.io-client');

const ROOT = path.join(__dirname, '..');
const C = require(path.join(ROOT, 'content.js'));
const B = require(path.join(ROOT, 'public', 'common.js'));
const G = require(path.join(__dirname, 'genesis929.json'));

let failures = 0;
let checks = 0;
const ok = (cond, msg) => {
  checks++;
  if (!cond) { failures++; console.log('  ✗ ' + msg); }
  return !!cond;
};
const section = (t) => console.log('\n' + t);
const info = (t) => console.log('  · ' + t);

// =====================================================================
// חלק א: תוכן
// =====================================================================
const MARKS = /[֑-ֽֿ-ׂׄ-ׇ]/g;
const YHWH = /י[֑-ׇ]*ה[֑-ׇ]*ו[֑-ׇ]*ה[֑-ׇ]*/g;
const HAS_NIKUD = /[ְ-ׇֽׁׂ]/;
const verseWords = (ch, v) => {
  const t = G.chapters[ch] && G.chapters[ch].nikud[v - 1];
  return t ? t.replace(/׃/g, '').replace(YHWH, "ה'").split(/\s+/).filter(Boolean) : null;
};
const contains = (words, want) => {
  for (let i = 0; i + want.length <= words.length; i++) if (want.every((w, j) => words[i + j] === w)) return true;
  return false;
};
// לבדיקת טקסט מנוקד בתוך שאלות/הערות מפרקים גם במקף (־), כדי לאפשר ציטוט של "הַמָּאוֹר הַגָּדֹל" מתוך "אֶת־הַמָּאוֹר הַגָּדֹל"
const ALL_VERSES = Object.keys(G.chapters).flatMap((ch) => G.chapters[ch].nikud.map((_, i) => verseWords(ch, i + 1).join(' ').split(/[\s־]+/)));

function checkQuote(q, where) {
  const words = verseWords(q.ch, q.v);
  if (!ok(words, `${where}: אין פסוק ${q.ch}:${q.v} בנוסח 929 השמור`)) return;
  ok(contains(words, q.quote.split(/\s+/)), `${where}: הציטוט לא תואם מילה במילה את ${q.ref}: "${q.quote}"`);
  ok(q.ref === `בראשית ${B.heb(q.ch)}, ${B.heb(q.v)}`, `${where}: המקור "${q.ref}" לא תואם ל-${q.ch}:${q.v}`);
}

// מילים מנוקדות בתוך גרשיים בשאלות/הערות — חייבות להופיע ברצף באיזשהו פסוק
function checkInlineNikud(text, where) {
  for (const m of String(text).matchAll(/["״]([^"״]+)["״]/g)) {
    if (!HAS_NIKUD.test(m[1])) continue;
    const want = m[1].trim().split(/[\s־]+/);
    ok(ALL_VERSES.some((w) => w && contains(w, want)), `${where}: הטקסט המנוקד "${m[1]}" לא נמצא בנוסח 929`);
  }
}

function partA() {
  section('חלק א — תוכן מול נוסח 929');
  // ציטוטים ב-common.js
  for (const [k, q] of Object.entries(B.Q)) checkQuote(q, `common.Q.${k}`);
  for (const [n, R] of Object.entries(B.ROUNDS)) R.verses.forEach((q, i) => checkQuote(q, `ROUNDS[${n}].verses[${i}]`));
  B.ARK.forEach((a) => checkQuote(a, `ARK ${a.name}`));
  ok(B.ARK.length === 8, `צריך בדיוק 8 חיות לתיבה (ARK_COUNT בשרת), יש ${B.ARK.length}`);
  B.SNAKE.filter((s) => s.ref).forEach((s, i) => {
    const q = Object.values(B.Q).find((x) => x.quote === s.text && x.ref === s.ref);
    ok(q, `SNAKE[${i}] מצוטט עם מקור אבל לא תואם לאף פסוק מאומת`);
  });
  info(`${Object.keys(B.Q).length} פסוקים ב-common.js`);

  // טריוויה
  C.TRIVIA.forEach((t, i) => {
    const where = `TRIVIA[${i}] "${t.q}"`;
    checkQuote(t, where);
    ok(Array.isArray(t.options) && t.options.length === 4, `${where}: צריך 4 תשובות`);
    ok(new Set(t.options).size === t.options.length, `${where}: תשובות כפולות`);
    ok(Number.isInteger(t.correct) && t.correct >= 0 && t.correct < 4, `${where}: correct לא תקין`);
    checkInlineNikud(t.q, where);
    checkInlineNikud(t.note || '', where + ' (note)');
    t.options.forEach((o) => checkInlineNikud(o, where + ' (option)'));
    ok(!/תפוח/.test(t.options[t.correct]), `${where}: "תפוח" לא יכול להיות תשובה נכונה — התורה לא אומרת שזה היה תפוח`);
  });
  const groups = new Set(C.TRIVIA.map((t) => t.group || t.ref + t.q));
  ok(groups.size >= C.TRIVIA_PER_GAME, `אין מספיק קבוצות שונות (${groups.size}) ל-${C.TRIVIA_PER_GAME} שאלות במשחק`);
  info(`${C.TRIVIA.length} שאלות במאגר, ${C.TRIVIA_PER_GAME} בכל משחק`);
  ok(C.NAMING.length >= 3, 'צריך לפחות 3 נושאים לסבב השמות');
  C.NAMING.forEach((n, i) => {
    const t = G.chapters[n.ch] && G.chapters[n.ch].nikud[n.v - 1];
    if (!ok(t, `NAMING[${i}] "${n.cap}": אין פסוק ${n.ch}:${n.v} בנוסח 929 השמור`)) return;
    ok(t.replace(MARKS, '').includes(n.find), `NAMING[${i}] "${n.cap}": המילה "${n.find}" לא מופיעה ב-${n.ref}`);
    ok(n.ref === `בראשית ${B.heb(n.ch)}, ${B.heb(n.v)}`, `NAMING[${i}]: המקור "${n.ref}" לא תואם ל-${n.ch}:${n.v}`);
  });
  info(`${C.NAMING.length} נושאים לסבב השמות, כולם מעוגנים בפסוק`);

  // נוסח יהודי: בלי תפוח, ובלי לכתוב את שם ה' המפורש בשום מקום בממשק
  const files = ['content.js', 'public/common.js', 'public/host.js', 'public/play.js', 'public/host.html', 'public/play.html'];
  for (const f of files) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok(!/[🍎🍏]/u.test(s), `${f}: יש אימוג'י של תפוח`);
    ok(!YHWH.test(s.replace(/\/\/.*$/gm, '')), `${f}: שם ה' המפורש כתוב במלואו (צריך ה')`);
    YHWH.lastIndex = 0;
  }
}

// =====================================================================
// חלק ב: משחק מלא
// =====================================================================
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms, label) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await wait(25);
  }
  ok(false, `פג הזמן: ${label}`);
  return false;
}

async function startServer() {
  if (process.env.URL) return { url: process.env.URL, stop: () => {}, alive: () => true };
  const port = 3800 + Math.floor(Math.random() * 900);
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(port), HOST_PIN: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  let dead = false;
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('exit', () => { dead = true; });
  const end = Date.now() + 8000;
  while (!/המשחק רץ/.test(out) && !dead && Date.now() < end) await wait(50);
  if (dead || !/המשחק רץ/.test(out)) throw new Error('השרת לא עלה:\n' + out);
  return { url: `http://localhost:${port}`, stop: () => child.kill(), alive: () => !dead, log: () => out };
}

function makeBot(url, name) {
  const s = ioc(url, { forceNew: true, transports: ['websocket'], reconnection: false });
  const b = { s, name, v: null, token: null, views: 0 };
  s.on('view', (v) => { b.v = v; b.views++; });
  b.join = (token) => new Promise((res) => s.emit('join', { name, token }, (a) => { if (a && a.ok) { b.token = a.token; b.name = a.name; } res(a); }));
  b.close = () => s.close();
  return b;
}

async function partB() {
  section('חלק ב — משחק מלא: מארח + 12 בוטים');
  const srv = await startServer();
  info('שרת: ' + srv.url);
  let H = null;
  const host = ioc(srv.url, { forceNew: true, transports: ['websocket'] });
  host.on('hview', (v) => { H = v; });
  await new Promise((res) => host.emit('host:hello', {}, res));
  const phase = () => H && H.phase;
  const next = async (want, ms = 3000) => {
    host.emit('host:next');
    return waitFor(() => phase() === want, ms, `מעבר לשלב ${want} (עכשיו: ${phase()})`);
  };
  const alive = () => ok(srv.alive(), 'השרת קרס!' + (srv.log ? '\n' + srv.log().slice(-800) : ''));

  try {
    // ---- לובי ----
    const names = ['אדם', 'חוה', 'נח', 'שם', 'חם', 'יפת', 'נעמה', 'יובל', 'עדה', 'צלה', 'חנוך', 'אדם'];
    const bots = names.map((n) => makeBot(srv.url, n));
    await Promise.all(bots.map((b) => b.join()));
    const leaver = makeBot(srv.url, 'יוצא'); // יעזוב באמצע סבב 1
    await leaver.join();
    await waitFor(() => H && H.players && H.players.length === 13, 3000, '13 שחקנים בלובי');
    ok(bots[11].name === 'אדם 2', `שם כפול צריך להפוך ל"אדם 2", קיבלנו "${bots[11].name}"`);
    ok(H.qr && H.qr.startsWith('data:image/png'), 'יש קוד QR בלובי');
    // שינוי שם: אותו שחקן — לא שחקן נוסף על המסך
    const r1 = await new Promise((res) => bots[1].s.emit('rename', { name: 'חוה החדשה' }, res));
    await waitFor(() => H.players.some((x) => x.name === 'חוה החדשה'), 2000, 'השם החדש על המסך');
    ok(r1 && r1.ok && H.players.length === 13 && !H.players.some((x) => x.name === 'חוה'), 'שינוי שם מחליף את השם הישן — בלי שחקן כפול');
    const r2 = await new Promise((res) => bots[1].s.emit('rename', { name: 'נח' }, res));
    ok(r2 && r2.name === 'נח 2', `שינוי לשם תפוס הופך ל"נח 2" (קיבלנו "${r2 && r2.name}")`);
    info('13 שחקנים בלובי, שינוי שם במקום');

    // ---- סבב 1: אדמה ----
    await next('r1_intro');
    await next('r1_name');
    for (let a = 1; a <= 3; a++) {
      await waitFor(() => H.phase === 'r1_name' && H.idx === a, 3000, `שם לחיה ${a}`);
      bots.forEach((b, i) => b.s.emit('r1:name', `שם-${a}-${i}`));
      if (a === 1) {
        leaver.s.emit('r1:name', 'שם-של-יוצא');
        // רגרסיה לבאג הטיימר הישן: אחרי שכולם שלחו, שחקן שעוזב (~300ms) תזמן בעבר מעבר שני
        // שנורה ~1000ms — כשהמארח כבר דילג לחיה 2 — וסיים אותה מיד. כאן משחזרים בדיוק את הרצף.
        await wait(300);
        leaver.close();
        await waitFor(() => H.phase === 'r1_vote', 3000, 'כולם שלחו → הצבעה (חיה 1)');
        host.emit('host:next');
        await waitFor(() => H.phase === 'r1_reveal', 2000, 'מארח מדלג על ההצבעה');
        host.emit('host:next');
        await waitFor(() => H.phase === 'r1_name' && H.idx === 2, 2000, 'מארח עובר מהר לחיה 2');
        await wait(1400);
        ok(H.phase === 'r1_name' && H.idx === 2, `חיה 2 לא נקטעה ע"י טיימר ישן מחיה 1 (שלב: ${H.phase})`);
        continue;
      }
      await waitFor(() => bots.every((b) => b.v.sent), 2000, 'כולם רואים "נשלח"');
      ok(bots.every((b) => b.v.myText === undefined), 'הטלפון לא מקבל בחזרה את הטקסט ששלח');
      bots[0].s.emit('r1:name', 'ניסיון-לשנות'); // שולחים רק פעם אחת
      await waitFor(() => H.phase === 'r1_vote', 3000, `כולם שלחו → הצבעה (חיה ${a})`);
      const entries = H.entries;
      ok(entries.some((e) => e.text === `שם-${a}-0`) && !entries.some((e) => e.text === 'ניסיון-לשנות'), 'אי אפשר לשנות שם אחרי ששלחו');
      ok(entries.length === 12, `12 שמות להצבעה, יש ${entries.length}`);
      for (const b of bots) {
        const mine = b.v.entries.find((e) => e.mine);
        const choice = b.v.entries.find((e) => !e.mine && (e.i + a) % 3 === 0) || b.v.entries.find((e) => !e.mine);
        if (mine) b.s.emit('r1:vote', mine.i); // הצבעה לעצמי — צריכה להידחות
        b.s.emit('r1:vote', choice.i);
      }
      await waitFor(() => H.phase === 'r1_reveal', 3000, `כולם הצביעו → תוצאות (חיה ${a})`);
      const res = H.results;
      ok(res.reduce((s, x) => s + x.votes, 0) === 12, 'סך הקולות = 12 (הצבעה עצמית נדחתה)');
      ok(res.every((x) => x.pts === 30 + x.votes * 100 + (x.winner ? 200 : 0)), 'ניקוד סבב 1 = 30 + 100 לקול + 200 למנצח');
      ok(res.some((x) => x.winner), 'יש מנצח');
      if (a < 3) {
        host.emit('host:next');
        await waitFor(() => H.phase === 'r1_name' && H.idx === a + 1, 2000, `חיה ${a + 1}`);
      }
    }
    info('סבב 1 עבר: שמות, הצבעות, ניקוד, ובלי טיימר ישן שקוטע חיה');
    await next('r2_intro');

    // ---- סבב 2: אכל ----
    await next('r2_play');
    const before2 = bots.map((b) => b.v.me.score);
    ok(bots.every((b) => b.v.r2 && b.v.r2.size === 9 && b.v.r2.bomb === -1), 'גן של 9 עצים, ומיקום עץ הדעת מוסתר בזמן המשחק');
    await Promise.all(bots.map(async (b, i) => {
      const target = 1 + (i % 6);
      for (let k = 0; k < target; k++) {
        if (!b.v.r2 || b.v.r2.state !== 'playing') break;
        const n = b.views;
        b.s.emit('r2:eat', (k + i) % 9);
        await waitFor(() => b.views > n, 2000, 'תגובה לקטיף');
        if (k === 0 && b.v.r2.state === 'playing') {
          const e = b.v.r2.eaten;
          b.s.emit('r2:eat', (k + i) % 9); // אותו עץ פעמיים — לא נספר
          await wait(60);
          ok(b.v.r2.eaten === e, 'קטיף מאותו עץ פעמיים לא נספר');
        }
      }
      if (b.v.r2 && b.v.r2.state === 'playing') b.s.emit('r2:stop');
    }));
    await waitFor(() => H.phase === 'r2_board', 3000, 'כולם סיימו → לוח סבב 2');
    await waitFor(() => bots.every((b) => b.v.phase === 'r2_board'), 2000, 'הבוטים קיבלו את הלוח');
    let ok2 = true;
    bots.forEach((b, i) => {
      const r = b.v.r2;
      const d = b.v.me.score - before2[i];
      const want = r.state === 'banked' ? r.eaten * 100 : r.state === 'out' ? -Math.min(100, before2[i]) : 0;
      if (d !== want) { ok2 = false; ok(false, `סבב 2: ${b.name} (${r.state}, אכל ${r.eaten}) קיבל ${d} במקום ${want}`); }
    });
    ok(ok2, 'ניקוד סבב 2 תואם למצב של כל שחקן');
    ok(bots.every((b) => b.v.r2.bomb >= 0 && b.v.r2.bomb < 9), 'בסוף הסבב מיקום עץ הדעת נחשף');
    ok(bots.filter((b) => b.v.r2.state === 'out').every((b) => b.v.r2.picked.includes(b.v.r2.bomb)), 'מי שגורש — קטף בדיוק מעץ הדעת');
    const st = H.stats;
    info(`סבב 2: ${st.banked} עצרו, ${st.out} גורשו, ${st.greedy} איבדו את הסל`);

    // מצטרף מאוחר בזמן לוח התוצאות — זה הפיל את השרת לפני התיקון
    const late1 = makeBot(srv.url, 'מאחר');
    const a1 = await late1.join();
    await waitFor(() => late1.v, 2000, 'המצטרף המאוחר קיבל תצוגה');
    await wait(200);
    alive();
    ok(a1 && a1.ok && late1.v && late1.v.phase === 'r2_board' && late1.v.r2 === null, 'מצטרף מאוחר בזמן הלוח מקבל תצוגה בלי מצב סבב');

    // התחברות מחדש עם אותו token שומרת שם וניקוד
    const old = bots[11];
    const score11 = old.v.me.score;
    old.close();
    await wait(200);
    const again = makeBot(srv.url, 'מישהו אחר');
    await again.join(old.token);
    await waitFor(() => again.v, 2000, 'התחברות מחדש');
    ok(again.v && again.v.me.name === 'אדם 2' && again.v.me.score === score11, 'התחברות מחדש שומרת שם וניקוד');
    bots[11] = again;
    bots.push(late1);

    // ---- סבב 3: שחת ----
    await next('r3_intro');
    await next('r3_play');
    const n3 = 13;
    const cap = Math.max(1, Math.floor(n3 * 0.35));
    ok(H.cap === cap, `מקום בתיבה: ${cap} זוגות ל-${n3} שחקנים (קיבלנו ${H.cap})`);
    // שחקן 12 בוחר, מחליף חיה, ונשאר לבד
    bots[12].s.emit('r3:pick', 7);
    await waitFor(() => H.waiting && H.waiting[7], 2000, 'מחכה ליד חיה 7');
    bots[12].s.emit('r3:pick', 6);
    await waitFor(() => H.waiting[6] && !H.waiting[7], 2000, 'החלפת חיה משחררת את הקודמת');
    const pairPts = [];
    for (let p = 0; p < cap; p++) {
      bots[2 * p].s.emit('r3:pick', p);
      await waitFor(() => H.waiting[p], 2000, `בן זוג ראשון ליד חיה ${p}`);
      bots[2 * p + 1].s.emit('r3:pick', p);
      await waitFor(() => H.pairs === p + 1, 2000, `זוג ${p + 1} עלה`);
      await waitFor(() => bots[2 * p].v.r3 && bots[2 * p].v.r3.state === 'boarded', 2000, 'הבוט רואה שעלה');
      pairPts.push(bots[2 * p].v.r3.pts);
    }
    ok(pairPts.every((x, i) => x === Math.max(150, 1000 - 50 * i)), `ניקוד הזוגות יורד לפי הסדר: ${pairPts.join(', ')}`);
    await waitFor(() => H.phase === 'r3_board', 4000, 'התיבה מלאה → לוח סבב 3');
    ok(H.boarded === cap * 2, `${cap * 2} עלו לתיבה (קיבלנו ${H.boarded})`);
    ok(bots[12].v.r3 && bots[12].v.r3.state === 'drowned', 'מי שלא מצא בן זוג נשאר בחוץ');
    info(`סבב 3: ${H.boarded} עלו, ${H.drowned} נשארו בחוץ`);

    // ---- סבב 4: פוץ ----
    await next('r4_intro');
    await next('r4_tower');
    await waitFor(() => bots.every((b) => b.v.phase === 'r4_tower'), 2000, 'כולם בשלב המגדל');
    const hits = new Array(bots.length).fill(0);
    const wrong = new Array(bots.length).fill(0);
    const before4 = bots.map((b) => b.v.me.score);
    for (let k = 0; k < 10; k++) {
      bots.forEach((b, i) => {
        if (i % 4 !== 3 || k < 5) { b.s.emit('r4:tap', 1); hits[i] += 1; }
        if (i % 3 === 2 && k === 6) { b.s.emit('r4:wrong', 1); wrong[i] += 1; } // הקשה על החומר של הצוות השני
      });
      await wait(260);
    }
    await wait(300);
    const teamOf = bots.map((b) => b.v.team.idx);
    const expect = [0, 1].map((t) => bots.reduce((s, _, i) => s + (teamOf[i] === t ? hits[i] - wrong[i] : 0), 0));
    ok(H.bricks[0] === expect[0] && H.bricks[1] === expect[1], `לבנים לכל צוות = פגיעות פחות טעויות: ${H.bricks} (ציפינו ${expect})`);
    // מספם: אי אפשר לדווח 50 פגיעות בבת אחת
    const spamBefore = H.bricks.slice();
    bots[0].s.emit('r4:tap', 50);
    await wait(300);
    ok(H.bricks[teamOf[0]] - spamBefore[teamOf[0]] <= 6, `דיווח מוגזם של פגיעות נחסם (נוספו ${H.bricks[teamOf[0]] - spamBefore[teamOf[0]]})`);
    hits[0] += H.bricks[teamOf[0]] - spamBefore[teamOf[0]];
    host.emit('host:next');
    await waitFor(() => H.phase === 'r4_scatter', 2000, 'דילוג → פיזור');
    const w = H.bricks[0] === H.bricks[1] ? -1 : H.bricks[0] > H.bricks[1] ? 0 : 1;
    ok(H.winner === w, 'הצוות עם יותר לבנים ניצח');
    await waitFor(() => bots.every((b) => b.v.phase === 'r4_scatter'), 2000, 'כולם בפיזור');
    ok(bots.every((b, i) => b.v.me.score - before4[i] === Math.max(0, Math.min(hits[i], 100) - wrong[i]) * 10 + (teamOf[i] === w ? 300 : 0)),
      'ניקוד המגדל: 10 לפגיעה, פחות 10 לטעות, ו-300 לצוות המנצח');
    ok(bots.every((b, i) => b.v.hits === hits[i] && b.v.wrong === wrong[i]), 'הטלפון מקבל את מספר הפגיעות והטעויות');

    // ---- טריוויה ----
    const seen = [];
    for (let q = 1; q <= C.TRIVIA_PER_GAME; q++) {
      await next('r4_q');
      ok(H.qn === q && H.qtotal === C.TRIVIA_PER_GAME, `שאלה ${q} מתוך ${C.TRIVIA_PER_GAME}`);
      await waitFor(() => bots.every((b) => b.v.phase === 'r4_q' && b.v.qn === q), 2000, 'כולם רואים את השאלה');
      const beforeQ = bots.map((b) => b.v.me.score);
      bots.forEach((b, i) => b.s.emit('r4:ans', (i + q) % 4));
      bots.forEach((b) => b.s.emit('r4:ans', 0)); // תשובה שנייה — צריכה להידחות
      await waitFor(() => H.phase === 'r4_reveal', 3000, 'כולם ענו → חשיפה');
      await waitFor(() => bots.every((b) => b.v.phase === 'r4_reveal'), 2000, 'כולם בחשיפה');
      const t = C.TRIVIA.find((x) => x.q === H.q.text);
      ok(t && H.q.options[H.correct] === t.options[t.correct], 'התשובה הנכונה במסך המארח תואמת למאגר (גם אחרי ערבוב)');
      ok(H.src && H.src.quote === t.quote && H.src.ref === t.ref, 'החשיפה מציגה את הפסוק הנכון');
      ok(H.dist.reduce((s, x) => s + x, 0) === bots.length, 'כל שחקן נספר פעם אחת בהתפלגות');
      let consistent = true;
      bots.forEach((b, i) => {
        const v = b.v;
        const right = v.ans === v.correctPos;
        if (v.right !== right) consistent = false;
        if (v.answer !== t.options[t.correct]) consistent = false;
        const d = v.me.score - beforeQ[i];
        if (right ? !(d >= 400 && d <= 1000 && d === v.pts) : d !== 0) consistent = false;
      });
      ok(consistent, `שאלה ${q}: נכון/לא נכון וניקוד (400–1000) עקביים לכל שחקן`);
      seen.push(t);
      if (q === 1) {
        // מצטרף מאוחר בזמן חשיפת תשובה — גם זה הפיל את השרת
        const late2 = makeBot(srv.url, 'מאחר 2');
        await late2.join();
        await waitFor(() => late2.v, 2000, 'מצטרף בזמן חשיפה קיבל תצוגה');
        await wait(150);
        alive();
        ok(late2.v && late2.v.phase === 'r4_reveal' && late2.v.ans === null, 'מצטרף בזמן חשיפה מקבל תצוגה בלי לקרוס');
        late2.close();
        await wait(150);
      }
    }
    ok(seen.every((t, i) => i === 0 || seen[i - 1].ch < t.ch || (seen[i - 1].ch === t.ch && seen[i - 1].v <= t.v)), 'השאלות לפי סדר הפרקים');
    const gs = seen.filter((t) => t.group).map((t) => t.group);
    ok(new Set(gs).size === gs.length, `אין שתי שאלות מאותה קבוצה: ${gs.join(', ') || '—'}`);
    info('שאלות: ' + seen.map((t) => t.ref).join(' · '));

    // ---- סוף ----
    await next('final');
    const top = H.board.top;
    ok(top.length === 10, `טבלת הסיום מציגה 10 ראשונים (יש ${top.length})`);
    ok(top.every((p, i) => i === 0 || top[i - 1].score >= p.score), 'טבלת הסיום ממוינת');
    await waitFor(() => bots.every((b) => b.v.phase === 'final'), 2000, 'כולם במסך הסיום');
    ok(bots[0].v.top && bots[0].v.top.length === 3, 'הטלפון מקבל את שלושת הראשונים');
    const ranks = bots.map((b) => b.v.me.rank).sort((a, b) => a - b);
    ok(new Set(ranks).size === ranks.length, 'לכל שחקן מקום אחר');
    info(`מקום ראשון: ${top[0].avatar} ${top[0].name} עם ${top[0].score}`);

    // ---- משחק חדש ----
    host.emit('host:restart');
    await waitFor(() => phase() === 'lobby', 2000, 'משחק חדש → לובי');
    await waitFor(() => bots.every((b) => b.v.phase === 'lobby'), 2000, 'כולם בלובי');
    ok(bots.every((b) => b.v.me.score === 0), 'הניקוד התאפס');
    alive();
    bots.forEach((b) => b.close());
  } finally {
    host.close();
    srv.stop();
  }
}

(async () => {
  const t0 = Date.now();
  partA();
  try {
    await partB();
  } catch (e) {
    failures++;
    console.log('  ✗ שגיאה: ' + (e && e.stack || e));
  }
  console.log(`\n${failures ? '✗' : '✓'} ${checks - failures}/${checks} בדיקות עברו (${((Date.now() - t0) / 1000).toFixed(1)} שניות)`);
  process.exit(failures ? 1 : 0);
})();
