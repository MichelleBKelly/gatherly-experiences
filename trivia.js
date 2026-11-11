// Trivia Night — game logic.
// Player view: gatherlyexperiences.com/trivia
// Host view:   gatherlyexperiences.com/trivia?host=1 (asks for the PIN from firebase-config.js)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, doc, collection, getDocs, setDoc, addDoc, updateDoc,
  onSnapshot, query, where, orderBy, serverTimestamp,
  runTransaction, writeBatch, increment
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const QUESTION_SECONDS = 60;
const MAX_POINTS = 1000; // instant correct answer
const MIN_POINTS = 500;  // correct answer at the buzzer

const $ = (id) => document.getElementById(id);
const SCREENS = ["setup", "join", "lobby", "round", "question", "reveal", "leaderboard", "final"];
const show = (name) => {
  document.body.dataset.screen = name;
  SCREENS.forEach((s) => { $("screen-" + s).hidden = s !== name; });
};

// Typed-answer matching: ignore case, punctuation, and leading "the/a/an".
const norm = (s) => String(s).toLowerCase().trim()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/^(the|a|an)\s+/, "")
  .replace(/[^a-z0-9\s]/g, "")
  .replace(/\s+/g, " ")
  .trim();

// Speed-based scoring: 1000 pts down to 500 pts over the 60-second timer.
const pointsFor = (correct, timeMs) =>
  correct ? Math.round(MIN_POINTS + (MAX_POINTS - MIN_POINTS) * Math.max(0, 1 - timeMs / (QUESTION_SECONDS * 1000))) : 0;

const surveyMatch = (q, answer) => q.rankedAnswers?.find((row) =>
  row.aliases.some((alias) => norm(alias) === norm(answer)));
const scoreForAnswer = (answer, q = currentQuestion()) => {
  if (!answer?.correct) return 0;
  if (Number.isFinite(answer.awardedPoints)) return answer.awardedPoints;
  if (q.rankedAnswers) return surveyMatch(q, answer.answer)?.points || 0;
  return q.points ?? pointsFor(true, answer.timeMs);
};

function renderImages(id, images = []) {
  const wrap = $(id);
  wrap.replaceChildren();
  wrap.hidden = images.length === 0;
  wrap.classList.toggle("image-grid", images.length > 1);
  images.forEach((item, i) => {
    const figure = document.createElement("figure");
    figure.className = item.presentation || "clue-image";
    const img = document.createElement("img");
    img.src = item.src;
    img.alt = item.alt;
    img.decoding = "async";
    figure.append(img);
    if (images.length > 1) {
      const label = document.createElement("figcaption");
      label.textContent = "ABCD"[i] || String(i + 1);
      figure.append(label);
    }
    wrap.append(figure);
  });
}

function applyRoundTheme() {
  const round = HOLIDAY_ROUNDS[(currentQuestion()?.round || 1) - 1];
  document.body.style.setProperty("--round-background", `url("assets/holiday/${round.background}")`);
  return round;
}

function renderRound() {
  const round = applyRoundTheme();
  $("round-number").textContent = `Round ${currentQuestion().round} of ${HOLIDAY_ROUNDS.length}`;
  $("round-title").textContent = round.title;
  $("round-description").textContent = round.description;
}

// ---------- setup guard ----------
if (typeof FIREBASE_CONFIG === "undefined" || String(FIREBASE_CONFIG.apiKey).startsWith("PASTE")) {
  show("setup");
  throw new Error("Firebase is not configured yet — see TRIVIA-SETUP.md");
}
const QUESTION_LIST = typeof QUESTIONS === "undefined" ? [] : QUESTIONS;

const db = getFirestore(initializeApp(FIREBASE_CONFIG));
const gameRef = doc(db, "trivia", "game");
const teamsCol = collection(gameRef, "teams");
const answersCol = collection(gameRef, "answers");

// ---------- host mode ----------
const wantsHost = new URLSearchParams(location.search).has("host");
let hostAuthed = false;
if (wantsHost) {
  const pin = prompt("Host PIN:");
  if (pin === (typeof HOST_PIN === "undefined" ? "1234" : HOST_PIN)) {
    hostAuthed = true;
    document.body.classList.add("host");
  } else if (pin !== null) {
    alert("Wrong PIN — opening as a player instead.");
  }
}

