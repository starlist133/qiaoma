/* 电脑玩家决策 */
(function (global) {
  'use strict';
  var Tiles = global.Tiles, Hand = global.Hand;

  function removeOne(arr, t) {
    var i = arr.indexOf(t);
    if (i >= 0) arr.splice(i, 1);
  }
  function handCounts(p) { return Tiles.countsFrom(p.hand); }

  /** 打出某张后的形态评分（越小越好） */
  function evalAfterDiscard(hand, meldCount, wild) {
    return Hand.shanten(handCounts({ hand: hand }), wild, meldCount);
  }

  /** 危险度：越大越危险 */
  function dangerOf(t, st, me) {
    var seen = 0, danger = 0, i, j;
    for (i = 0; i < 4; i++) {
      if (i === me.seat) continue;
      var q = st.players[i];
      // 现物：对手打过的牌绝对安全
      for (j = 0; j < q.discards.length; j++) if (q.discards[j] === t) { seen++; }
      if (q.knocked && seen > 0) danger -= 6;
    }
    // 中张比幺九/风牌危险
    if (Tiles.isSuited(t)) {
      var r = Tiles.rankOf(t);
      if (r >= 3 && r <= 7) danger += 2; else danger -= 1;
    } else {
      danger -= 1;
    }
    danger -= seen * 1.2;
    return danger;
  }

  /** 选择要打出的牌 */
  function chooseDiscard(p, st) {
    var wild = st.wildCode;
    if (p.knocked && p.drawn != null) return p.drawn;
    var uniq = [];
    p.hand.forEach(function (t) { if (uniq.indexOf(t) < 0) uniq.push(t); });
    var best = null, bestScore = -Infinity;
    uniq.forEach(function (t) {
      var h = p.hand.slice();
      removeOne(h, t);
      var sh = Hand.shanten(Tiles.countsFrom(h), wild, p.melds.length);
      var uke = 0;
      if (sh <= 1) {
        // 进张估算：加入一张后向听是否改善
        for (var t2 = 0; t2 < 34; t2++) {
          var h2 = h.slice(); h2.push(t2);
          var sh2 = Hand.shanten(Tiles.countsFrom(h2), wild, p.melds.length);
          if (sh2 < sh) uke++;
        }
      }
      var isWild = (t === wild);
      var score = -sh * 100 + uke * 3 - dangerOf(t, st, p) * 2 - (isWild ? 12 : 0);
      if (score > bestScore) { bestScore = score; best = t; }
    });
    return best == null ? p.hand[p.hand.length - 1] : best;
  }

  /** 是否该敲（报听）：打出刚摸的牌后即可听牌 */
  function shouldKnock(p, st) {
    if (p.knocked || p.drawn == null) return false;
    var h = p.hand.slice();
    var i = h.indexOf(p.drawn);
    if (i >= 0) h.splice(i, 1);
    return Hand.isTenpai(Tiles.countsFrom(h), st.wildCode, p.melds.length);
  }

  /** 决策：别人打出 tile 时 */
  function decideClaim(p, st, tile, fromSeat, opts) {
    var wild = st.wildCode;
    var needKnock = global.Game.settings.mustKnock;

    if (opts.hu && (!needKnock || p.knocked)) return { type: 'hu' };

    // 杠：明杠
    if (opts.gang) {
      var h = p.hand.slice();
      removeOne(h, tile); removeOne(h, tile); removeOne(h, tile);
      var shG = Hand.shanten(Tiles.countsFrom(h), wild, p.melds.length + 1);
      var shNow = Hand.shanten(handCounts(p), wild, p.melds.length);
      if (shG <= shNow) return { type: 'gang' };
    }
    // 碰
    if (opts.peng) {
      var h2 = p.hand.slice();
      removeOne(h2, tile); removeOne(h2, tile);
      var shP = Hand.shanten(Tiles.countsFrom(h2), wild, p.melds.length + 1);
      var shN = Hand.shanten(handCounts(p), wild, p.melds.length);
      if (shP < shN || (shP === 0)) return { type: 'peng' };
      // 有混一色/碰碰胡倾向时也碰
      if (shP <= shN && p.melds.length >= 1) return { type: 'peng' };
    }
    // 吃
    if (opts.chi && opts.chi.length) {
      var bestChi = null, bestSh = 99;
      opts.chi.forEach(function (pair) {
        var h3 = p.hand.slice();
        removeOne(h3, pair[0]); removeOne(h3, pair[1]);
        var sh = Hand.shanten(Tiles.countsFrom(h3), wild, p.melds.length + 1);
        if (sh < bestSh) { bestSh = sh; bestChi = pair; }
      });
      var shNow2 = Hand.shanten(handCounts(p), wild, p.melds.length);
      if (bestChi && bestSh < shNow2) return { type: 'chi', tiles: bestChi };
    }
    return null;
  }

  /** 暗杠决策：手牌中的四张 */
  function decideAnGang(p, st) {
    var wild = st.wildCode;
    var counts = handCounts(p);
    var cands = [];
    for (var c = 0; c < 34; c++) {
      if (counts[c] === 4 && c !== wild) cands.push(c);
    }
    if (!cands.length) return null;
    var shNow = Hand.shanten(counts, wild, p.melds.length);
    for (var i = 0; i < cands.length; i++) {
      var h = p.hand.slice();
      removeOne(h, cands[i]); removeOne(h, cands[i]); removeOne(h, cands[i]); removeOne(h, cands[i]);
      var sh = Hand.shanten(Tiles.countsFrom(h), wild, p.melds.length + 1);
      if (sh <= shNow) return cands[i];
    }
    return null;
  }

  global.AI = {
    chooseDiscard: chooseDiscard,
    decideClaim: decideClaim,
    decideAnGang: decideAnGang,
    shouldKnock: shouldKnock
  };
})(typeof window !== 'undefined' ? window : globalThis);
