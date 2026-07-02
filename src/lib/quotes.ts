export const QUOTES: { text: string; author: string }[] = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "Your only limit is your mind.", author: "Unknown" },
  { text: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "Small daily improvements are the key to staggering long-term results.", author: "Unknown" },
  { text: "What you do every day matters more than what you do once in a while.", author: "Gretchen Rubin" },
];

/** Deterministic quote-of-the-day so it stays stable through the day. */
export function quoteOfTheDay(date = new Date()): { text: string; author: string } {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  return QUOTES[dayOfYear % QUOTES.length];
}
