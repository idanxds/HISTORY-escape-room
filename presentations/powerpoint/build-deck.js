/*
 * Generates "Understanding Artificial Intelligence.pptx".
 * Run with: node build-deck.js
 */

const pptxgen = require("pptxgenjs");
const path = require("path");

const C = {
  bg:      "070B16",
  card:    "121A33",
  cardAlt: "16112B",
  ink:     "EEF2FB",
  dim:     "A8B3CC",
  faint:   "6B779A",
  teal:    "5EEAD4",
  indigo:  "818CF8",
  rose:    "FB7185",
  amber:   "FBBF24",
  green:   "4ADE80"
};

const FONT_H = "Arial";
const FONT_B = "Calibri";

const W = 13.33;
const M = 0.6;          // slide margin
const CW = W - M * 2;   // content width

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "Understanding Artificial Intelligence";
pres.title = "Understanding Artificial Intelligence";

function newSlide() {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  return s;
}

/* Slide title block: eyebrow + headline, used on every content slide. */
function heading(slide, eyebrow, title) {
  slide.addText(eyebrow.toUpperCase(), {
    isTextBox: true, x: M, y: 0.46, w: CW, h: 0.3,
    fontFace: FONT_B, fontSize: 12, bold: true, color: C.teal,
    charSpacing: 2.4, margin: 0
  });
  slide.addText(title, {
    isTextBox: true, x: M, y: 0.76, w: CW, h: 0.78,
    fontFace: FONT_H, fontSize: 34, bold: true, color: C.ink, margin: 0
  });
}

/* A tinted content card with a small label, a bold head and body copy. */
function card(slide, o) {
  const accent = o.accent || C.indigo;
  slide.addShape(pres.ShapeType.roundRect, {
    x: o.x, y: o.y, w: o.w, h: o.h,
    rectRadius: 0.12,
    fill: { color: o.tone === "warn" ? C.cardAlt : C.card },
    line: { color: accent, width: 0.75, transparency: 55 },
    shadow: { type: "outer", angle: 90, blur: 10, offset: 2, opacity: 0.35, color: "000000" }
  });
  slide.addText(o.label.toUpperCase(), {
    isTextBox: true, x: o.x + 0.28, y: o.y + 0.22, w: o.w - 0.56, h: 0.26,
    fontFace: FONT_B, fontSize: 10.5, bold: true, color: accent, charSpacing: 1.8, margin: 0
  });
  slide.addText(o.head, {
    isTextBox: true, x: o.x + 0.28, y: o.y + 0.5, w: o.w - 0.56, h: 0.64,
    fontFace: FONT_H, fontSize: 16, bold: true, color: C.ink,
    lineSpacingMultiple: 1.05, valign: "top", margin: 0
  });
  slide.addText(o.body, {
    isTextBox: true, x: o.x + 0.28, y: o.y + 1.16, w: o.w - 0.56, h: o.h - 1.38,
    fontFace: FONT_B, fontSize: 14, color: C.dim, lineSpacingMultiple: 1.2,
    valign: "top", margin: 0
  });
}

/* ------------------------------------------------------------------ */
/* 1 — Title                                                           */
/* ------------------------------------------------------------------ */
{
  const s = newSlide();

  s.addShape(pres.ShapeType.ellipse, {
    x: 9.1, y: -1.5, w: 6.4, h: 6.4,
    fill: { color: C.indigo, transparency: 86 }, line: { color: C.indigo, transparency: 80, width: 1 }
  });
  s.addShape(pres.ShapeType.ellipse, {
    x: 10.6, y: 3.7, w: 4.4, h: 4.4,
    fill: { color: C.teal, transparency: 90 }, line: { type: "none" }
  });

  s.addText("PRESENTATION", {
    isTextBox: true, x: M, y: 1.95, w: 8, h: 0.32,
    fontFace: FONT_B, fontSize: 13, bold: true, color: C.teal, charSpacing: 3, margin: 0
  });
  s.addText("Understanding\nArtificial Intelligence", {
    isTextBox: true, x: M, y: 2.35, w: 8.6, h: 2.0,
    fontFace: FONT_H, fontSize: 44, bold: true, color: C.ink,
    lineSpacingMultiple: 1.05, margin: 0
  });
  s.addText(
    "What it actually is, how it learns, where it already works, and where it genuinely fails.",
    {
      isTextBox: true, x: M, y: 4.5, w: 7.6, h: 0.8,
      fontFace: FONT_B, fontSize: 17, color: C.dim, lineSpacingMultiple: 1.25, margin: 0
    }
  );

  const chips = ["4 content slides", "Speaker script included", "Knowledge check quiz"];
  let cx = M;
  chips.forEach(function (t) {
    const cwid = 0.16 * t.length + 0.65;
    s.addShape(pres.ShapeType.roundRect, {
      x: cx, y: 5.55, w: cwid, h: 0.44, rectRadius: 0.22,
      fill: { color: C.card }, line: { color: C.faint, width: 0.75, transparency: 45 }
    });
    s.addText(t, {
      isTextBox: true, x: cx, y: 5.55, w: cwid, h: 0.44,
      fontFace: FONT_B, fontSize: 12.5, color: C.dim, align: "center", valign: "middle", margin: 0
    });
    cx += cwid + 0.22;
  });

  s.addNotes(
    "Welcome. Over the next four slides we will cut through the science fiction and look at what " +
    "artificial intelligence actually is, how it learns, where it is already working today, and the " +
    "real limitations that matter. We will close with a short four-question knowledge check."
  );
}

