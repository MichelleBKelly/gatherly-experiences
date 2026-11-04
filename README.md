# gatherly-experiences

The [Gatherly](https://gatherlyexperiences.com) website — a static HTML/CSS/JS site, no build step. Push to deploy on GitHub Pages.

- [index.html](index.html) — all pages (home, about, contact, self-hosted, hosted, category details) in one file; [site.js](site.js) hash-routes between them and renders the category lists from its `categories` data.
- [style.css](style.css) — the site design (DM Sans + Manrope, ivory/ink/coral palette).
- [assets/gatherly/](assets/gatherly) — category and service photos.

## Trivia Night

A live team trivia game for Zoom events lives at `/trivia` ([trivia.html](trivia.html)). Teams join on their own devices, answer on a 60-second timer, and a host controls the pacing. See [TRIVIA-SETUP.md](TRIVIA-SETUP.md) for the one-time Firebase setup and how to add questions in [questions.js](questions.js).