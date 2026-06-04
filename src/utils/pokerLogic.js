// src/utils/pokerLogic.js
// Pure poker hand evaluation and scoring logic for Pineapple OFC
// No React dependencies – fully testable

import {
    RANKS,
    RANK_VAL,
    BOTTOM_ROYALTIES,
    MIDDLE_ROYALTIES,
    TOP_ROYALTIES,
    FL_TOP_QUALIFIERS,
  } from "../constants/pokerConstants";
  
  export function parseCard(str) {
    if (!str || str.length < 2) return null;
    const rank = str.slice(0, -1);
    const suit = str.slice(-1);
    const val = RANK_VAL[rank];
    if (val === undefined) return null;
    return { rank, suit, val };
  }
  
  export function countBy(arr) {
    return arr.reduce((a, v) => {
      a[v] = (a[v] || 0) + 1;
      return a;
    }, {});
  }
  
  export function isSequential(vals) {
    const s = [...new Set(vals)].sort((a, b) => b - a);
    if (s.length < 5) return false;
    return s[0] - s[4] === 4;
  }
  
  export function evalHand(cards) {
    if (!cards || cards.length === 0)
      return { name: "High Card", rank: 0, tiebreakers: [] };
    const valid = cards.filter((c) => c && c.val !== undefined && !isNaN(c.val));
    if (valid.length === 0)
      return { name: "High Card", rank: 0, tiebreakers: [] };
    const sorted = [...valid].sort((a, b) => b.val - a.val);
    const vals = sorted.map((c) => c.val),
      suits = sorted.map((c) => c.suit),
      n = valid.length;
    if (n === 3) {
      const counts = countBy(vals);
      const trips = Object.entries(counts)
        .filter((entry) => entry[1] >= 3)
        .map((entry) => +entry[0]);
      const pairs = Object.entries(counts)
        .filter((entry) => entry[1] >= 2)
        .map((entry) => +entry[0]);
      if (trips.length)
        return {
          name: "Three of a Kind",
          rank: 7,
          trips: trips[0],
          tiebreakers: [trips[0]],
        };
      if (pairs.length) {
        const pv = Math.max(...pairs),
          k = vals.find((v) => v !== pv);
        return {
          name: "Pair",
          rank: 2,
          pair: pv,
          tiebreakers: k !== undefined ? [pv, k] : [pv],
        };
      }
      return { name: "High Card", rank: 1, high: vals[0], tiebreakers: vals };
    }
    const isFlush = new Set(suits).size === 1,
      ws = vals.slice(0, 5).join(",") === "14,5,4,3,2",
      isSt = isSequential(vals) || ws;
    const counts = countBy(vals),
      groups = Object.entries(counts).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const g0 = groups[0] || [],
      g1 = groups[1] || [];
    if (isFlush && isSt) {
      if (vals[0] === 14 && vals[1] === 13 && !ws)
        return { name: "Royal Flush", rank: 10, tiebreakers: [14] };
      return { name: "Straight Flush", rank: 9, tiebreakers: [ws ? 5 : vals[0]] };
    }
    if (g0[1] === 4)
      return {
        name: "Four of a Kind",
        rank: 8,
        quad: +g0[0],
        tiebreakers: [+g0[0], ...(g1[0] ? [+g1[0]] : [])],
      };
    if (g0[1] === 3 && g1[1] >= 2)
      return {
        name: "Full House",
        rank: 7,
        trips: +g0[0],
        pair: +g1[0],
        tiebreakers: [+g0[0], +g1[0]],
      };
    if (isFlush) return { name: "Flush", rank: 6, tiebreakers: vals };
    if (isSt)
      return {
        name: "Straight",
        rank: 5,
        high: ws ? 5 : vals[0],
        tiebreakers: [ws ? 5 : vals[0]],
      };
    if (g0[1] === 3) {
      const k = vals.filter((v) => v !== +g0[0]);
      return {
        name: "Three of a Kind",
        rank: 4,
        trips: +g0[0],
        tiebreakers: [+g0[0], ...k],
      };
    }
    if (g0[1] === 2 && g1[1] === 2) {
      const pv = [+g0[0], +g1[0]].sort((a, b) => b - a),
        k = vals.find((v) => v !== pv[0] && v !== pv[1]);
      return {
        name: "Two Pair",
        rank: 3,
        pairs: pv,
        tiebreakers: k !== undefined ? [...pv, k] : pv,
      };
    }
    if (g0[1] === 2) {
      const k = vals.filter((v) => v !== +g0[0]);
      return {
        name: "One Pair",
        rank: 2,
        pair: +g0[0],
        tiebreakers: [+g0[0], ...k],
      };
    }
    return { name: "High Card", rank: 1, high: vals[0], tiebreakers: vals };
  }
  
  export function compareHands(h1, h2) {
    if (h1.rank !== h2.rank) return h1.rank - h2.rank;
    const t1 = h1.tiebreakers || [],
      t2 = h2.tiebreakers || [];
    for (let i = 0; i < Math.max(t1.length, t2.length); i++) {
      const a = t1[i] !== undefined ? t1[i] : 0,
        b = t2[i] !== undefined ? t2[i] : 0;
      if (a !== b) return a - b;
    }
    return 0;
  }
  
  export function parsedCards(row) {
    return row.filter(Boolean).map(parseCard).filter(Boolean);
  }
  
  export function isFouled(board) {
    if (
      parsedCards(board.top).length < 3 ||
      parsedCards(board.middle).length < 5 ||
      parsedCards(board.bottom).length < 5
    )
      return false;
    const top = evalHand(parsedCards(board.top)),
      mid = evalHand(parsedCards(board.middle)),
      bot = evalHand(parsedCards(board.bottom));
    return compareHands(bot, mid) < 0 || compareHands(mid, top) < 0;
  }
  
  export function getTopRoyalty(board) {
    const c = parsedCards(board.top);
    if (c.length < 3) return 0;
    const h = evalHand(c);
    if (h.name === "Three of a Kind" && !isNaN(h.trips)) {
      const rChar = RANKS[h.trips - 2];
      return rChar ? TOP_ROYALTIES[rChar.repeat(3)] || 0 : 0;
    }
    if (h.name === "Pair" && !isNaN(h.pair)) {
      const rChar = RANKS[h.pair - 2];
      return rChar ? TOP_ROYALTIES[rChar.repeat(2)] || 0 : 0;
    }
    return 0;
  }
  
  export function getMidRoyalty(board) {
    const c = parsedCards(board.middle);
    if (c.length < 5) return 0;
    return MIDDLE_ROYALTIES[evalHand(c).name] || 0;
  }
  
  export function getBotRoyalty(board) {
    const c = parsedCards(board.bottom);
    if (c.length < 5) return 0;
    return BOTTOM_ROYALTIES[evalHand(c).name] || 0;
  }
  
  export function getTotalRoyalties(board) {
    if (isFouled(board)) return 0;
    return getTopRoyalty(board) + getMidRoyalty(board) + getBotRoyalty(board);
  }
  
  export function qualifiesFL(board) {
    if (isFouled(board)) return false;
    const c = parsedCards(board.top);
    if (c.length < 3) return false;
    const h = evalHand(c);
    if (h.name === "Pair" && !isNaN(h.pair)) {
      const rChar = RANKS[h.pair - 2];
      return rChar ? FL_TOP_QUALIFIERS.includes(rChar.repeat(2)) : false;
    }
    return h.name === "Three of a Kind";
  }
  
  export function compareRowHands(r1, r2) {
    const d = compareHands(evalHand(parsedCards(r1)), evalHand(parsedCards(r2)));
    return d > 0 ? 1 : d < 0 ? -1 : 0;
  }
  
  export function calcPoints(boards, forcedFouls) {
    const n = boards.length;
    const fouled = boards.map((b, i) => forcedFouls[i] || isFouled(b));
    const royalties = boards.map((b, i) =>
      fouled[i] ? 0 : getTotalRoyalties(b)
    );
    const delta = new Array(n).fill(0);
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const fi = fouled[i],
          fj = fouled[j];
        if (fi && fj) continue;
        if (fi) {
          delta[i] -= 6;
          delta[j] += 6;
          continue;
        }
        if (fj) {
          delta[i] += 6;
          delta[j] -= 6;
          continue;
        }
        const tc = compareRowHands(boards[i].top, boards[j].top),
          mc = compareRowHands(boards[i].middle, boards[j].middle),
          bc = compareRowHands(boards[i].bottom, boards[j].bottom);
        let iW = 0,
          jW = 0;
        if (tc > 0) iW++;
        else if (tc < 0) jW++;
        if (mc > 0) iW++;
        else if (mc < 0) jW++;
        if (bc > 0) iW++;
        else if (bc < 0) jW++;
        let pts = iW - jW;
        if (iW === 3) pts += 3;
        if (jW === 3) pts -= 3;
        delta[i] += pts;
        delta[j] -= pts;
      }
    for (let i = 0; i < n; i++) {
      const r = royalties[i];
      if (r > 0) {
        delta[i] += r * (n - 1);
        for (let j = 0; j < n; j++) {
          if (j !== i) delta[j] -= r;
        }
      }
    }
    return { delta, royalties, fouled };
  }
  
  export function isBoardFilled(board) {
    if (!board) return false;
    return (
      board.top && board.top.every(Boolean) &&
      board.middle && board.middle.every(Boolean) &&
      board.bottom && board.bottom.every(Boolean)
    );
  }
  