/* ------------------------------------------------------------------ */
/* 2 — What AI Actually Is                                             */
/* ------------------------------------------------------------------ */
{
  const s = newSlide();
  heading(s, "Slide 1", "What AI Actually Is (and What It Isn't)");

  const cw = (CW - 0.5) / 2;
  const right = M + cw + 0.5;

  card(s, {
    x: M, y: 1.78, w: cw, h: 2.32, accent: C.rose, tone: "warn",
    label: "The common myth",
    head: "Sentient machines",
    body: "Talking robots and rogue supercomputers. Compelling cinema, but not what is running in production anywhere today."
  });
  card(s, {
    x: right, y: 1.78, w: cw, h: 2.32, accent: C.teal,
    label: "The practical reality",
    head: "Software that detects patterns at scale",
    body: "Not alive, not conscious. Advanced pattern recognition applied to enormous volumes of data."
  });
  card(s, {
    x: M, y: 4.32, w: cw, h: 2.32, accent: C.amber, tone: "warn",
    label: "Traditional software",
    head: "Rigid, rule-based instructions",
    body: "Every rule is written in advance by a human. Hit an unexpected situation and the program simply gets stuck."
  });
  card(s, {
    x: right, y: 4.32, w: cw, h: 2.32, accent: C.indigo,
    label: "Artificial intelligence",
    head: "Adaptive models trained on examples",
    body: "Show it enough pictures of stop signs and it recognizes one in a blinding storm — with no rule written for that storm."
  });

  s.addNotes(
    "\"When most people hear 'artificial intelligence,' they picture talking robots or rogue " +
    "supercomputers. The reality is much simpler, and a lot more practical. Traditional software works " +
    "like a strict recipe. A programmer writes every single rule in advance. If the computer hits an " +
    "unexpected situation, it gets stuck. AI flips that model. Instead of writing rules, we feed the " +
    "software massive amounts of examples and let it spot the patterns on its own. Show it enough " +
    "pictures of stop signs, and it learns to recognize one in a blinding storm. It isn't alive, and it " +
    "isn't conscious. It is advanced pattern recognition at massive scale.\""
  );
}

