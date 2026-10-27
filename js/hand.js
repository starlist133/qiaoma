/* 胡牌判定 / 听牌 / 向听数（支持百搭） */
(function (global) {
  'use strict';
  var Tiles = global.Tiles;
  var N = 34;

  function wildTotalOf(counts, wildCode) {
    if (wildCode == null || wildCode < 0 || wildCode >= N) return 0;
    return counts[wildCode];
  }

  /** 面子分解：cnt 剩余牌 + wild 张百搭，凑 need 个面子（tripletsOnly=只允许刻子） */
  function decompose(cnt, wild, need, tripletsOnly) {
    if (need === 0) {
      for (var z = 0; z < N; z++) if (cnt[z] > 0) return false;
      return true;
    }
    var i = 0;
    while (i < N && cnt[i] === 0) i++;
    if (i >= N) return false;

    // 刻子
    var use3 = Math.min(3, cnt[i]);
    var nw = 3 - use3;
    if (nw <= wild) {
      cnt[i] -= use3;
      if (decompose(cnt, wild - nw, need - 1, tripletsOnly)) { cnt[i] += use3; return true; }
      cnt[i] += use3;
    }
    // 顺子
    if (!tripletsOnly && Tiles.isSuited(i)) {
      var st = Tiles.suitStart(i), r = i - st;
      if (r <= 6) {
        var idx = [i, i + 1, i + 2], used = [0, 0, 0], nd = 0, k;
        for (k = 0; k < 3; k++) { if (cnt[idx[k]] > 0) { used[k] = 1; } else { nd++; } }
        if (nd <= wild) {
          for (k = 0; k < 3; k++) cnt[idx[k]] -= used[k];
          if (decompose(cnt, wild - nd, need - 1, tripletsOnly)) {
            for (k = 0; k < 3; k++) cnt[idx[k]] += used[k];
            return true;
          }
          for (k = 0; k < 3; k++) cnt[idx[k]] += used[k];
        }
      }
    }
    return false;
  }

  /**
   * 是否胡牌
   * @param counts 长度34的手牌计数（不含花、不含副露）
   * @param wildCode 百搭牌 code（可为 null）
   * @param fixedMelds 已成型副露组数（吃/碰/杠）
   */
  function canWin(counts, wildCode, fixedMelds, tripletsOnly) {
    var need = 4 - fixedMelds;
    if (need <= 0) return false;
    var total = 0, i;
    for (i = 0; i < N; i++) total += counts[i];
    if (total !== need * 3 + 2) return false;

    var wt = wildTotalOf(counts, wildCode);
    for (var w = 0; w <= wt; w++) {
      var c = counts.slice();
      if (wildCode != null && wildCode >= 0 && wildCode < N) c[wildCode] = wt - w;
      for (var t = 0; t < N; t++) {
        var have = c[t];
        if (have === 0 && w === 0) continue;
        var maxUse = Math.min(2, have);
        for (var use = maxUse; use >= 0; use--) {
          var needW = 2 - use;
          if (needW > w) continue;
          c[t] = have - use;
          if (decompose(c, w - needW, need, !!tripletsOnly)) { return true; }
          c[t] = have;
        }
      }
    }
    return false;
  }

  /** 听牌张（返回 code 数组） */
  function winningTiles(counts, wildCode, fixedMelds) {
    var res = [];
    var need = 4 - fixedMelds;
    if (need <= 0) return res;
    var total = 0, i;
    for (i = 0; i < N; i++) total += counts[i];
    if (total !== need * 3 + 1) return res; // 13/10/7/4/1 张时才是听牌形态
    for (var t = 0; t < N; t++) {
      var c = counts.slice();
      c[t]++;
      if (canWin(c, wildCode, fixedMelds)) res.push(t);
    }
    return res;
  }

  function isTenpai(counts, wildCode, fixedMelds) {
    return winningTiles(counts, wildCode, fixedMelds).length > 0;
  }

  /* ---------------- 向听数 ---------------- */
  function shanten(counts, wildCode, fixedMelds) {
    var best = 99;
    var wt = wildTotalOf(counts, wildCode);
    var base = counts.slice();

    function evaluate(melds, partials, pair) {
      var mt = melds + fixedMelds;
      var blocks = partials + pair;
      var sh = 8 - 2 * mt - blocks;
      if (mt + blocks === 5 && pair === 0) sh += 1; // 无将
      if (sh < best) best = sh;
    }

    for (var w = 0; w <= wt; w++) {
      var cnt = base.slice();
      if (wildCode != null && wildCode >= 0 && wildCode < N) cnt[wildCode] = wt - w;
      search(cnt, w, 0, 0, 0, 0, fixedMelds, evaluate);
    }
    return best === 99 ? 8 : Math.max(-1, best);
  }

  function search(cnt, wild, i, melds, partials, pair, fixed, cb) {
    while (i < N && cnt[i] === 0) i++;
    var mt = melds + fixed;
    if (i >= N || mt + partials + pair >= 5) {
      cb(melds, partials, pair);
      if (i >= N) return;
    }
    var k, idx, used, nd;

    // 1) 刻子
    var use3 = Math.min(3, cnt[i]);
    var nw = 3 - use3;
    if (nw <= wild) {
      cnt[i] -= use3;
      search(cnt, wild - nw, i, melds + 1, partials, pair, fixed, cb);
      cnt[i] += use3;
    }
    // 2) 顺子
    if (Tiles.isSuited(i)) {
      var st = Tiles.suitStart(i), r = i - st;
      if (r <= 6) {
        idx = [i, i + 1, i + 2]; used = [0, 0, 0]; nd = 0;
        for (k = 0; k < 3; k++) { if (cnt[idx[k]] > 0) used[k] = 1; else nd++; }
        if (nd <= wild) {
          for (k = 0; k < 3; k++) cnt[idx[k]] -= used[k];
          search(cnt, wild - nd, i, melds + 1, partials, pair, fixed, cb);
          for (k = 0; k < 3; k++) cnt[idx[k]] += used[k];
        }
      }
    }
    // 3) 对子（将/搭子候选）
    if (pair === 0) {
      var use2 = Math.min(2, cnt[i]);
      var nw2 = 2 - use2;
      if (nw2 <= wild) {
        cnt[i] -= use2;
        search(cnt, wild - nw2, i, melds, partials, pair + 1, fixed, cb);
        cnt[i] += use2;
      }
    }
    // 4) 两面 / 边张 / 嵌张 搭子
    var canMore = (melds + fixed) + partials + pair < 5;
    if (canMore) {
      if (Tiles.isSuited(i)) {
        var st2 = Tiles.suitStart(i), r2 = i - st2;
        var pairsIdx = [];
        if (r2 <= 7) pairsIdx.push([i, i + 1]);
        if (r2 <= 6) pairsIdx.push([i, i + 2]);
        for (var pi = 0; pi < pairsIdx.length; pi++) {
          idx = pairsIdx[pi]; used = [0, 0]; nd = 0;
          for (k = 0; k < 2; k++) { if (cnt[idx[k]] > 0) used[k] = 1; else nd++; }
          if (nd <= wild) {
            for (k = 0; k < 2; k++) cnt[idx[k]] -= used[k];
            search(cnt, wild - nd, i, melds, partials + 1, pair, fixed, cb);
            for (k = 0; k < 2; k++) cnt[idx[k]] += used[k];
          }
        }
      }
    }
    // 5) 弃掉一张孤张
    if (cnt[i] > 0) {
      cnt[i]--;
      search(cnt, wild, i, melds, partials, pair, fixed, cb);
      cnt[i]++;
    }
  }

  global.Hand = {
    canWin: canWin,
    winningTiles: winningTiles,
    isTenpai: isTenpai,
    shanten: shanten
  };
})(typeof window !== 'undefined' ? window : globalThis);
