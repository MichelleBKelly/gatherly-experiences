// Offline integration checks: real game code with DOM / Firestore boundaries stubbed.
// Run with: node --test tests/trivia.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.listeners = {};
    this.hidden = false;
    this.style = { setProperty() {} };
    this.classList = { add() {}, remove() {}, toggle() {} };
    this.dataset = {};
    this.value = '';
  }
  set innerHTML(value) { this.children = []; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  setAttribute(name, value) { this[name] = value; }
  querySelectorAll() { return this.children.filter(c => c.tagName === 'button'); }
}

function fixture() {
  const html = fs.readFileSync('trivia.html', 'utf8');
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(m => [m[1], new Element()]));
  elements.forEach((el, id) => { el.id = id; });
  const calls = [];
  const answerDocs = [];
  const alerts = [];
  const snap = (ref, data) => ({ ref, id: ref.path.split('/').pop(), exists: () => true, data: () => data });
  const context = vm.createContext({
    console, URLSearchParams, Date, Math, Set,
    document: {
      body: new Element('body'),
      getElementById: id => {
        assert.ok(elements.has(id), `HTML element exists: ${id}`);
        return elements.get(id);
      },
      createElement: tag => new Element(tag),
      createTextNode: text => ({ textContent: text }),
      querySelector: () => new Element()
    },
    location: { search: '?host=1' },
    prompt: () => 'test-pin', alert: value => alerts.push(value), confirm: () => true,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setInterval: () => 1, clearInterval() {},
    FIREBASE_CONFIG: { apiKey: 'configured' }, HOST_PIN: 'test-pin',
    initializeApp: () => ({}), getFirestore: () => ({}),
    doc: (...args) => ({ path: args.slice(1).map(a => typeof a === 'string' ? a : a.path).join('/') }),
    collection: (parent, name) => ({ path: parent.path + '/' + name }),
    onSnapshot() { return () => {}; }, orderBy: () => ({}),
    query: (collection, filter) => ({ isQuery: true, collection, filter }),
    where: (field, op, value) => ({ field, value }),
    getDocs: async query => ({ docs: answerDocs.filter(d => d.data().qIndex === query.filter?.value) }),
    setDoc: async (ref, data) => { calls.push({ method: 'set', ref, data }); },
    updateDoc: async (ref, data) => { calls.push({ method: 'update', ref, data }); },
    addDoc: async () => ({ id: 'team1' }),
    serverTimestamp: () => ({ timestamp: true }), increment: value => ({ increment: value }),
    writeBatch: () => ({ delete() {}, async commit() {} }),
    runTransaction: async (db, callback) => callback({
      async get(ref) {
        assert.ok(!ref.isQuery, 'transaction reads document references only');
        if (ref.path === 'trivia/game') return snap(ref, { scoredFor: -1 });
        return answerDocs.find(d => d.ref.path === ref.path) || snap(ref, { score: 0 });
      },
      update(ref, data) { calls.push({ method: 'transaction', ref, data }); }
    })
  });
  vm.runInContext(fs.readFileSync('questions.js', 'utf8'), context);
  const source = fs.readFileSync('trivia.js', 'utf8').replace(/^import[\s\S]*?from "[^"]+";\r?$/gm, '');
  vm.runInContext(source, context);
  const run = source => vm.runInContext(source, context);
  const setQuestion = (index, state = 'question') => run(`
    game = { state: '${state}', questionIndex: ${index}, questionStart: { toMillis: () => Date.now() }, scoredFor: -1 };
    questionRenderKey = null; render();
  `);
  return { run, elements, calls, answerDocs, alerts, snap, setQuestion };
}

test('49 valid questions cover six rounds and every image can be loaded locally', () => {
  const { run } = fixture();
  const data = JSON.parse(run('JSON.stringify({ questions: QUESTIONS, rounds: HOLIDAY_ROUNDS })'));
  assert.equal(data.questions.length, 49);
  assert.deepEqual(data.rounds.map((_, i) => data.questions.filter(q => q.round === i + 1).length), [9, 1, 7, 6, 7, 19]);
  for (const q of data.questions) {
    assert.equal(q.points, 10);
    if (q.type === 'choice') assert.ok(q.answer >= 0 && q.answer < q.options.length);
    else assert.ok(q.answer.length || q.manualReview);
    for (const img of [...q.images || [], ...q.revealImages || []]) {
      assert.ok(fs.existsSync(img.src), img.src);
      assert.ok(img.alt);
    }
    if (q.rankedAnswers) assert.deepEqual(q.rankedAnswers.map(a => a.points), [30, 25, 20, 15, 10]);
  }
  for (const round of data.rounds) assert.ok(fs.existsSync('assets/holiday/' + round.background));
  const manifest = JSON.parse(fs.readFileSync('assets/holiday/manifest.json'));
  assert.equal(new Set(manifest.map(m => m.file)).size, 35);
  manifest.forEach(m => assert.ok(fs.existsSync('assets/holiday/' + m.file)));
});

