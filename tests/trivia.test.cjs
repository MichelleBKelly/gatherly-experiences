// Offline integration checks: real game code with DOM / Firestore boundaries stubbed.
// Run with: node --test tests/trivia.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

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
  querySelector() { return this.children.find(c => c.tagName === 'button') || new Element('button'); }
  select() {}
}

function fixture(options = {}) {
  const html = fs.readFileSync('trivia.html', 'utf8');
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(m => [m[1], new Element()]));
  elements.forEach((el, id) => { el.id = id; });
  const calls = [];
  const answerDocs = [];
  const alerts = [];
  const navigations = [];
  const subscriptions = [];
  const storage = new Map(Object.entries(options.storage || {}));
  const session = new Map(options.authed === false ? [] : [['trivia.host.ROOM0001', '1']]);
  const records = options.records || new Map([['trivia/ROOM0001', { scoredFor: -1 }]]);
  const snap = (ref, data) => ({ ref, id: ref.path.split('/').pop(), exists: () => data !== undefined, data: () => data });
  const search = options.search ?? '?game=ROOM0001&host=1';
  const context = vm.createContext({
    console, URLSearchParams, URL, Date, Math, Set, crypto: options.crypto || webcrypto,
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
    location: { search, href: 'https://gatherlyexperiences.com/trivia' + search, assign: url => navigations.push(url) },
    navigator: { clipboard: { async writeText(value) { calls.push({ method: 'clipboard', value }); } } },
    prompt: () => 'test-pin', alert: value => alerts.push(value), confirm: () => true,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    sessionStorage: { getItem: key => session.get(key), setItem: (key, value) => session.set(key, value) },
    setInterval: () => 1, clearInterval() {},
    FIREBASE_CONFIG: { apiKey: 'configured' }, HOST_PIN: 'test-pin',
    initializeApp: () => ({}), getFirestore: () => ({}),
    doc: (parent, ...parts) => ({ path: [parent.path, ...parts].filter(Boolean).join('/') }),
    collection: (parent, name) => ({ path: [parent.path, name].filter(Boolean).join('/') }),
    onSnapshot(ref, next, error) { subscriptions.push({ ref, next, error }); return () => {}; }, orderBy: () => ({}),
    query: (collection, filter) => ({ isQuery: true, collection, filter }),
    where: (field, op, value) => ({ field, value }),
    getDocs: async query => ({ docs: answerDocs.filter(d => d.data().qIndex === query.filter?.value) }),
    setDoc: async (ref, data) => { calls.push({ method: 'set', ref, data }); },
    updateDoc: async (ref, data) => { calls.push({ method: 'update', ref, data }); },
    addDoc: async () => ({ id: 'team1' }),
    serverTimestamp: () => ({ timestamp: true }), increment: value => ({ increment: value }),
    writeBatch: () => ({ delete() {}, async commit() {} }),
    runTransaction: async (db, callback) => {
      if (options.transactionError) throw new Error('Connection failed');
      return callback({
      async get(ref) {
        assert.ok(!ref.isQuery, 'transaction reads document references only');
        if (ref.path.split('/').length === 2) return snap(ref, records.get(ref.path));
        return answerDocs.find(d => d.ref.path === ref.path) || snap(ref, { score: 0 });
      },
      set(ref, data) { records.set(ref.path, data); calls.push({ method: 'create', ref, data }); },
      update(ref, data) {
        if (records.has(ref.path)) records.set(ref.path, { ...records.get(ref.path), ...data });
        calls.push({ method: 'transaction', ref, data });
      }
    }); }
  });
  vm.runInContext(fs.readFileSync('questions.js', 'utf8'), context);
  const source = fs.readFileSync('trivia.js', 'utf8').replace(/^import[\s\S]*?from "[^"]+";\r?$/gm, '');
  vm.runInContext(source, context);
  const run = source => vm.runInContext(source, context);
  const setQuestion = (index, state = 'question') => run(`
    game = { state: '${state}', questionIndex: ${index}, questionStart: { toMillis: () => Date.now() }, scoredFor: -1 };
    gameLoaded = true; teamsLoaded = true;
    questionRenderKey = null; render();
  `);
  return { run, elements, calls, answerDocs, alerts, snap, setQuestion, navigations, records, subscriptions, storage };
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
  f.answerDocs.push(f.snap({ path: 'trivia/ROOM0001/answers/48_team1' }, answer));
  const btn = f.elements.get('btn-to-leaderboard');
  await btn.listeners.click({ currentTarget: btn });
  assert.equal(f.alerts.length, 1);
  assert.equal(btn.disabled, false);
  answer.awardedPoints = 0;
  await btn.listeners.click({ currentTarget: btn });
  assert.equal(f.calls.at(-1).data.state, 'leaderboard');
});

test('the entry page never subscribes to or reopens the old shared game', () => {
  const f = fixture({ search: '', storage: { 'trivia.teamId': 'old-team' } });
  assert.equal(f.run('document.body.dataset.screen'), 'home');
  assert.equal(f.run('myTeamId'), null);
  assert.equal(f.subscriptions.length, 0);
  assert.equal(f.run('parseGameId("game")'), null);
  assert.equal(f.run('parseGameId("bad/path")'), null);
  assert.equal(f.run('parseGameId("https://gatherlyexperiences.com/trivia?game=ROOM0001&host=1")'), 'ROOM0001');
});

