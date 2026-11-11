# gatherly-experiences

The [Gatherly](https://gatherlyexperiences.com) website — a static HTML/CSS/JS site, no build step. Push to deploy on GitHub Pages.

- [index.html](index.html) — all pages (home, about, contact, self-hosted, hosted, category details) in one file; [site.js](site.js) hash-routes between them and renders the category lists from its `categories` data.
- [style.css](style.css) — the site design (DM Sans + Manrope, ivory/ink/coral palette).
- [assets/gatherly/](assets/gatherly) — category and service photos.

## Trivia Night

A live team trivia game for Zoom events lives at `/trivia` ([trivia.html](trivia.html)). Teams join on their own devices, answer on a 60-second timer, and a host controls the pacing. See [TRIVIA-SETUP.md](TRIVIA-SETUP.md) for the one-time Firebase setup and how to add questions in [questions.js](questions.js).

The current Holiday Game Show includes 49 questions and challenges across six
rounds, using the supplied PDF artwork. Music clips must be played separately
by the host; see the preparation notes in TRIVIA-SETUP.md.

Hosts create a game at `/trivia?host=1`. Each game gets its own code and player
URL (`/trivia?game=CODE`), with independent teams, answers, and scores. The
host lobby includes a copyable player link and a separate link to resume
hosting. Opening `/trivia` shows the create/join screen.

Run the offline content, rendering, round-transition, and scoring checks with
`node --test tests/trivia.test.cjs`. No build step or npm dependencies are needed.
