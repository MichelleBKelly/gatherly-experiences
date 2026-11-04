// ============================================================================
// TRIVIA QUESTIONS — edit this file to add your own!
//
// Two question types:
//
//   Multiple choice — "answer" is the index of the correct option (0-based):
//     { type: "choice", question: "...", options: ["A", "B", "C", "D"], answer: 2 }
//
//   Typed answer — "answer" is a list of accepted answers. Matching ignores
//   capitalization, punctuation, and leading "the/a/an", and the host can
//   override any answer on the reveal screen:
//     { type: "text", question: "...", answer: ["paris", "paris france"] }
//
// Scoring is speed-based: a correct answer earns 500–1000 points depending
// on how fast it was submitted (60-second timer).
// ============================================================================

const QUESTIONS = [
  {
    type: "choice",
    question: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Mercury"],
    answer: 1
  },
  {
    type: "text",
    question: "What is the capital city of Canada?",
    answer: ["ottawa"]
  },
  {
    type: "choice",
    question: "How many players are on a basketball team on the court?",
    options: ["4", "5", "6", "7"],
    answer: 1
  },
  {
    type: "text",
    question: "In what year did the first iPhone come out?",
    answer: ["2007"]
  }
];