// ---------- state ----------
let game = null;              // game doc: { state, questionIndex, questionStart, scoredFor }
let teams = [];               // live team list, sorted by score desc
let teamsLoaded = false;
let myTeamId = localStorage.getItem("trivia.teamId") || null;
let myAnswer = null;          // my answer doc for the current question
let allAnswers = [];          // host only: every answer doc
let timerHandle = null;
let answerWatchKey = null;
let unsubMyAnswer = null;
let questionRenderKey = null;

const myTeam = () => teams.find((t) => t.id === myTeamId) || null;
const currentQuestion = () => QUESTION_LIST[game ? game.questionIndex : 0];

// ---------- live listeners ----------
onSnapshot(gameRef, (snap) => {
  if (!snap.exists()) {
    if (hostAuthed) {
      setDoc(gameRef, { state: "lobby", questionIndex: 0, scoredFor: -1, questionStart: null });
    }
    game = null;
  } else {
    game = snap.data();
  }
  render();
}, (err) => {
  $("setup-error").textContent = "Firestore error: " + err.message + " — check the rules step in TRIVIA-SETUP.md.";
  show("setup");
});

onSnapshot(query(teamsCol, orderBy("score", "desc")), (snap) => {
  teams = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  teamsLoaded = true;
  if (myTeamId && !myTeam()) {
    // Team was removed (game reset) — back to the join screen.
    localStorage.removeItem("trivia.teamId");
    myTeamId = null;
  }
  const me = myTeam();
  $("my-score").hidden = !me;
  if (me) $("my-score").textContent = `${me.name} · ${me.score} pts`;
  render();
});

function watchMyAnswer() {
  if (!game || !myTeamId) return;
  const key = game.questionIndex + "_" + myTeamId;
  if (key === answerWatchKey) return;
  answerWatchKey = key;
  if (unsubMyAnswer) unsubMyAnswer();
  unsubMyAnswer = onSnapshot(doc(answersCol, key), (snap) => {
    myAnswer = snap.exists() ? snap.data() : null;
    if (game && game.state === "reveal") renderReveal();
  });
}

if (hostAuthed) {
  onSnapshot(answersCol, (snap) => {
    allAnswers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!game) return;
    if (game.state === "question") updateAnsweredCount();
    if (game.state === "reveal") renderHostAnswers();
  });
}

// ---------- render ----------
function render() {
  if (game?.state === "lobby") questionRenderKey = null;
  if (!myTeamId && !hostAuthed) { show("join"); return; }
  if (!game) { show("lobby"); renderLobby(); return; }
  watchMyAnswer();
  if (game.state !== "question") {
    clearInterval(timerHandle);
    document.body.classList.remove("time-up");
  }
  switch (game.state) {
    case "lobby": show("lobby"); renderLobby(); break;
    case "round": show("round"); renderRound(); break;
    case "question": show("question"); renderQuestion(); break;
    case "reveal": show("reveal"); renderReveal(); break;
    case "leaderboard": show("leaderboard"); applyRoundTheme(); renderBoard($("lb-list")); break;
    case "final": show("final"); renderFinal(); break;
  }
}

function renderLobby() {
  applyRoundTheme();
  $("lobby-count").textContent = teams.length
    ? `${teams.length} team${teams.length === 1 ? "" : "s"} in the game`
    : "No teams yet — share the link!";
  const wrap = $("lobby-teams");
  wrap.innerHTML = "";
  teams.forEach((t) => {
    const chip = document.createElement("span");
    chip.className = "chip" + (t.id === myTeamId ? " you" : "");
    chip.textContent = t.id === myTeamId ? `${t.name} (you)` : t.name;
    wrap.append(chip);
  });
}

