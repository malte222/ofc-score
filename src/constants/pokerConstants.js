// src/constants/pokerConstants.js
// All poker rules, ranks, and royalty point values for Pineapple OFC

export const BACKGROUND_COLOR = "#134e2a"; // Klassisches Poker-Grün
export const BACKGROUND_IMAGE_URL = "";    // Optional: z. B. "https://domain.de/felt.jpg"

export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
export const RANK_VAL = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));

export const BOTTOM_ROYALTIES = {
  Straight: 2,
  Flush: 4,
  "Full House": 6,
  "Four of a Kind": 10,
  "Straight Flush": 15,
  "Royal Flush": 25,
};

export const MIDDLE_ROYALTIES = {
  "Three of a Kind": 2,
  Straight: 4,
  Flush: 8,
  "Full House": 12,
  "Four of a Kind": 20,
  "Straight Flush": 30,
  "Royal Flush": 50,
};

export const TOP_ROYALTIES = {
  66: 1, 77: 2, 88: 3, 99: 4, TT: 5, JJ: 6, QQ: 7, KK: 8, AA: 9,
  222: 10, 333: 11, 444: 12, 555: 13, 666: 14, 777: 15, 888: 16,
  999: 17, TTT: 18, JJJ: 19, QQQ: 20, KKK: 21, AAA: 22,
};

export const FL_TOP_QUALIFIERS = [
  "QQ", "KK", "AA", "222", "333", "444", "555", "666", "777",
  "888", "999", "TTT", "JJJ", "QQQ", "KKK", "AAA",
];