/* ------------------------------------------------------------------ */
/* 3 — How AI Actually Learns                                          */
/* ------------------------------------------------------------------ */
{
  const s = newSlide();
  heading(s, "Slide 2", "How AI Actually Learns");

  const steps = ["Input", "Guess", "Error feedback", "Parameter adjustment"];
  const sw = 2.82, gap = 0.28;

  steps.forEach(function (label, i) {
    const x = M + i * (sw + gap);
    const last = i === steps.length - 1;
    s.addShape(pres.ShapeType.roundRect, {
      x: x, y: 1.74, w: sw, h: 0.92, rectRadius: 0.12,
      fill: { color: last ? C.card : C.card },
      line: { color: last ? C.teal : C.indigo, width: 1, transparency: 35 }
    });
    s.addText(label, {
      isTextBox: true, x: x, y: 1.74, w: sw, h: 0.92,
      fontFace: FONT_H, fontSize: 15, bold: true,
      color: last ? C.teal : C.ink, align: "center", valign: "middle", margin: 0
    });
    if (!last) {
      s.addText("›", {
        isTextBox: true, x: x + sw, y: 1.74, w: gap, h: 0.92,
        fontFace: FONT_H, fontSize: 20, bold: true, color: C.faint,
        align: "center", valign: "middle", margin: 0
      });
    }
  });

  s.addText("The training loop — repeated billions of times", {
    isTextBox: true, x: M, y: 2.74, w: CW, h: 0.3,
    fontFace: FONT_B, fontSize: 12.5, italic: true, color: C.faint, margin: 0
  });

  const cw3 = (CW - 0.8) / 3;
  const items = [
    ["01 · Pattern learning", "Like a child naming animals",
     "Point at a golden retriever: \"dog.\" Point at a cat: \"not a dog.\" Over time the common traits emerge on their own.", C.indigo],
    ["02 · Scale & repetition", "Billions of trial-and-error cycles",
     "Run the loop across millions of examples and wild guesses sharpen into accurate predictions.", C.indigo],
    ["03 · Core dependency", "Only as capable as its data",
     "Data is the textbook and repetition is the teacher. Without good data the system cannot learn a thing.", C.teal]
  ];

  items.forEach(function (it, i) {
    card(s, {
      x: M + i * (cw3 + 0.4), y: 3.28, w: cw3, h: 3.2,
      accent: it[3], label: it[0], head: it[1], body: it[2]
    });
  });

  s.addNotes(
    "\"How does software actually learn without explicit instructions? Think about how a child learns " +
    "what a dog looks like. You don't give a toddler a biology textbook with fur density formulas. You " +
    "point at a golden retriever and say 'dog.' You point at a cat and say 'not a dog.' Over time, their " +
    "brain figures out the common traits. AI trains the exact same way through rapid trial and error. The " +
    "computer makes a wild guess, checks how far off it was, adjusts its internal dials, and tries again. " +
    "Run that cycle billions of times across millions of examples, and random guesses turn into sharp " +
    "predictions. Data is the textbook, and repetition is the teacher. Without good data, the system " +
    "cannot learn a thing.\""
  );
}

/* ------------------------------------------------------------------ */
/* 4 — Where AI Actually Works Today                                   */
/* ------------------------------------------------------------------ */
{
  const s = newSlide();
  heading(s, "Slide 3", "Where AI Actually Works Today");

  const cw = (CW - 0.5) / 2;
  const right = M + cw + 0.5;

  card(s, {
    x: M, y: 1.78, w: cw, h: 2.32, accent: C.teal,
    label: "Healthcare",
    head: "Diagnostic imaging support",
    body: "Scans medical imaging for early abnormalities that human eyes might miss at the end of a long shift."
  });
  card(s, {
    x: right, y: 1.78, w: cw, h: 2.32, accent: C.indigo,
    label: "Daily consumer tools",
    head: "Already in your pocket",
    body: "Predictive navigation around sudden accidents, real-time translation, and billions of spam emails blocked."
  });
  card(s, {
    x: M, y: 4.32, w: cw, h: 2.32, accent: C.indigo,
    label: "Business operations",
    head: "Working behind the scenes",
    body: "Fraud detection before a charge goes through, automated logistics, and first drafts of computer code."
  });
  card(s, {
    x: right, y: 4.32, w: cw, h: 2.32, accent: C.teal,
    label: "The practical role",
    head: "Augmenting, not replacing",
    body: "It handles heavy, repetitive analysis so people decide faster — rarely replacing whole teams on its own."
  });

  s.addNotes(
    "\"Because AI sounds futuristic, we often miss how much it already runs our daily routines. In " +
    "healthcare, algorithms scan medical imaging to catch early signs of illness that human eyes might " +
    "miss during a long shift. In our pockets, it routes our morning commute around sudden accidents, " +
    "blocks billions of spam emails, and translates languages in real time. Behind the scenes, it manages " +
    "warehouse inventory, detects credit card fraud before a charge goes through, and writes first drafts " +
    "of computer code. It is rarely replacing entire human jobs on its own. Instead, it handles heavy, " +
    "repetitive analysis so people can make faster, better decisions.\""
  );
}

