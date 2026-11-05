# bereshit-game — uploaded snapshot

Files uploaded to the session on 2026-11-05 and saved here byte-for-byte.
This is a separate project from the AI presentation at the repo root.

What it is: a Kahoot-style classroom game on Genesis (Hebrew).
Node + Express 5 + Socket.IO, host screen on a projector, players join by QR.

## Saved here

| File | Notes |
|---|---|
| `server.js` | Game server: phase machine, 4 rounds, scoring, QR join |
| `content.js` | Round 1 animals + round 4 trivia (includes correct answers) |
| `package.json` | `npm start` -> `node server.js`, `npm test` -> `node tools/selftest.js` |
| `package-lock.json` | Dependency lock |
| `README.md` | Original project README (Hebrew) |

## Not uploaded — the project will not run yet

`server.js` and `package.json` reference these, and none were part of the upload:

- `public/play.html` — player screen (served at `/`)
- `public/host.html` — host screen (served at `/host`)
- `public/common.js` — opening texts, verses, ark animals (per the README)
- `tools/selftest.js` — the `npm test` harness

`npm start` will boot and the sockets will work, but `/` and `/host` return
404 until the `public/` files are added.
