/* 上海敲麻 · 牌定义
 * code 编码：
 *   0-8   一万~九万
 *   9-17  一条~九条
 *   18-26 一筒~九筒
 *   27-30 东 南 西 北
 *   31-33 中 发 白   （敲麻中算作花牌；关掉开关时作为字牌）
 *   34-41 春 夏 秋 冬 梅 兰 竹 菊 （花牌，各1张）
 */
(function (global) {
  'use strict';

  var CODE_MAX = 42;
  var SUIT_M = 0, SUIT_S = 9, SUIT_P = 18;
  var WIND_START = 27, DRAGON_START = 31, SEASON_START = 34;
  var FLOWER_START = 31; // >=31 恒定花（季节花）
  var NUM_KINDS = 34;     // 0..33 可进入手牌的牌种（中发白视设置而定）

  var SEASON_NAMES = ['春', '夏', '秋', '冬', '梅', '蘭', '竹', '菊'];
  var DRAGON_NAMES = ['中', '發', '白'];
  var WIND_NAMES = ['東', '南', '西', '北'];

  function isSuited(c) { return c <= 26; }
  function suitStart(c) { return c < 9 ? 0 : (c < 18 ? 9 : 18); }
  function rankOf(c) { return c - suitStart(c) + 1; } // 1..9
  function isWind(c) { return c >= 27 && c <= 30; }
  function isDragon(c) { return c >= 31 && c <= 33; }
  function isSeason(c) { return c >= 34 && c <= 41; }
  function isFlower(c) { return c >= FLOWER_START; }
  function isHonor(c) { return c >= 27 && c <= 33; }

  /** 该 code 是否为"花牌"（中发白是否算花由设置决定） */
  function isFlowerTile(c, dragonsAsFlowers) {
    if (isSeason(c)) return true;
    if (isDragon(c)) return !!dragonsAsFlowers;
    return false;
  }

  function tileName(c) {
    if (c <= 8) return (c + 1) + '萬';
    if (c <= 17) return (c - 9 + 1) + '條';
    if (c <= 26) return (c - 18 + 1) + '筒';
    if (isWind(c)) return WIND_NAMES[c - 27];
    if (isDragon(c)) return DRAGON_NAMES[c - 31];
    if (isSeason(c)) return SEASON_NAMES[c - 34];
    return '?';
  }

  /** 用于显示的拆分：{top, bottom, kind} */
  function tileFace(c) {
    if (c <= 8) return { top: String(c + 1), bottom: '萬', kind: 'm' };
    if (c <= 17) return { top: String(c - 8), bottom: '條', kind: 's' };
    if (c <= 26) return { top: String(c - 17), bottom: '筒', kind: 'p' };
    if (isWind(c)) return { top: WIND_NAMES[c - 27], bottom: '', kind: 'w' };
    if (isDragon(c)) return { top: DRAGON_NAMES[c - 31], bottom: '', kind: 'd' };
    if (isSeason(c)) return { top: SEASON_NAMES[c - 34], bottom: '', kind: 'f' };
    return { top: '?', bottom: '', kind: 'f' };
  }

  /** 百搭推导：引导牌的"下一张" */
  function nextCode(c) {
    if (c <= 8) return c === 8 ? 0 : c + 1;
    if (c <= 17) return c === 17 ? 9 : c + 1;
    if (c <= 26) return c === 26 ? 18 : c + 1;
    if (isWind(c)) return c === 30 ? 27 : c + 1;
    return 27; // 花牌（含中发白）→ 东风
  }

  /** 构建牌墙：返回 code 数组（144 或 136 张，取决于中发白是否算花） */
  function buildWall(dragonsAsFlowers) {
    var arr = [];
    var i, k;
    for (i = 0; i <= 33; i++) {
      if (isDragon(i) && dragonsAsFlowers) continue; // 中发白变为花牌，下面单独加
      for (k = 0; k < 4; k++) arr.push(i);
    }
    // 花牌：中发白各4张 + 季节花各1张
    if (dragonsAsFlowers) {
      for (i = 31; i <= 33; i++) { for (k = 0; k < 4; k++) arr.push(i); }
    }
    for (i = 34; i <= 41; i++) arr.push(i);
    return arr;
  }

  function shuffle(arr, rnd) {
    rnd = rnd || Math.random;
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /** 空计数数组（34 种可进手牌的牌） */
  function emptyCounts() {
    var a = new Array(NUM_KINDS);
    for (var i = 0; i < NUM_KINDS; i++) a[i] = 0;
    return a;
  }

  function countsFrom(list) {
    var a = emptyCounts();
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (t >= 0 && t < NUM_KINDS) a[t]++;
    }
    return a;
  }

  global.Tiles = {
    CODE_MAX: CODE_MAX, NUM_KINDS: NUM_KINDS,
    SUIT_M: SUIT_M, SUIT_S: SUIT_S, SUIT_P: SUIT_P,
    WIND_START: WIND_START, DRAGON_START: DRAGON_START, SEASON_START: SEASON_START,
    isSuited: isSuited, suitStart: suitStart, rankOf: rankOf,
    isWind: isWind, isDragon: isDragon, isSeason: isSeason, isFlower: isFlower,
    isHonor: isHonor, isFlowerTile: isFlowerTile,
    tileName: tileName, tileFace: tileFace, nextCode: nextCode,
    buildWall: buildWall, shuffle: shuffle,
    emptyCounts: emptyCounts, countsFrom: countsFrom,
    SEASON_NAMES: SEASON_NAMES, DRAGON_NAMES: DRAGON_NAMES, WIND_NAMES: WIND_NAMES
  };
})(typeof window !== 'undefined' ? window : globalThis);