/* ------------------------------------------------------------------ */
/* 5 — Real Limitations and Risks                                      */
/* ------------------------------------------------------------------ */
{
  const s = newSlide();
  heading(s, "Slide 4", "Real Limitations and Risks");

  const rows = [
    ["1", "Lack of true comprehension", "Generates fluent output with zero common sense — it never understands what any of it means."],
    ["2", "Hallucinations", "When it errs it rarely signals doubt. It delivers completely false information with absolute confidence."],
    ["3", "Algorithmic bias", "Biased hiring records or loan approvals get absorbed and amplified. Garbage in, garbage out."],
    ["4", "Accountability gap", "When a costly mistake happens, who takes the blame? Human oversight and ethical boundaries are not optional."]
  ];

  const rh = 1.12, rgap = 0.16;

  rows.forEach(function (r, i) {
    const y = 1.72 + i * (rh + rgap);
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y: y, w: CW, h: rh, rectRadius: 0.1,
      fill: { color: C.card }, line: { color: C.rose, width: 0.75, transparency: 65 }
    });
    s.addShape(pres.ShapeType.ellipse, {
      x: M + 0.3, y: y + 0.28, w: 0.56, h: 0.56,
      fill: { color: C.rose, transparency: 78 }, line: { color: C.rose, width: 1, transparency: 35 }
    });
    s.addText(r[0], {
      isTextBox: true, x: M + 0.3, y: y + 0.28, w: 0.56, h: 0.56,
      fontFace: FONT_H, fontSize: 15, bold: true, color: C.ink,
      align: "center", valign: "middle", margin: 0
    });
    s.addText(r[1], {
      isTextBox: true, x: M + 1.05, y: y + 0.19, w: 3.65, h: 0.4,
      fontFace: FONT_H, fontSize: 16, bold: true, color: C.ink, valign: "middle", margin: 0
    });
    s.addText(r[2], {
      isTextBox: true, x: M + 1.05, y: y + 0.58, w: CW - 1.4, h: 0.4,
      fontFace: FONT_B, fontSize: 14, color: C.dim, valign: "top", margin: 0
    });
  });

  s.addText("An exceptional calculator — not an infallible authority.", {
    isTextBox: true, x: M, y: 6.85, w: CW, h: 0.34,
    fontFace: FONT_B, fontSize: 14, italic: true, color: C.teal, margin: 0
  });

  s.addNotes(
    "\"For all its power, artificial intelligence has very real blind spots. First, it does not actually " +
    "understand meaning. A system can generate a smooth paragraph or flag an image, but it possesses zero " +
    "common sense. When it makes an error, it rarely flags doubt. It delivers completely false information " +
    "with absolute confidence. Second, AI mirrors the data we give it. If past hiring records or loan " +
    "approvals contain human biases, the software absorbs those prejudices and automates them at scale. " +
    "Garbage in, garbage out. Finally, there is the question of accountability. When a system makes a " +
    "costly mistake, who takes the blame? AI is an exceptional calculator, not an infallible authority. It " +
    "requires constant human judgment to verify its work and set its boundaries.\""
  );
}

/* ------------------------------------------------------------------ */
/* 6 & 7 — Knowledge check                                             */
/* ------------------------------------------------------------------ */

const QUIZ = [
  {
    n: 1,
    q: "How does artificial intelligence fundamentally differ from traditional software?",
    opts: [
      "Traditional software is conscious, while AI is not",
      "Traditional software follows rigid, pre-written rules, while AI finds patterns from examples",
      "AI runs without computer hardware",
      "Traditional software relies entirely on trial and error"
    ]
  },
  {
    n: 2,
    q: "What drives the learning process behind most modern AI systems?",
    opts: [
      "Memorizing a strict list of exceptions written by a single programmer",
      "Rapid cycles of guessing, feedback, and adjustment using large datasets",
      "Independent thinking and self-awareness",
      "Copying human emotions directly from video feeds"
    ]
  },
  {
    n: 3,
    q: "How is AI primarily used in fields like healthcare and navigation today?",
    opts: [
      "Replacing entire human teams and taking full legal responsibility",
      "Writing government policy without human review",
      "Handling heavy, repetitive data analysis so people can make faster decisions",
      "Operating solely as physical humanoid robots"
    ]
  },
  {
    n: 4,
    q: "Why can an AI system produce biased or discriminatory results?",
    opts: [
      "The machine develops personal opinions as it gets older",
      "It learns from historical data that already contains human prejudices",
      "Programmers deliberately code flaws to prevent it from becoming too smart",
      "It lacks access to internet connections"
    ]
  }
];

const LETTERS = ["A", "B", "C", "D"];