test('every question, reveal and round screen renders for host and player', () => {
  const { run, setQuestion, elements } = fixture();
  for (const host of [true, false]) {
    run(`hostAuthed = ${host}; myTeamId = ${host ? 'null' : '"team1"'}; teams = [{ id: 'team1', name: 'Snow Team', score: 0 }];`);
    for (let i = 0; i < 49; i++) {
      setQuestion(i, 'round');
      assert.ok(elements.get('round-title').textContent);
      setQuestion(i);
      assert.ok(elements.get('q-text').textContent);
      assert.ok(elements.get('q-options').children.length);
      assert.equal(elements.get('q-host-cue').open, false);
      setQuestion(i, 'reveal');
      assert.ok(elements.get('reveal-answer').textContent);
    }
  }
});

test('holiday scoring, survey matches, host overrides and manual partial credit', () => {
  const { run, setQuestion } = fixture();
  setQuestion(0);
  assert.equal(run('scoreForAnswer({ correct: true, timeMs: 59000 })'), 10);
  assert.equal(run('scoreForAnswer({ correct: false, timeMs: 0 })'), 0);
  setQuestion(23);
  assert.equal(run('scoreForAnswer({ correct: true, answer: "RELAX!" })'), 30);
  assert.equal(run('scoreForAnswer({ correct: true, answer: "travel" })'), 25);
  assert.equal(run('scoreForAnswer({ correct: true, answer: "near match", awardedPoints: 20 })'), 20);
  assert.equal(run('norm("Bûche de Noël")'), 'buche de noel');
  setQuestion(48);
  assert.equal(run('scoreForAnswer({ correct: true, awardedPoints: 7 })'), 7);
  assert.equal(run('scoreForAnswer({ correct: false, awardedPoints: 0 })'), 0);
});

test('host pauses at round boundaries and finishes after the final question', async () => {
  const { elements, calls, setQuestion } = fixture();
  await elements.get('btn-start').listeners.click();
  assert.equal(calls.at(-1).data.state, 'round');
  await elements.get('btn-round-start').listeners.click();
  assert.equal(calls.at(-1).data.state, 'question');
  for (let i = 0; i < 49; i++) {
    setQuestion(i);
    await elements.get('btn-next').listeners.click();
    assert.equal(calls.at(-1).data.state, i === 48 ? 'final' : [8,9,16,22,29].includes(i) ? 'round' : 'question');
  }
});

test('submissions and leaderboard use the same survey score; transaction reads documents', async () => {
  const f = fixture();
  f.setQuestion(23);
  f.run('myTeamId = "team1"; teams = [{ id: "team1", name: "Snow Team", score: 0 }];');
  await f.run('submitAnswer("travel", "travel")');
  const submitted = f.calls.at(-1);
  assert.equal(submitted.data.correct, true);
  f.answerDocs.push(f.snap(submitted.ref, submitted.data));
  await f.elements.get('btn-to-leaderboard').listeners.click({ currentTarget: f.elements.get('btn-to-leaderboard') });
  assert.ok(f.calls.some(c => c.data.points === 25));
  assert.ok(f.calls.some(c => c.data.score?.increment === 25));
  assert.equal(f.calls.at(-1).data.state, 'leaderboard');
});

test('manual review blocks ungraded differences and accepts explicit zero points', async () => {
  const f = fixture();
  f.setQuestion(48, 'reveal');
  const answer = { qIndex: 48, teamId: 'team1', answer: 'The moon is different', correct: false, awardedPoints: null };
  f.answerDocs.push(f.snap({ path: 'trivia/game/answers/48_team1' }, answer));
  const btn = f.elements.get('btn-to-leaderboard');
  await btn.listeners.click({ currentTarget: btn });
  assert.equal(f.alerts.length, 1);
  assert.equal(btn.disabled, false);
  answer.awardedPoints = 0;
  await btn.listeners.click({ currentTarget: btn });
  assert.equal(f.calls.at(-1).data.state, 'leaderboard');
});
