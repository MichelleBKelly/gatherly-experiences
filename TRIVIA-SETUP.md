# Trivia Night — Setup Guide

The trivia game lives at **gatherlyexperiences.com/trivia** and uses a free
Firebase backend so teams can sign up, answer, and watch the leaderboard live
on their own devices. One-time setup takes about 5 minutes.

## 1. Create a free Firebase project

1. Go to <https://console.firebase.google.com> and sign in with a Google account.
2. Click **Add project** → name it anything (e.g. `gatherly-trivia`) → you can
   disable Google Analytics → **Create project**.
3. On the project overview page, click the **Web** icon (`</>`) to add a web app.
   - Nickname: `trivia` (anything works)
   - Skip Firebase Hosting
   - Click **Register app** — you'll see a `firebaseConfig` object. Keep this page open.

## 2. Paste the config

Open `firebase-config.js` in this project and replace the `PASTE_...` values
with the ones from the config object. While you're there, change `HOST_PIN`
to something only you know.

## 3. Turn on the database

1. In the Firebase console left menu: **Build → Firestore Database**.
2. Click **Create database** → **Start in production mode** → pick any region → **Enable**.
3. Go to the **Rules** tab and replace the rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trivia/{document=**} {
      allow read, write: if true;
    }
  }
}
```

4. Click **Publish**.

> These rules leave the game open to anyone who has the link — fine for a
> trivia night with friends, but don't store anything sensitive in it.

## 4. Add your questions

Open `questions.js` and replace the sample questions. Two types:

```js
// Multiple choice — "answer" is the index of the correct option (0 = first):
{ type: "choice", question: "...", options: ["A", "B", "C", "D"], answer: 2 }

// Typed answer — list every spelling you'll accept (case/punctuation ignored):
{ type: "text", question: "...", answer: ["paris", "paris france"] }
```

Scoring is speed-based: correct answers earn **500–1000 points** depending on
how fast they come in during the 60-second timer.

## 5. Commit and push

Push these files to GitHub and the game goes live at
`gatherlyexperiences.com/trivia` within a minute or two.

## Running the game on Zoom

- **You (host):** open `gatherlyexperiences.com/trivia?host=1` and enter your
  PIN. You get the host panel: start the game, reveal answers, fix any typed
  answers that were close enough, and advance to the next question.
- **Players:** open `gatherlyexperiences.com/trivia`, enter a team name, and
  play from their phone or laptop. One device per team.
- Each question runs on a 60-second countdown. When time's up (or everyone's
  in), click **Reveal answer**, then **Show leaderboard**, then **Next question**.
- On the final question the host button becomes **See final results 🏆**.
  From there, **Play again** wipes teams and scores for a fresh game.
- Tip: share your host screen on Zoom so everyone can see the timer and
  leaderboard big — players still answer on their own devices.

## Testing locally

Because the game loads Firebase as an ES module, opening `trivia.html`
straight from disk won't work in some browsers. Run a tiny local server from
this folder instead:

```
python -m http.server 8000
```

then open `http://localhost:8000/trivia.html?host=1` in one window (host) and
`http://localhost:8000/trivia.html` in another (player).