function quizCard(slide, item, y) {
  const h = 2.38;
  slide.addShape(pres.ShapeType.roundRect, {
    x: M, y: y, w: CW, h: h, rectRadius: 0.12,
    fill: { color: C.card }, line: { color: C.indigo, width: 0.75, transparency: 55 }
  });
  slide.addShape(pres.ShapeType.roundRect, {
    x: M + 0.3, y: y + 0.26, w: 0.44, h: 0.44, rectRadius: 0.1,
    fill: { color: C.indigo, transparency: 75 }, line: { color: C.indigo, width: 1, transparency: 40 }
  });
  slide.addText("Q" + item.n, {
    isTextBox: true, x: M + 0.3, y: y + 0.26, w: 0.44, h: 0.44,
    fontFace: FONT_H, fontSize: 11, bold: true, color: C.ink,
    align: "center", valign: "middle", margin: 0
  });
  slide.addText(item.q, {
    isTextBox: true, x: M + 0.92, y: y + 0.24, w: CW - 1.3, h: 0.48,
    fontFace: FONT_H, fontSize: 16, bold: true, color: C.ink, valign: "middle", margin: 0
  });

  const colW = (CW - 1.24) / 2;
  item.opts.forEach(function (text, i) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const ox = M + 0.6 + col * (colW + 0.24);
    const oy = y + 0.88 + row * 0.7;
    slide.addText(
      [
        { text: LETTERS[i] + "  ", options: { bold: true, color: C.teal } },
        { text: text, options: { color: C.dim } }
      ],
      {
        isTextBox: true, x: ox, y: oy, w: colW, h: 0.64,
        fontFace: FONT_B, fontSize: 13.5, valign: "middle",
        lineSpacingMultiple: 1.1, margin: 0
      }
    );
  });
}

[[0, 1], [2, 3]].forEach(function (pair, page) {
  const s = newSlide();
  heading(s, "Knowledge check", page === 0 ? "AI Fundamentals Quiz" : "AI Fundamentals Quiz (continued)");
  quizCard(s, QUIZ[pair[0]], 1.78);
  quizCard(s, QUIZ[pair[1]], 4.42);
  s.addNotes(
    "Give the group a moment on each question before revealing the answer. Correct answers: " +
    (page === 0 ? "Question 1 is B, Question 2 is B." : "Question 3 is C, Question 4 is B.")
  );
});

/* ------------------------------------------------------------------ */
/* 8 — Answer key                                                      */
/* ------------------------------------------------------------------ */
{
  const s = newSlide();
  heading(s, "Knowledge check", "Answer Key");

  const answers = [
    ["1", "B", "Traditional software follows rigid, pre-written rules, while AI finds patterns from examples."],
    ["2", "B", "Rapid cycles of guessing, feedback, and adjustment using large datasets."],
    ["3", "C", "Handling heavy, repetitive data analysis so people can make faster decisions."],
    ["4", "B", "It learns from historical data that already contains human prejudices."]
  ];

  const rh = 1.12, rgap = 0.18;

  answers.forEach(function (a, i) {
    const y = 1.84 + i * (rh + rgap);
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y: y, w: CW, h: rh, rectRadius: 0.1,
      fill: { color: C.card }, line: { color: C.green, width: 0.75, transparency: 62 }
    });
    s.addText("Question " + a[0], {
      isTextBox: true, x: M + 0.34, y: y, w: 1.55, h: rh,
      fontFace: FONT_B, fontSize: 13, color: C.faint, valign: "middle", margin: 0
    });
    s.addShape(pres.ShapeType.ellipse, {
      x: M + 1.95, y: y + 0.26, w: 0.6, h: 0.6,
      fill: { color: C.green, transparency: 80 }, line: { color: C.green, width: 1.25, transparency: 30 }
    });
    s.addText(a[1], {
      isTextBox: true, x: M + 1.95, y: y + 0.26, w: 0.6, h: 0.6,
      fontFace: FONT_H, fontSize: 20, bold: true, color: C.green,
      align: "center", valign: "middle", margin: 0
    });
    s.addText(a[2], {
      isTextBox: true, x: M + 2.78, y: y, w: CW - 3.2, h: rh,
      fontFace: FONT_B, fontSize: 14.5, color: C.ink, valign: "middle",
      lineSpacingMultiple: 1.15, margin: 0
    });
  });

  s.addText("Thank you — questions welcome.", {
    isTextBox: true, x: M, y: 6.92, w: CW, h: 0.34,
    fontFace: FONT_B, fontSize: 14, italic: true, color: C.teal, margin: 0
  });

  s.addNotes("Answer key: 1-B, 2-B, 3-C, 4-B. Close by restating the through-line: AI is pattern recognition at scale, it is only as good as its data, it augments human decisions, and it always needs human oversight.");
}

const out = path.join(__dirname, "Understanding-Artificial-Intelligence.pptx");
pres.writeFile({ fileName: out }).then(function () {
  console.log("Wrote " + out);
});
