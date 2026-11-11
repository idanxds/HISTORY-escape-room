/* אפקטים: כוכבים, גשם המבול, צלילים וקונפטי. בלי ספריות חיצוניות. */
(function () {
  'use strict';

  // כוכבים ברקע (לובי, סוף, מבול)
  const sky = document.querySelector('.sky');
  if (sky) {
    for (let i = 0; i < 90; i++) {
      const s = document.createElement('i');
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 100 + '%';
      s.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
      if (Math.random() < .2) { s.style.width = s.style.height = '3px'; }
      sky.appendChild(s);
    }
  }

  // גשם (מוצג רק בסבב המבול, לפי ה-theme)
  const rain = document.querySelector('.rain');
  if (rain) {
    for (let i = 0; i < 70; i++) {
      const d = document.createElement('b');
      d.style.left = Math.random() * 100 + '%';
      d.style.animationDuration = (0.55 + Math.random() * 0.5).toFixed(2) + 's';
      d.style.animationDelay = (Math.random() * 2).toFixed(2) + 's';
      rain.appendChild(d);
    }
  }

  // צלילים מסונתזים (WebAudio). הדפדפן מתיר צליל רק אחרי לחיצה ראשונה.
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('bereshit-muted') === '1'; } catch (e) { /* פרטי */ }
  const unlock = () => {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
    if (ctx.state === 'suspended') ctx.resume();
  };
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });

  function tone(freq, dur, type, vol, when) {
    if (muted || !ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  const sound = {
    tick: () => tone(880, 0.08, 'square', 0.06),
    pop: () => tone(520 + Math.random() * 200, 0.09, 'triangle', 0.08),
    gong: () => { tone(196, 1.6, 'sine', 0.25); tone(294, 1.4, 'sine', 0.12, 0.02); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.16, i * 0.12)),
    bad: () => { tone(220, 0.25, 'sawtooth', 0.08); tone(165, 0.35, 'sawtooth', 0.08, 0.15); },
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem('bereshit-muted', muted ? '1' : '0'); } catch (e) { /* */ } return muted; },
  };

  // קונפטי למסך הסיום
  function confetti(ms) {
    const c = document.createElement('canvas');
    c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40';
    document.body.appendChild(c);
    const x = c.getContext('2d');
    const W = (c.width = innerWidth), H = (c.height = innerHeight);
    const colors = ['#f5c35b', '#f08a5d', '#a3e635', '#67e8f9', '#c084fc', '#fffaf0'];
    const bits = Array.from({ length: 160 }, () => ({
      x: Math.random() * W, y: -20 - Math.random() * H * 0.5, r: 4 + Math.random() * 6,
      vx: -1.5 + Math.random() * 3, vy: 2 + Math.random() * 3, a: Math.random() * 6, va: -0.2 + Math.random() * 0.4,
      c: colors[(Math.random() * colors.length) | 0],
    }));
    const end = performance.now() + (ms || 4500);
    (function frame(t) {
      x.clearRect(0, 0, W, H);
      for (const b of bits) {
        b.x += b.vx; b.y += b.vy; b.a += b.va;
        x.save(); x.translate(b.x, b.y); x.rotate(b.a); x.fillStyle = b.c; x.fillRect(-b.r, -b.r / 2, b.r * 2, b.r); x.restore();
      }
      if (t < end) requestAnimationFrame(frame); else c.remove();
    })(performance.now());
  }

  window.FX = { sound, confetti, unlock };
})();