test('creating games reserves separate rooms with fresh holiday state and separate links', async () => {
  const f = fixture({ search: '?host=1' });
  const first = await f.run('createGame()');
  const second = await f.run('createGame()');
  assert.notEqual(first, second);
  for (const id of [first, second]) {
    assert.match(id, /^[A-Z2-9]{8}$/);
    const data = f.records.get('trivia/' + id);
    assert.equal(data.state, 'lobby');
    assert.equal(data.questionIndex, 0);
    assert.equal(data.scoredFor, -1);
    assert.equal(data.questionStart, null);
    assert.equal(data.questionCount, 49);
    assert.equal(data.questionSetId, 'holiday-game-show-49-v1');
    const playerUrl = new URL(f.run(`gameUrl('${id}')`));
    const hostUrl = new URL(f.run(`gameUrl('${id}', true)`));
    assert.equal(playerUrl.searchParams.get('game'), id);
    assert.equal(playerUrl.searchParams.has('host'), false);
    assert.equal(hostUrl.searchParams.get('host'), '1');
  }
  assert.equal(f.records.has('trivia/game'), false);
});

test('code collisions retry without overwriting an existing room', async () => {
  let count = 0;
  const records = new Map([['trivia/AAAAAAAA', { state: 'final', score: 123 }]]);
  const f = fixture({ search: '?host=1', records, crypto: { getRandomValues: values => values.fill(count++) } });
  assert.equal(await f.run('createGame()'), 'BBBBBBBB');
  assert.equal(records.get('trivia/AAAAAAAA').score, 123);
});

test('host form requires the PIN, creates a room, and reports connection failures', async () => {
  const f = fixture({ search: '?host=1' });
  const submit = () => f.elements.get('host-form').listeners.submit({ preventDefault() {} });
  f.elements.get('host-pin').value = 'wrong';
  await submit();
  assert.equal(f.navigations.length, 0);
  assert.match(f.elements.get('host-error').textContent, /PIN/);
  f.elements.get('host-pin').value = 'test-pin';
  await submit();
  assert.equal(f.navigations.length, 1);
  assert.equal(new URL(f.navigations[0]).searchParams.get('host'), '1');
  const failing = fixture({ search: '?host=1', transactionError: true });
  failing.elements.get('host-pin').value = 'test-pin';
  await failing.elements.get('host-form').listeners.submit({ preventDefault() {} });
  assert.equal(failing.navigations.length, 0);
  assert.match(failing.elements.get('host-error').textContent, /Couldn't open/);
  assert.equal(failing.elements.get('btn-host-submit').disabled, false);
});

test('room links isolate teams and answers and restore only that room membership', () => {
  const storage = { 'trivia.teamId': 'legacy', 'trivia.ROOM0001.teamId': 'one', 'trivia.ROOM0002.teamId': 'two' };
  const one = fixture({ search: '?game=ROOM0001', storage });
  const two = fixture({ search: '?game=ROOM0002', storage });
  assert.equal(one.run('myTeamId'), 'one');
  assert.equal(two.run('myTeamId'), 'two');
  assert.equal(one.run('teamsCol.path'), 'trivia/ROOM0001/teams');
  assert.equal(two.run('answersCol.path'), 'trivia/ROOM0002/answers');
  assert.equal(one.run('hostAuthed'), false);
  assert.ok(one.subscriptions.every(s => (s.ref.path || s.ref.collection.path).startsWith('trivia/ROOM0001')));
});

test('missing, incompatible, and malformed games show a recovery screen without creating anything', () => {
  for (const data of [undefined, { questionSetId: 'old-planets', questionCount: 4 }, { questionSetId: 'holiday-game-show-49-v1', questionCount: 49, state: 'reveal', questionIndex: 100 }]) {
    const f = fixture({ search: '?game=ROOM0001' });
    f.subscriptions[0].next(f.snap({ path: 'trivia/ROOM0001' }, data));
    assert.equal(f.run('document.body.dataset.screen'), 'unavailable');
    assert.ok(f.elements.get('unavailable-message').textContent);
    assert.equal(f.calls.length, 0);
  }
  const invalid = fixture({ search: '?game=game&host=1' });
  assert.equal(invalid.run('document.body.dataset.screen'), 'unavailable');
  assert.equal(invalid.subscriptions.length, 0);
});

test('joining with a link or lowercase code produces a player URL and drops host mode', async () => {
  const f = fixture({ search: '' });
  for (const value of ['room0001', 'https://gatherlyexperiences.com/trivia?game=ROOM0001&host=1']) {
    f.elements.get('game-code-input').value = value;
    await f.elements.get('game-code-form').listeners.submit({ preventDefault() {} });
    const url = new URL(f.navigations.at(-1));
    assert.equal(url.searchParams.get('game'), 'ROOM0001');
    assert.equal(url.searchParams.has('host'), false);
  }
});

test('host resume requires PIN; copy uses player link; play again preserves old scores', async () => {
  const locked = fixture({ authed: false });
  assert.equal(locked.run('document.body.dataset.screen'), 'host');
  assert.equal(locked.subscriptions.length, 0);
  locked.elements.get('host-pin').value = 'test-pin';
  await locked.elements.get('host-form').listeners.submit({ preventDefault() {} });
  assert.equal(locked.run('hostAuthed'), true);
  assert.equal(locked.run('gameRef.path'), 'trivia/ROOM0001');
  const f = fixture();
  await f.elements.get('btn-copy-player').listeners.click();
  assert.equal(new URL(f.calls.at(-1).value).searchParams.has('host'), false);
  const original = JSON.stringify([...f.records]);
  await f.elements.get('btn-reset').listeners.click();
  assert.equal(JSON.stringify([...f.records]), original);
  assert.equal(new URL(f.navigations.at(-1)).search, '?host=1');
});
