/* 对局状态机：上海敲麻（百搭版） */
(function (global) {
  'use strict';
  var Tiles = global.Tiles, Hand = global.Hand, Score = global.Score, AI = global.AI;
  var NAMES = ['你', '东家', '阿姐', '西家'];

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var Game = {
    settings: {
      dragonsAsFlowers: true,  // 中发白算花牌
      useWild: true,          // 百搭
      allowChi: false,         // 是否允许吃
      mustKnock: true,        // 必须先敲（报听）才能胡
      huangFan: true,         // 荒番
      speed: 1
    },
    state: null,
    ui: null,
    busy: false
  };

  function d(ms) { return sleep(Math.max(0, ms * (Game.settings.speed || 1))); }

  function newGame() {
    Game.state = {
      players: [0, 1, 2, 3].map(function (i) {
        return {
          seat: i, name: NAMES[i], isBot: i !== 0,
          hand: [], melds: [], flowers: [], discards: [],
          knocked: false, score: 0, drawn: null
        };
      }),
      dealer: Math.floor(Math.random() * 4),
      round: 1, huangFan: 0, over: false,
      wall: [], wildCode: null, guideCode: null,
      kaiBao: false, result: null, turn: 0,
      lastDiscard: null, pendingGangKai: false
    };
    startRound();
  }

  var CUR_RID = 0; // 当前局号，用于终止上一局残留的异步流程

  function startRound() {
    var st = Game.state;
    var S = Game.settings;
    CUR_RID++;
    st.wall = Tiles.shuffle(Tiles.buildWall(S.dragonsAsFlowers));
    st.over = false;
    st.result = null;
    st.lastDiscard = null;
    st.pendingGangKai = false;
    st.turn = st.dealer;

    // 掷骰开宝
    var d1 = 1 + Math.floor(Math.random() * 6), d2 = 1 + Math.floor(Math.random() * 6);
    st.dice = [d1, d2];
    st.kaiBao = (d1 === d2) || (d1 === 1 && d2 === 4) || (d1 === 4 && d2 === 1);

    // 定百搭：引导牌的下一张
    if (S.useWild) {
      var gi = Math.floor(Math.random() * st.wall.length);
      st.guideCode = st.wall[gi];
      st.wildCode = Tiles.nextCode(st.guideCode);
    } else { st.guideCode = null; st.wildCode = null; }

    st.players.forEach(function (p) {
      p.hand = []; p.melds = []; p.flowers = []; p.discards = [];
      p.knocked = false; p.drawn = null;
    });
    // 发牌
    for (var k = 0; k < 13; k++) {
      for (var i = 0; i < 4; i++) st.players[(st.dealer + i) % 4].hand.push(st.wall.shift());
    }
    st.players[st.dealer].hand.push(st.wall.shift());
    // 补花
    for (var j = 0; j < 4; j++) replaceFlowers(st.players[(st.dealer + j) % 4]);
    st.players.forEach(function (p) { sortHand(p); });

    if (Game.ui) Game.ui.render();
    runRound(CUR_RID);
  }

  function sortHand(p) {
    p.hand.sort(function (a, b) { return a - b; });
  }

  function isFlowerT(c) { return Tiles.isFlowerTile(c, Game.settings.dragonsAsFlowers); }

  /** 把手牌里的花牌换成牌尾的牌 */
  function replaceFlowers(p) {
    var st = Game.state, guard = 0;
    while (guard++ < 30) {
      var idx = -1;
      for (var i = 0; i < p.hand.length; i++) if (isFlowerT(p.hand[i])) { idx = i; break; }
      if (idx < 0) break;
      p.flowers.push(p.hand.splice(idx, 1)[0]);
      if (!st.wall.length) return false;
      p.hand.push(st.wall.pop());
    }
    sortHand(p);
    return true;
  }

  /**
   * 取一张非花牌（花牌自动收入花区并继续补）
   * fromTail=true 时从牌尾取（补花/杠后补牌）
   */
  function drawClean(p, fromTail) {
    var st = Game.state, gangKai = false, guard = 0;
    while (guard++ < 40) {
      if (!st.wall.length) return { tile: null, gangKai: gangKai, huang: true };
      var t = fromTail ? st.wall.pop() : st.wall.shift();
      if (isFlowerT(t)) { p.flowers.push(t); gangKai = true; continue; }
      return { tile: t, gangKai: gangKai, huang: false };
    }
    return { tile: null, gangKai: gangKai, huang: true };
  }

  /** 摸牌（含补花），返回 {tile, gangKai, huang} */
  function drawFor(p) {
    var r = drawClean(p, false);
    if (r.tile == null) return { tile: null, gangKai: r.gangKai, huang: true };
    p.drawn = r.tile;
    p.hand.push(r.tile);
    sortHand(p);
    return { tile: r.tile, gangKai: r.gangKai, huang: false };
  }

  function handCountsOf(p) { return Tiles.countsFrom(p.hand); }

  function canWinNow(p, extraTile) {
    var h = p.hand.slice();
    if (extraTile != null) h.push(extraTile);
    return Hand.canWin(Tiles.countsFrom(h), Game.state.wildCode, p.melds.length);
  }
  function isTenpai(p) {
    return Hand.isTenpai(handCountsOf(p), Game.state.wildCode, p.melds.length);
  }

  /** 打出刚摸的牌后是否听牌（敲的条件） */
  function knockReady(p) {
    if (p.drawn == null) return false;
    var h = p.hand.slice();
    var i = h.indexOf(p.drawn);
    if (i >= 0) h.splice(i, 1);
    return Hand.isTenpai(Tiles.countsFrom(h), Game.state.wildCode, p.melds.length);
  }

  function discardTile(p, index) {
    var st = Game.state;
    var t = p.hand.splice(index, 1)[0];
    p.discards.push(t);
    p.drawn = null;
    st.lastDiscard = { seat: p.seat, code: t };
    if (Game.ui) {
      Game.ui.render();
      if (Game.ui.setTip) {
        Game.ui.setTip(p.name + ' 打出 <b>' + Tiles.tileName(t) + '</b>，等待其他玩家…');
      }
    }
    return t;
  }

  function discardCode(p, code) {
    var i = p.hand.indexOf(code);
    return discardTile(p, i < 0 ? p.hand.length - 1 : i);
  }

  /* -------------------- 主循环 -------------------- */
  async function runRound(rid) {
    var st = Game.state, guard = 0;
    await d(400);
    while (!st.over && rid === CUR_RID && guard++ < 500) {
      // 庄家起手 14 张，首轮直接打牌
      var p0 = st.players[st.turn];
      var mode = (p0.hand.length + 3 * p0.melds.length >= 14) ? 'discard' : 'draw';
      await doTurn(st.turn, mode);
      if (st.over || rid !== CUR_RID) break;
    }
  }

  async function doTurn(seat, mode) {
    var st = Game.state, p = st.players[seat], S = Game.settings;
    var rid = CUR_RID;
    var gangKai = false;
    // 防御：手牌已满时不再摸牌
    if (mode === 'draw' && p.hand.length + 3 * p.melds.length >= 14) mode = 'discard';

    if (mode === 'draw') {
      var r = drawFor(p);
      if (r.huang || r.tile == null) { await doDrawGame(); return; }
      gangKai = r.gangKai || st.pendingGangKai;
      st.pendingGangKai = gangKai;
    } else {
      gangKai = st.pendingGangKai;
    }
    if (rid !== CUR_RID) return;
    if (Game.ui) Game.ui.render();

    // 上杠机会：碰过的牌又摸到第 4 张
    var shangGang = null;
    for (var mi = 0; mi < p.melds.length; mi++) {
      if (p.melds[mi].type === 'peng' && p.hand.indexOf(p.melds[mi].code) >= 0) { shangGang = p.melds[mi].code; break; }
    }
    // 暗杠机会
    var anGang = null;
    if (mode === 'draw') anGang = AI.decideAnGang(p, st);

    var winNow = canWinNow(p);
    var knockedOk = !S.mustKnock || p.knocked;

    // AI：自动敲
    if (p.isBot && S.mustKnock && !p.knocked && AI.shouldKnock(p, st)) {
      p.knocked = true;
      if (Game.ui) { Game.ui.toast(p.name + ' 敲！'); Game.ui.render(); }
      await d(500);
    }

    if (winNow && knockedOk) {
      if (p.isBot) { await doHu(p, null, gangKai, false, null); return; }
      var act = await Game.ui.waitTurnAction({
        hu: true, gang: shangGang, anGang: anGang, tile: p.drawn
      });
      if (rid !== CUR_RID) return;
      if (act === 'hu') { await doHu(p, null, gangKai, false, null); return; }
      if (act === 'gang') { await doShangGang(p, shangGang); return; }
      if (act === 'angang') { await doAnGang(p, anGang); return; }
    } else if (shangGang && p.isBot) {
      await doShangGang(p, shangGang); return;
    } else if (anGang && p.isBot && !p.knocked) {
      await doAnGang(p, anGang); return;
    } else if (winNow && !knockedOk && !p.isBot) {
      Game.ui.toast('听牌但未敲（报听），不能胡 —— 本张打出');
    }

    // 打牌
    var tile;
    if (p.knocked && p.drawn != null) {
      tile = p.drawn;
      await d(420);
    } else if (p.isBot) {
      tile = AI.chooseDiscard(p, st);
      await d(520);
    } else {
      var res = await Game.ui.waitDiscard({
        canKnock: S.mustKnock && !p.knocked && knockReady(p),
        gang: shangGang, anGang: anGang
      });
      if (rid !== CUR_RID) return;
      if (res.type === 'knock') {
        p.knocked = true;
        Game.ui.toast('敲！之后不能换牌，摸什么打什么');
        Game.ui.render();
        tile = p.drawn != null ? p.drawn : p.hand[p.hand.length - 1];
        await d(450);
      } else if (res.type === 'gang') {
        await doShangGang(p, shangGang); return;
      } else if (res.type === 'angang') {
        await doAnGang(p, anGang); return;
      } else {
        tile = res.tile;
      }
    }
    var code = tile;
    var idx = p.hand.indexOf(code);
    var out = discardTile(p, idx < 0 ? p.hand.length - 1 : idx);
    await claimPhase(p, out);
  }

  /* -------------------- 响应别人打的牌 -------------------- */
  function claimOptions(q, tile, fromSeat) {
    var st = Game.state, S = Game.settings;
    var opts = {}, counts = Tiles.countsFrom(q.hand);
    var h = q.hand.slice(); h.push(tile);
    if (Hand.canWin(Tiles.countsFrom(h), st.wildCode, q.melds.length)) {
      if (!S.mustKnock || q.knocked) opts.hu = true;
    }
    if (counts[tile] >= 2 && !q.knocked) opts.peng = true;
    if (counts[tile] >= 3 && !q.knocked) opts.gang = true;
    if (S.allowChi && !q.knocked && Tiles.isSuited(tile) && (fromSeat + 1) % 4 === q.seat) {
      var r = Tiles.rankOf(tile), st0 = Tiles.suitStart(tile);
      var combos = [];
      if (r >= 3) combos.push([tile - 2, tile - 1]);
      if (r >= 2 && r <= 8) combos.push([tile - 1, tile + 1]);
      if (r <= 7) combos.push([tile + 1, tile + 2]);
      var valid = [];
      combos.forEach(function (cb) {
        var c = Tiles.countsFrom(q.hand);
        if (c[cb[0]] > 0 && c[cb[1]] > 0) valid.push(cb);
      });
      if (valid.length) opts.chi = valid;
    }
    if (!opts.hu && !opts.peng && !opts.gang && !opts.chi) return null;
    return opts;
  }

  async function claimPhase(discarder, tile) {
    var st = Game.state, claims = [];
    var rid = CUR_RID;
    for (var i = 1; i <= 3; i++) {
      var q = st.players[(discarder.seat + i) % 4];
      var opts = claimOptions(q, tile, discarder.seat);
      if (!opts) continue;
      if (q.isBot) {
        var dec = AI.decideClaim(q, st, tile, discarder.seat, opts);
        if (dec) claims.push({ player: q, dec: dec, order: i });
      } else {
        if (opts.hu && q.knocked) {
          claims.push({ player: q, dec: { type: 'hu' }, order: i }); // 有胡必胡
          continue;
        }
        var resp = await Game.ui.waitClaim(opts, tile, discarder);
        if (rid !== CUR_RID) return;
        if (resp) claims.push({ player: q, dec: resp, order: i });
      }
    }
    if (rid !== CUR_RID) return;
    if (claims.length) {
      var order = { 'hu': 0, 'gang': 1, 'peng': 2, 'chi': 3 };
      claims.sort(function (a, b) {
        return (order[a.dec.type] - order[b.dec.type]) || (a.order - b.order);
      });
      await applyClaim(claims[0], discarder, tile);
      return;
    }
    st.turn = (discarder.seat + 1) % 4;
    if (Game.ui) Game.ui.render();
  }

  async function applyClaim(c, discarder, tile) {
    var st = Game.state, q = c.player, dec = c.dec;
    if (dec.type === 'hu') {
      // 胡的牌从弃牌堆取走，避免重复显示
      var hi = discarder.discards.lastIndexOf(tile);
      if (hi >= 0) discarder.discards.splice(hi, 1);
      await doHu(q, discarder.seat, false, false, tile);
      return;
    }
    // 从弃牌堆取走该牌
    var di = discarder.discards.lastIndexOf(tile);
    if (di >= 0) discarder.discards.splice(di, 1);

    if (dec.type === 'peng') {
      removeN(q.hand, tile, 2);
      q.melds.push({ type: 'peng', code: tile, tiles: [tile, tile, tile] });
      sortHand(q);
      if (Game.ui) { Game.ui.toast(q.name + ' 碰 ' + Tiles.tileName(tile)); Game.ui.render(); }
      await d(450);
      st.turn = q.seat;
      await doTurn(q.seat, 'discard');
      return;
    }
    if (dec.type === 'gang') {
      removeN(q.hand, tile, 3);
      q.melds.push({ type: 'gang', code: tile, tiles: [tile, tile, tile, tile] });
      sortHand(q);
      if (Game.ui) { Game.ui.toast(q.name + ' 杠 ' + Tiles.tileName(tile)); Game.ui.render(); }
      await d(400);
      var rg = drawClean(q, true);
      if (rg.tile == null) { await doDrawGame(); return; }
      q.drawn = rg.tile; q.hand.push(rg.tile); sortHand(q);
      st.pendingGangKai = true;
      st.turn = q.seat;
      await doTurn(q.seat, 'discard');
      return;
    }
    if (dec.type === 'chi') {
      removeN(q.hand, dec.tiles[0], 1);
      removeN(q.hand, dec.tiles[1], 1);
      var tl = dec.tiles.concat([tile]).sort(function (a, b) { return a - b; });
      q.melds.push({ type: 'chi', code: tile, tiles: tl });
      sortHand(q);
      if (Game.ui) { Game.ui.toast(q.name + ' 吃 ' + Tiles.tileName(tile)); Game.ui.render(); }
      await d(450);
      st.turn = q.seat;
      await doTurn(q.seat, 'discard');
      return;
    }
  }

  function removeN(arr, t, n) {
    for (var k = 0; k < n; k++) { var i = arr.indexOf(t); if (i >= 0) arr.splice(i, 1); }
  }

  /* -------------------- 杠 -------------------- */
  async function doShangGang(p, code) {
    var st = Game.state;
    // 抢杠检查
    var robber = null;
    for (var i = 1; i <= 3; i++) {
      var q = st.players[(p.seat + i) % 4];
      var h = q.hand.slice(); h.push(code);
      if (Hand.canWin(Tiles.countsFrom(h), st.wildCode, q.melds.length)) {
        if (!Game.settings.mustKnock || q.knocked) { robber = q; break; }
      }
    }
    removeN(p.hand, code, 1);
    var meld = null;
    for (var mi = 0; mi < p.melds.length; mi++) if (p.melds[mi].type === 'peng' && p.melds[mi].code === code) meld = p.melds[mi];
    if (meld) meld.type = 'gang';
    else p.melds.push({ type: 'gang', code: code, tiles: [code, code, code, code] });
    sortHand(p);
    if (Game.ui) { Game.ui.toast(p.name + ' 杠 ' + Tiles.tileName(code)); Game.ui.render(); }

    if (robber) {
      if (!robber.isBot) {
        var rr = await Game.ui.waitClaim({ hu: true, qiangGang: true }, code, p);
        if (rr) { await doHu(robber, p.seat, false, true, code); return; }
      } else {
        await doHu(robber, p.seat, false, true, code); return;
      }
    }
    await d(400);
    var rg2 = drawClean(p, true);
    if (rg2.tile == null) { await doDrawGame(); return; }
    p.drawn = rg2.tile; p.hand.push(rg2.tile); sortHand(p);
    st.pendingGangKai = true;
    st.turn = p.seat;
    await doTurn(p.seat, 'discard');
  }

  async function doAnGang(p, code) {
    var st = Game.state;
    removeN(p.hand, code, 4);
    p.melds.push({ type: 'angang', code: code, tiles: [code, code, code, code] });
    sortHand(p);
    if (Game.ui) { Game.ui.toast(p.name + ' 暗杠 ' + Tiles.tileName(code)); Game.ui.render(); }
    await d(400);
    var rg2 = drawClean(p, true);
    if (rg2.tile == null) { await doDrawGame(); return; }
    p.drawn = rg2.tile; p.hand.push(rg2.tile); sortHand(p);
    st.pendingGangKai = true;
    st.turn = p.seat;
    await doTurn(p.seat, 'discard');
  }

  /* -------------------- 胡牌结算 -------------------- */
  async function doHu(p, loserSeat, gangKai, qiangGang, winTile) {
    var st = Game.state;
    // 点炮 / 抢杠：胡的那张牌并入手牌，保证计分与展示都是完整 14 张
    // 注意：必须无条件 push —— 手牌里可能已有同码牌（如百搭），不能用 indexOf 判断
    if (winTile != null) {
      p.hand.push(winTile);
      sortHand(p);
      p.drawn = null;
    }
    var res = Score.compute({
      hand: p.hand.slice(), melds: p.melds.slice(), flowers: p.flowers.slice(),
      wildCode: st.wildCode, selfDraw: loserSeat == null, gangKai: gangKai,
      qiangGang: qiangGang, isKaiBao: st.kaiBao, huangFan: st.huangFan,
      dragonsAsFlowers: Game.settings.dragonsAsFlowers
    });
    var total = res.total;
    var payments = [];
    if (loserSeat == null) {
      for (var i = 0; i < 4; i++) {
        if (i === p.seat) payments.push({ seat: i, delta: total * 3 });
        else payments.push({ seat: i, delta: -total });
      }
    } else {
      for (var j = 0; j < 4; j++) {
        if (j === p.seat) payments.push({ seat: j, delta: total });
        else if (j === loserSeat) payments.push({ seat: j, delta: -total });
        else payments.push({ seat: j, delta: 0 });
      }
    }
    payments.forEach(function (pm) { st.players[pm.seat].score += pm.delta; });

    st.over = true;
    st.result = {
      winner: p.seat, loser: loserSeat, winTile: winTile, gangKai: gangKai,
      qiangGang: qiangGang, selfDraw: loserSeat == null, res: res,
      payments: payments, hand: p.hand.slice(), melds: p.melds.slice(), flowers: p.flowers.slice()
    };
    if (Game.settings.huangFan && st.huangFan > 0) st.huangFan -= 1;
    st.dealer = p.seat;
    st.round += 1;
    if (Game.ui) Game.ui.render();
    await d(300);
    await Game.ui.showResult(st.result);
    startRound();
  }

  async function doDrawGame() {
    var st = Game.state;
    st.over = true;
    if (Game.settings.huangFan) st.huangFan += 1;
    st.round += 1;
    if (Game.ui) Game.ui.render();
    await Game.ui.showDraw();
    startRound();
  }

  Game.newGame = newGame;
  Game.startRound = startRound;
  Game.discardCode = discardCode;
  Game.isTenpai = isTenpai;
  Game.canWinNow = canWinNow;
  global.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