function renderQuestion() {
  const q = currentQuestion();
  if (!q) return;
  startTimer();
  if (hostAuthed) updateAnsweredCount();
  // Only rebuild the answer UI once per question so a Firestore re-snapshot
  // (e.g. the server timestamp confirming) doesn't wipe a player's selection.
  if (questionRenderKey === game.questionIndex && !$("screen-question").hidden) return;
  questionRenderKey = game.questionIndex;
  applyRoundTheme();
  $("q-count").textContent = `Question ${game.questionIndex + 1} of ${QUESTION_LIST.length}`;
  $("q-round").textContent = `Round ${q.round} · ${HOLIDAY_ROUNDS[q.round - 1].title}`;
  $("q-text").textContent = q.question;
  renderImages("q-images", q.images);
  $("q-instruction").hidden = !q.instruction;
  $("q-instruction").textContent = q.instruction || "";
  $("q-host-cue").hidden = !q.hostNote;
  $("q-host-cue").open = false;
  $("q-host-note").textContent = q.hostNote || "";
  $("q-status").textContent = myTeamId ? "" : "You're watching as the host.";

  const box = $("q-options");
  box.innerHTML = "";
  box.classList.toggle("text-answer", q.type === "text");

  if (q.type === "choice") {
    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "opt";
      const letter = document.createElement("span");
      letter.className = "letter";
      letter.textContent = "ABCD"[i] || String(i + 1);
      btn.append(letter, document.createTextNode(opt));
      btn.addEventListener("click", () => {
        box.querySelectorAll(".opt").forEach((b) => b.classList.remove("picked"));
        btn.classList.add("picked");
        submitAnswer(i, opt);
      });
      box.append(btn);
    });
  } else {
    const form = document.createElement("form");
    const input = document.createElement(q.manualReview ? "textarea" : "input");
    if (!q.manualReview) input.type = "text";
    input.maxLength = q.manualReview ? 1200 : 160;
    input.setAttribute("aria-label", q.manualReview ? "List the differences you found" : "Your answer");
    input.placeholder = "Type your answer…";
    input.required = true;
    const btn = document.createElement("button");
    btn.type = "submit";
    btn.className = "btn";
    btn.textContent = "Lock it in";
    form.append(input, btn);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submitAnswer(input.value.trim(), input.value.trim());
    });
    box.append(form);
  }
}

function startTimer() {
  clearInterval(timerHandle);
  const startMs = game.questionStart ? game.questionStart.toMillis() : Date.now();
  const total = QUESTION_SECONDS * 1000;
  const CIRC = 2 * Math.PI * 54;
  const ring = $("timer-ring");
  const timer = document.querySelector(".timer");
  const tick = () => {
    const remain = Math.max(0, total - (Date.now() - startMs));
    const secs = Math.ceil(remain / 1000);
    $("timer-num").textContent = secs;
    ring.style.strokeDashoffset = CIRC * (1 - remain / total);
    timer.classList.toggle("low", secs <= 10);
    document.body.classList.toggle("time-up", remain <= 0);
    if (remain <= 0) {
      if (myTeamId) $("q-status").textContent = "Time's up!";
      clearInterval(timerHandle);
    }
  };
  tick();
  timerHandle = setInterval(tick, 100);
}

function renderReveal() {
  const q = currentQuestion();
  if (!q) return;
  applyRoundTheme();
  $("reveal-answer").textContent = q.answerLabel || (q.manualReview ? "Host review" : q.rankedAnswers ? "The survey says…" : q.type === "choice" ? q.options[q.answer] : q.answer[0]);
  $("reveal-explanation").textContent = q.explanation || "";
  $("reveal-explanation").hidden = !q.explanation;
  renderImages("reveal-images", q.revealImages || q.images);
  const survey = $("reveal-ranked");
  survey.replaceChildren();
  survey.hidden = !q.rankedAnswers;
  (q.rankedAnswers || []).forEach((answer) => {
    const row = document.createElement("div");
    const label = document.createElement("span");
    const points = document.createElement("strong");
    label.textContent = answer.label;
    points.textContent = `${answer.points} pts`;
    row.append(label, points);
    survey.append(row);
  });
  const me = myTeam();
  const el = $("reveal-result");
  if (me) {
    if (!myAnswer) {
      el.textContent = "No answer in time — 0 pts";
    } else if (q.manualReview && myAnswer.awardedPoints == null) {
      el.textContent = "Your host is reviewing your differences.";
    } else if (myAnswer.correct) {
      el.innerHTML = `Correct! <span class="pts">+${scoreForAnswer(myAnswer)} pts</span>`;
    } else {
      el.textContent = `Not this time, ${me.name} — 0 pts`;
    }
  } else {
    el.textContent = "";
  }
  if (hostAuthed) renderHostAnswers();
}

