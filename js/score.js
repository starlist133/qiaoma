/* 计分：花数 × 2^番数 × 倍数 */
(function (global) {
  'use strict';
  var Tiles = global.Tiles, Hand = global.Hand;

  /** 牌型分析 */
  function analyzeTypes(hand, melds, wildCode) {
    var all = hand.slice();
    melds.forEach(function (ml) {
      if (ml.tiles) all = all.concat(ml.tiles);
      else if (ml.code != null) all.push(ml.code);
    });
    var suits = {}, hasHonor = false, hasDragon = false;
    all.forEach(function (c) {
      if (c === wildCode) return;               // 百搭按字面花色忽略
      if (Tiles.isSuited(c)) suits[Tiles.suitStart(c)] = 1;
      else if (Tiles.isWind(c)) { hasHonor = true; }
      else if (Tiles.isDragon(c)) { hasHonor = true; hasDragon = true; }
    });
    var suitKeys = Object.keys(suits);
    var onlyOneSuit = suitKeys.length <= 1;
    var qing = onlyOneSuit && !hasHonor && (suitKeys.length === 1 || wildOnly(all, wildCode));
    var hun = onlyOneSuit && hasHonor && suitKeys.length === 1;

    var counts = Tiles.countsFrom(hand);
    var pph = Hand.canWin(counts, wildCode, melds.length, true) && melds.every(function (ml) { return ml.type !== 'chi'; });

    return {
      qingyise: qing,
      hunyise: hun && !qing,
      pengpenghu: pph,
      daDiao: melds.length === 4 && hand.length === 1
    };
  }

  function wildOnly(all, wildCode) {
    return all.every(function (c) { return c === wildCode; });
  }

  /**
   * 计算得分
   * ctx: {hand, melds, flowers, wildCode, selfDraw, isKaiBao, huangFan, gangKai, qiangGang}
   */
  function compute(ctx) {
    var hand = ctx.hand || [], melds = ctx.melds || [], flowers = ctx.flowers || [];
    var wildCode = (ctx.wildCode == null ? null : ctx.wildCode);
    var dragonsAsFlowers = ctx.dragonsAsFlowers !== false;

    /* ---- 花数 ---- */
    var flowerItems = [];
    var extra = 0;
    flowers.forEach(function (c) {
      var v = 1;
      extra += v;
      flowerItems.push({ name: '花牌 ' + Tiles.tileName(c), value: v });
    });
    melds.forEach(function (ml) {
      var code = ml.code;
      var isWindOrDragon = Tiles.isWind(code) || (Tiles.isDragon(code) && !dragonsAsFlowers);
      var v = 0, nm = Tiles.tileName(code);
      if (ml.type === 'peng') {
        v = isWindOrDragon ? 1 : 0;
      } else if (ml.type === 'gang') {
        v = isWindOrDragon ? 2 : 1;
      } else if (ml.type === 'angang') {
        v = isWindOrDragon ? 3 : 2;
      }
      if (v > 0) {
        extra += v;
        flowerItems.push({
          name: (ml.type === 'peng' ? (isWindOrDragon ? '风刻 ' : '刻子 ') : (ml.type === 'gang' ? '明杠 ' : '暗杠 ')) + nm,
          value: v
        });
      }
    });
    // 手牌中的暗刻（风牌 1 花）
    var hc = Tiles.countsFrom(hand);
    for (var c = 27; c <= 30; c++) {
      if (hc[c] >= 3) { extra += 1; flowerItems.push({ name: '风暗刻 ' + Tiles.tileName(c), value: 1 }); }
    }
    // 百搭：1 花/个（吃进碰进的不计）
    if (wildCode != null && hc[wildCode] > 0) {
      var wv = hc[wildCode];
      extra += wv;
      flowerItems.push({ name: '百搭 ×' + wv, value: wv });
    }

    var flowerTotal;
    var wuHuaguo = false;
    if (extra === 0) {
      wuHuaguo = true;
      flowerTotal = 10;
      flowerItems = [{ name: '无花果', value: 10 }];
    } else {
      flowerTotal = extra + 1; // 底花 1
      flowerItems.unshift({ name: '底花', value: 1 });
    }

    /* ---- 番数 ---- */
    var types = analyzeTypes(hand, melds, wildCode);
    var fans = [];
    var menqing = melds.every(function (ml) { return ml.type === 'angang' || ml.type === 'peng' ? false : (ml.type === 'angang'); }) || melds.length === 0;
    menqing = !melds.some(function (ml) { return ml.type === 'chi' || ml.type === 'peng' || ml.type === 'gang'; });
    if (menqing) fans.push({ name: '门清', fan: 1 });
    if (types.daDiao) fans.push({ name: '大吊车', fan: 1 });
    if (ctx.gangKai) fans.push({ name: '杠开', fan: 1 });

    if (types.qingyise && types.pengpenghu) fans.push({ name: '清碰', fan: 3 });
    else if (types.hunyise && types.pengpenghu) fans.push({ name: '混碰', fan: 2 });
    else {
      if (types.qingyise) fans.push({ name: '清一色', fan: 2 });
      if (types.hunyise) fans.push({ name: '混一色', fan: 1 });
      if (types.pengpenghu) fans.push({ name: '碰碰胡', fan: 1 });
    }

    var fanTotal = fans.reduce(function (a, f) { return a + f.fan; }, 0);

    /* ---- 倍数 ---- */
    var mults = [];
    if (ctx.qiangGang) mults.push({ name: '抢杠', mult: 3 });
    if (ctx.isKaiBao) mults.push({ name: '开宝', mult: 2 });
    if (ctx.huangFan > 0) mults.push({ name: '荒番 ×' + ctx.huangFan, mult: Math.pow(2, ctx.huangFan) });
    var multTotal = mults.reduce(function (a, x) { return a * x.mult; }, 1);

    var total = flowerTotal * Math.pow(2, fanTotal) * multTotal;

    return {
      flowers: flowerItems, flowerTotal: flowerTotal, wuHuaguo: wuHuaguo,
      fans: fans, fanTotal: fanTotal,
      mults: mults, multTotal: multTotal,
      types: types, menqing: menqing,
      total: total
    };
  }

  global.Score = { compute: compute, analyzeTypes: analyzeTypes };
})(typeof window !== 'undefined' ? window : globalThis);
