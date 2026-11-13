// Gatherly — hash router and category rendering.
// Ported from the Figma Make React app (src/App.tsx): same routes, same data.

const ARROW = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h13M11 5l5 5-5 5"/></svg>';
const CONTACT_EMAIL = 'info@gatherlyexperiences.com';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// [number, title, copy, slug, [[game, description], ...]]
const categories = [
  ['01', 'Team Building', 'Strengthening connections and collaboration between coworkers.', 'team-building', [['Virtual Escape Room', 'Teams solve clues, puzzles and riddles to escape before time runs out.'], ['The Great Scavenger Hunt', 'Players race to find random objects around their homes.'], ['The Survival Challenge', 'Teams rank essential items needed to survive a fictional scenario.'], ['Office Olympics', 'A series of silly, timed challenges completed individually or in teams.'], ['The Blind Drawing Challenge', 'One person describes an image while another draws it without seeing it.']]],
  ['02', 'Holiday Celebrations', "Christmas, Halloween, Valentine's Day, Easter and other holiday celebrations.", 'holiday-celebrations', [['Holiday Trivia', 'Festive trivia covering holiday movies, music, traditions and fun facts.'], ['Holiday Family Feud', 'Teams guess the most popular answers to holiday-themed survey questions.'], ['Guess the Christmas Movie', 'Identify holiday movies using images and clues.'], ['Holiday Scavenger Hunt', 'Find festive objects around your home before time runs out.'], ['Name That Holiday Tune', 'Guess popular holiday songs from short audio clips.']]],
  ['03', 'Celebrations & Special Occasions', 'Birthdays, anniversaries, retirements, farewells and important milestones.', 'special-occasions', [['How Well Do You Know Them?', 'Guests answer personalized questions about the guest of honour.'], ['Guess the Memory', 'Players guess who shared a particular memory or story.'], ['Who Said It?', 'Guess which person said a funny quote or statement.'], ['Guess the Year', 'Identify the year based on events, music, fashion and trends.'], ['The Roast & Toast', 'Guests share funny stories, compliments and memorable moments.']]],
  ['04', 'Social & Game Nights', 'Casual virtual get-togethers with friends, family or coworkers simply to have fun and connect.', 'social-game-nights', [['Virtual Family Feud', 'Guess the most popular answers to entertaining survey questions.'], ['Name That Tune', 'Identify songs from short audio clips.'], ['Pictionary', 'Draw words or phrases while everyone else guesses.'], ['The Impostor', 'One player receives a different word and must blend in.'], ['Guess the Emoji', 'Decode movies, songs, phrases and celebrities from visual clues.']]],
  ['05', 'Wellness & Connection', 'Mental wellness, mindfulness, relaxation and activities that encourage positive connections.', 'wellness-connection', [['Gratitude Bingo', 'Complete prompts focused on appreciation and positivity.'], ['Wellness Trivia', 'Test knowledge of sleep, fitness, nutrition and wellbeing.'], ['The Feel-Good Challenge', 'Complete small positive actions and uplifting activities.'], ['Bucket List Challenge', 'Share personal goals and experiences you would love to try.'], ['Virtual Mindfulness Session', 'A guided group experience with relaxation and breathing activities.']]],
  ['06', 'Creative Experiences', 'Bringing people together through creative activities, interactive workshops and opportunities to learn something new.', 'creative-experiences', [['Virtual Paint Party', 'Follow a guided painting activity together.'], ['The Doodle Challenge', 'Draw random prompts while everyone guesses the results.'], ['Mocktail Masterclass', 'Learn to make creative mocktails together.'], ['The Photography Challenge', 'Take creative photos based on a series of fun prompts.'], ['Virtual Cooking Class', 'Follow a guided recipe and prepare a meal together.']]],
  ['07', 'Competition & Challenges', 'Encouraging friendly competition through group challenges, team competitions and interactive activities.', 'competition-challenges', [['Minute to Win It', 'Complete silly and challenging tasks in 60 seconds.'], ['The Ultimate Trivia Tournament', 'Multiple trivia rounds with a leaderboard and final winner.'], ['The Mystery Box Challenge', 'Solve clues and puzzles to uncover what is inside.'], ['The Rapid-Fire Challenge', 'Answer as many questions as possible before time runs out.'], ['The Ultimate Championship', 'Different games where players earn points throughout the competition.']]],
];