function renderBoard(el) {
  el.innerHTML = "";
  teams.forEach((t, i) => {
    const li = document.createElement("li");
    if (t.id === myTeamId) li.className = "you";
    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = i + 1;
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = t.id === myTeamId ? `${t.name} (you)` : t.name;
    const score = document.createElement("span");
    score.className = "score";
    score.textContent = t.score;
    li.append(rank, name, score);
    el.append(li);
  });
  if (hostAuthed && el.id === "lb-list") {
    const next = QUESTION_LIST[game.questionIndex + 1];
    $("btn-next").textContent = game.questionIndex + 1 < QUESTION_LIST.length
      ? next.round !== currentQuestion().round ? "Next round →" : "Next question →"
      : "See final results 🏆";
  }
}

function renderFinal() {
  renderBoard($("final-list"));
  $("winner").textContent = teams.length
    ? `🏆 ${teams[0].name} win${teams[0].name.endsWith("s") ? "" : "s"} with ${teams[0].score} points!`
    : "";
}

// ---------- host widgets ----------
function updateAnsweredCount() {
  const n = allAnswers.filter((a) => a.qIndex === game.questionIndex).length;
  $("answered-count").textContent = `${n} of ${teams.length} team${teams.length === 1 ? "" : "s"} answered`;
}

function renderHostAnswers() {
  const wrap = $("host-answers");
  wrap.innerHTML = "";
  teams.forEach((t) => {
    const a = allAnswers.find((x) => x.qIndex === game.questionIndex && x.teamId === t.id);
    const row = document.createElement("div");
    row.className = "ha-row";
    const name = document.createElement("span");
    name.className = "ha-name";
    name.textContent = t.name;
    const ans = document.createElement("span");
    ans.className = "ha-ans";
    ans.textContent = a ? a.answer : "— no answer —";
    const pts = document.createElement("span");
    pts.className = "ha-pts";
    pts.textContent = a ? `${scoreForAnswer(a)} pts` : "0 pts";
    row.append(name, ans, pts);
    if (a) {
      const q = currentQuestion();
      if (q.rankedAnswers || q.manualReview) {
        const select = document.createElement("select");
        select.setAttribute("aria-label", `Award points to ${t.name}`);
        if (q.manualReview && a.awardedPoints == null) {
          const pending = document.createElement("option");
          pending.value = "";
          pending.textContent = "Review differences…";
          pending.disabled = true;
          select.append(pending);
        }
        const values = q.rankedAnswers ? [0, ...q.rankedAnswers.map((r) => r.points)] : Array.from({ length: 11 }, (_, i) => i);
        values.forEach((value) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = q.rankedAnswers ? value === 0 ? "0 — no match" : `${value} — ${q.rankedAnswers.find((r) => r.points === value).label}` : `${value} differences`;
          select.append(option);
        });
        select.value = q.manualReview && a.awardedPoints == null ? "" : scoreForAnswer(a);
        select.addEventListener("change", () => updateDoc(doc(answersCol, a.id), {
          awardedPoints: Number(select.value), correct: Number(select.value) > 0
        }));
        row.append(select);
      } else {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "ha-toggle " + (a.correct ? "ok" : "no");
        toggle.textContent = a.correct ? "✓ correct" : "✗ wrong";
        toggle.addEventListener("click", () =>
          updateDoc(doc(answersCol, a.id), { correct: !a.correct }));
        row.append(toggle);
      }
    }
    wrap.append(row);
  });
}

// ---------- player actions ----------
$("join-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("team-name").value.trim();
  if (!name) return;
  $("join-error").textContent = "";
  if (teamsLoaded && teams.some((t) => (t.nameLower || "") === name.toLowerCase())) {
    $("join-error").textContent = "That team name is taken — try another one.";
    return;
  }
  const ref = await addDoc(teamsCol, {
    name,
    nameLower: name.toLowerCase(),
    score: 0,
    createdAt: serverTimestamp()
  });
  myTeamId = ref.id;
  localStorage.setItem("trivia.teamId", ref.id);
  render();
});