const categoryImages = {
  'team-building': 'assets/gatherly/team-building.jpg',
  'holiday-celebrations': 'assets/gatherly/holidays.jpg',
  'special-occasions': 'assets/gatherly/celebrations.jpg',
  'social-game-nights': 'assets/gatherly/social-games.jpg',
  'wellness-connection': 'assets/gatherly/competition.jpg',
  'creative-experiences': 'assets/gatherly/creative.jpg',
  'competition-challenges': 'assets/gatherly/wellness.jpg',
};

// ---------- static list rendering ----------

document.getElementById('activity-list').innerHTML = categories.map(([number, title, copy, slug]) => `
  <a href="#/category/${slug}" class="activity-row">
    <img src="${categoryImages[slug]}" alt="" loading="lazy">
    <span>${number}</span>
    <div><small>Category</small><h3>${esc(title)}</h3></div>
    <p>${esc(copy)}</p>
    <i>${ARROW}</i>
  </a>`).join('');

document.getElementById('hosted-categories').innerHTML = categories.map(([number, title, copy, slug]) => `
  <a href="#/category/${slug}">
    <img src="${categoryImages[slug]}" alt="" loading="lazy">
    <span>${number}</span><h2>${esc(title)}</h2><p>${esc(copy)}</p><i>${ARROW}</i>
  </a>`).join('');

function renderCategory(slug) {
  const category = categories.find((c) => c[3] === slug) || categories[0];
  document.getElementById('category-kicker').textContent = category[0] + ' — EXPERIENCE CATEGORY';
  document.getElementById('category-title').textContent = category[1];
  document.getElementById('category-copy').textContent = category[2];
  const isHoliday = category[3] === 'holiday-celebrations';
  document.getElementById('category-games').hidden = !isHoliday;
  document.getElementById('experiences-soon').hidden = isHoliday;
  document.getElementById('game-option-grid').innerHTML = isHoliday ? `
    <article>
      <img src="assets/gatherly/holiday-showdown.jpg" alt="Friends celebrating together during the Holiday Showdown" loading="lazy">
      <span>01</span>
      <div class="game-card-copy">
        <small>Expertly hosted</small>
        <h3>Holiday Showdown</h3>
        <p>A festive virtual competition filled with holiday trivia, challenges, laughter, and seasonal surprises.</p>
      </div>
      <a href="mailto:${CONTACT_EMAIL}">Learn more ${ARROW}</a>
    </article>` : '';
}

// ---------- hash router ----------

const PAGES = ['home', 'about', 'contact', 'self-hosted', 'hosted', 'category'];
const nav = document.getElementById('site-nav');
const menuToggle = document.getElementById('menu-toggle');

const getPage = (hash) =>
  hash === '#/about' ? 'about' :
  hash === '#/contact' ? 'contact' :
  hash === '#/self-hosted' ? 'self-hosted' :
  hash === '#/hosted' ? 'hosted' :
  hash.startsWith('#/category/') ? 'category' : 'home';

function updatePage() {
  const hash = window.location.hash;
  const page = getPage(hash);
  PAGES.forEach((p) => { document.getElementById('page-' + p).hidden = p !== page; });
  if (page === 'category') renderCategory(hash.split('#/category/')[1] || '');
  nav.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
  if (hash.startsWith('#/')) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (hash.length > 1) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        try {
          const target = document.querySelector(hash);
          if (target) target.scrollIntoView({ behavior: 'smooth' });
        } catch (e) { /* not a valid selector — ignore */ }
      });
    });
  }
}

window.addEventListener('hashchange', updatePage);
updatePage();

menuToggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
});