async function submitAnswer(value, display) {
  if (!myTeamId || !game || game.state !== "question") return;
  const startMs = game.questionStart ? game.questionStart.toMillis() : Date.now();
  const timeMs = Date.now() - startMs;
  if (timeMs >= QUESTION_SECONDS * 1000) return;
  const q = currentQuestion();
  const correct = q.type === "choice"
    ? value === q.answer
    : q.answer.some((a) => norm(a) === norm(value));
  await setDoc(doc(answersCol, game.questionIndex + "_" + myTeamId), {
    qIndex: game.questionIndex,
    teamId: myTeamId,
    teamName: (myTeam() || {}).name || "",
    answer: display,
    correct,
    awardedPoints: null,
    timeMs,
    submittedAt: serverTimestamp()
  });
  $("q-status").textContent = "Answer locked in! You can change it until time runs out.";
}

// ---------- host actions ----------
$("btn-start").addEventListener("click", () => {
  if (!QUESTION_LIST.length) {
    alert("No questions yet — add some in questions.js first!");
    return;
  }
  questionRenderKey = null;
  updateDoc(gameRef, { state: "round", questionIndex: 0, questionStart: null });
});

$("btn-round-start").addEventListener("click", () =>
  updateDoc(gameRef, { state: "question", questionStart: serverTimestamp() }));

$("btn-reveal").addEventListener("click", () =>
  updateDoc(gameRef, { state: "reveal" }));

$("btn-to-leaderboard").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    const qIndex = game.questionIndex;
    // The Web SDK's transaction.get accepts document references, not queries.
    const submitted = await getDocs(query(answersCol, where("qIndex", "==", qIndex)));
    if (currentQuestion().manualReview && submitted.docs.some((d) => d.data().awardedPoints == null)) {
      alert("Review each team's differences and assign points before showing the leaderboard.");
      return;
    }
    const answerRefs = submitted.docs.map((d) => d.ref);
    await runTransaction(db, async (tx) => {
      const gSnap = await tx.get(gameRef);
      if (gSnap.data().scoredFor === qIndex) {
        tx.update(gameRef, { state: "leaderboard" });
        return;
      }
      const answerSnaps = [];
      for (const ref of answerRefs) {
        const snap = await tx.get(ref);
        if (snap.exists()) answerSnaps.push(snap);
      }
      const teamIds = [...new Set(answerSnaps.map((d) => d.data().teamId))];
      const teamSnaps = {};
      for (const id of teamIds) teamSnaps[id] = await tx.get(doc(teamsCol, id));
      const deltas = {};
      answerSnaps.forEach((d) => {
        const a = d.data();
        const pts = scoreForAnswer(a, QUESTION_LIST[qIndex]);
        tx.update(d.ref, { points: pts });
        deltas[a.teamId] = (deltas[a.teamId] || 0) + pts;
      });
      Object.entries(deltas).forEach(([id, pts]) => {
        if (teamSnaps[id].exists()) tx.update(doc(teamsCol, id), { score: increment(pts) });
      });
      tx.update(gameRef, { scoredFor: qIndex, state: "leaderboard" });
    });
  } finally {
    btn.disabled = false;
  }
});

$("btn-next").addEventListener("click", () => {
  if (game.questionIndex + 1 < QUESTION_LIST.length) {
    updateDoc(gameRef, {
      state: QUESTION_LIST[game.questionIndex + 1].round !== currentQuestion().round ? "round" : "question",
      questionIndex: increment(1),
      questionStart: serverTimestamp()
    });
  } else {
    updateDoc(gameRef, { state: "final" });
  }
});

$("btn-reset").addEventListener("click", async () => {
  if (!confirm("Clear all teams and scores and go back to the lobby?")) return;
  for (const col of [teamsCol, answersCol]) {
    const snap = await getDocs(col);
    for (let i = 0; i < snap.docs.length; i += 450) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await updateDoc(gameRef, { state: "lobby", questionIndex: 0, scoredFor: -1, questionStart: null });
  questionRenderKey = null;
});
