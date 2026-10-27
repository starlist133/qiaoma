/* 界面与交互 */
(function (global) {
  'use strict';
  var Tiles = global.Tiles, Game = global.Game;
  var $ = function (id) { return document.getElementById(id); };

  var UI = {
    pending: null,
    toastTimer: null,
    speed: 1
  };

  /* ---------- 牌元素 ---------- */
  function tileEl(code, cls, wildCode) {
    var f = Tiles.tileFace(code);
    var el = document.createElement('div');
    el.className = 'tile ' + f.kind + (cls ? ' ' + cls : '') + (code === wildCode ? ' wild' : '');
    var top = document.createElement('span');
    top.className = 'num'; top.textContent = f.top;
    el.appendChild(top);
    if (f.bottom) {
      var b = document.createElement('span');
      b.className = 'suit'; b.textContent = f.bottom;
      el.appendChild(b);
    }
    return el;
  }
  function backEl(cls) {
    var el = document.createElement('div');
    el.className = 'tile back ' + (cls || '');
    return el;
  }
  function sortedIndices(hand) {
    var idx = hand.map(function (_, i) { return i; });
    idx.sort(function (a, b) { return hand[a] - hand[b]; });
    return idx;
  }
  function seatName(n) { return n; }

  /* ---------- 提示 ---------- */
  UI.toast = function (msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(UI.toastTimer);
    UI.toastTimer = setTimeout(function () { t.hidden = true; }, 1700);
  };

  function tip(html) { $('tipBar').innerHTML = html; }
  UI.setTip = function (html) { tip(html); };

  /* ---------- 渲染 ---------- */
  UI.render = function () {
    var st = Game.state;
    if (!st) return;
    $('hudRound').textContent = st.round;
    $('hudDealer').textContent = st.players[st.dealer].name;
    $('hudWall').textContent = st.wall.length;
    if (st.wildCode != null) {
      $('hudWildBox').hidden = false;
      $('hudWild').textContent = Tiles.tileName(st.wildCode);
    } else {
      $('hudWildBox').hidden = true;
    }
    var hh = $('hudHuang');
    if (st.huangFan > 0) { hh.hidden = false; hh.textContent = '荒番 ×' + Math.pow(2, st.huangFan); }
    else hh.hidden = true;
    $('hudKaiBao').hidden = !st.kaiBao;

    renderCenter(st);
    for (var i = 0; i < 4; i++) { renderSeat(i); renderDiscards(i); }
    renderActionBar();
  };

  function renderCenter(st) {
    var c = $('centerInfo');
    c.innerHTML = '';
    var tag = document.createElement('div');
    tag.className = 'roundtag';
    tag.textContent = '第 ' + st.round + ' 局';
    c.appendChild(tag);

    if (st.wildCode != null) {
      var box = document.createElement('div');
      box.className = 'wildBox';
      var l = document.createElement('span'); l.className = 'lbl'; l.textContent = '百搭';
      box.appendChild(l);
      box.appendChild(tileEl(st.wildCode, '', st.wildCode));
      var v = document.createElement('span'); v.className = 'val';
      v.textContent = Tiles.tileName(st.wildCode);
      box.appendChild(v);
      c.appendChild(box);
    }
    var wc = document.createElement('div');
    wc.className = 'wallcount';
    wc.innerHTML = st.wall.length + '<span>张余牌</span>';
    c.appendChild(wc);

    if (st.dice) {
      var dd = document.createElement('div');
      dd.className = 'dice';
      dd.textContent = '骰 ' + st.dice[0] + ' · ' + st.dice[1] + (st.kaiBao ? ' 开宝' : '');
      c.appendChild(dd);
    }
  }

  function renderSeat(seat) {
    var st = Game.state, p = st.players[seat];
    var el = $('seat' + seat);
    el.innerHTML = '';

    var info = document.createElement('div');
    info.className = 'pinfo';
    var nm = document.createElement('span');
    nm.className = 'pname'; nm.textContent = p.name;
    info.appendChild(nm);
    if (st.turn === seat && !st.over) {
      var tb = document.createElement('span');
      tb.className = 'badge turn'; tb.textContent = '行牌';
      info.appendChild(tb);
    }
    var sc = document.createElement('span');
    sc.className = 'pscore ' + (p.score > 0 ? 'pos' : (p.score < 0 ? 'neg' : ''));
    sc.textContent = (p.score > 0 ? '+' : '') + p.score;
    info.appendChild(sc);
    if (p.knocked) {
      var kb = document.createElement('span');
      kb.className = 'badge knock'; kb.textContent = '已敲';
      info.appendChild(kb);
    }
    if (p.flowers.length) {
      var fl = document.createElement('span');
      fl.className = 'flowers';
      fl.textContent = '花 ' + p.flowers.map(function (c) { return Tiles.tileName(c); }).join('');
      info.appendChild(fl);
    }

    var melds = document.createElement('div');
    melds.className = 'melds';
    p.melds.forEach(function (ml) {
      var box = document.createElement('div');
      box.className = 'meld';
      ml.tiles.forEach(function (t) { box.appendChild(tileEl(t, 'xs', st.wildCode)); });
      melds.appendChild(box);
    });

    var row = document.createElement('div');
    row.className = 'handRow';
    if (seat === 0) {
      var canPick = UI.pending && UI.pending.type === 'discard';
      sortedIndices(p.hand).forEach(function (i) {
        var t = p.hand[i];
        var e = tileEl(t, canPick ? 'pick' : '', st.wildCode);
        if (canPick) {
          e.addEventListener('click', function () { pickTile(i); });
        }
        row.appendChild(e);
      });
    } else {
      var n = Math.max(p.hand.length, 13);
      for (var k = 0; k < n; k++) row.appendChild(backEl('xs'));
    }

    if (seat === 0) {
      el.appendChild(melds);
      el.appendChild(row);
      el.appendChild(info);
    } else if (seat === 2) {
      el.appendChild(info);
      el.appendChild(melds);
      el.appendChild(row);
    } else {
      el.appendChild(info);
      el.appendChild(melds);
      el.appendChild(row);
    }
  }

  function renderDiscards(seat) {
    var st = Game.state, p = st.players[seat];
    var el = $('disc' + seat);
    el.innerHTML = '';
    p.discards.forEach(function (t, i) {
      var isLast = (i === p.discards.length - 1) && st.lastDiscard && st.lastDiscard.seat === seat;
      var e = tileEl(t, 'xs', st.wildCode);
      if (isLast) e.style.boxShadow = '0 0 0 2px #f0d78c, 0 2px 6px rgba(0,0,0,.4)';
      el.appendChild(e);
    });
  }

  /* ---------- 玩家操作 ---------- */
  function clearPending() { UI.pending = null; renderActionBar(); }

  function pickTile(index) {
    if (!UI.pending || UI.pending.type !== 'discard') return;
    var resolve = UI.pending.resolve;
    var t = Game.state.players[0].hand[index];
    UI.pending = null;
    renderActionBar();
    resolve({ type: 'discard', tile: t });
  }

  function renderActionBar() {
    var bar = $('actionBar');
    bar.innerHTML = '';
    if (!UI.pending) return;
    var p = UI.pending;

    function btn(label, cls, fn) {
      var b = document.createElement('button');
      b.className = 'act ' + cls;
      b.textContent = label;
      b.addEventListener('click', fn);
      bar.appendChild(b);
    }

    if (p.type === 'discard') {
      var o = p.opts || {};
      if (o.canKnock) {
        btn('敲', 'knock', function () {
          var r = UI.pending.resolve; UI.pending = null; renderActionBar();
         	r({ type: 'knock' });
        });
      }
      if (o.gang != null) {
        btn('杠', 'gang', function () {
          var r = UI.pending.resolve; UI.pending = null; renderActionBar();
          r({ type: 'gang' });
        });
      }
      if (o.anGang != null) {
        btn('暗杠', 'gang', function () {
          var r = UI.pending.resolve; UI.pending = null; renderActionBar();
          r({ type: 'angang' });
        });
      }
    }

    if (p.type === 'turn') {
      var o2 = p.opts || {};
      if (o2.hu) btn('自摸胡', 'hu', function () { finish({ type: 'hu' }); });
      if (o2.gang != null) btn('杠', 'gang', function () { finish({ type: 'gang' }); });
      if (o2.anGang != null) btn('暗杠', 'gang', function () { finish({ type: 'angang' }); });
      btn('过', 'pass', function () { finish({ type: 'pass' }); });
    }

    if (p.type === 'claim') {
      var o3 = p.opts || {};
      if (o3.hu) {
        btn(o3.qiangGang ? '抢杠胡' : '胡', 'hu', function () { finish({ type: 'hu' }); });
      }
      if (o3.peng) btn('碰', 'peng', function () { finish({ type: 'peng' }); });
      if (o3.gang) btn('杠', 'gang', function () { finish({ type: 'gang' }); });
      if (o3.chi && o3.chi.length) {
        o3.chi.forEach(function (pair) {
          var label = '吃 ' + Tiles.tileName(pair[0]) + Tiles.tileName(pair[1]);
          btn(label, 'chi', function () { finish({ type: 'chi', tiles: pair }); });
        });
      }
      btn('过', 'pass', function () { finish(null); });
    }
  }

  function finish(val) {
    if (!UI.pending) return;
    var r = UI.pending.resolve;
    UI.pending = null;
    renderActionBar();
    r(val);
  }

  UI.waitDiscard = function (opts) {
    return new Promise(function (resolve) {
      UI.pending = { type: 'discard', opts: opts || {}, resolve: resolve };
      UI.render();
      if (!opts || !opts.canKnock) {
        tip('轮到你了，点击手牌打出');
      } else {
        var st = Game.state, p = st.players[0];
        var h = p.hand.slice();
        var i = p.drawn != null ? h.indexOf(p.drawn) : -1;
        if (i >= 0) h.splice(i, 1);
        var waits = global.Hand.winningTiles(Tiles.countsFrom(h), st.wildCode, p.melds.length);
        var txt = waits.map(function (t) { return Tiles.tileName(t); }).join(' ');
        tip('<b>已听牌</b> 听：' + (txt || '—') + '　点「敲」锁定牌型（敲后摸什么打什么），或继续换牌');
      }
    });
  };

  UI.waitTurnAction = function (opts) {
    return new Promise(function (resolve) {
      UI.pending = { type: 'turn', opts: opts || {}, resolve: resolve };
      UI.render();
      tip('可以自摸胡牌了');
    });
  };

  UI.waitClaim = function (opts, tile, fromPlayer) {
    return new Promise(function (resolve) {
      UI.pending = { type: 'claim', opts: opts || {}, resolve: resolve };
      UI.render();
      var extra = opts.qiangGang ? '（抢杠）' : '';
      tip('【' + fromPlayer.name + '】打出 <b>' + Tiles.tileName(tile) + '</b>' + extra + '，你可以响应');
    });
  };

  /* ---------- 弹窗 ---------- */
  function showModal(html, onMount) {
    var m = $('modal'), card = $('modalCard');
    card.innerHTML = html;
    m.hidden = false;
    if (onMount) onMount(card);
  }
  function closeModal() { $('modal').hidden = true; $('modalCard').innerHTML = ''; }

  UI.showResult = function (r) {
    return new Promise(function (resolve) {
      var res = r.res;
      var isSelf = r.selfDraw;
      var title = r.winner === 0 ? '你胡了！' : Game.state.players[r.winner].name + ' 胡了';
      var sub = isSelf ? '自摸' : (r.qiangGang ? '抢杠胡' : (Game.state.players[r.loser].name + ' 放铳'));
      var html = '<h2>' + title + '</h2><p class="muted">' + sub + (r.gangKai ? ' · 杠开' : '') + '</p>';
      html += '<div class="winHand"></div>';
      html += '<h3>牌型</h3><div id="fanList"></div>';
      html += '<h3>花数</h3><div id="flowerList"></div>';
      html += '<div class="row" style="margin-top:10px;border-top:1px solid #e6e0cc;border-bottom:0">' +
        '<span>花 ' + res.flowerTotal + ' × 2<sup>' + res.fanTotal + '</sup>番' +
        (res.multTotal > 1 ? ' × ' + res.multTotal + '倍' : '') + '</span>' +
        '<span class="v" style="font-size:20px">' + res.total + ' 分</span></div>';
      html += '<table class="scoreTable"><thead><tr><th>玩家</th><th style="text-align:right">本局</th><th style="text-align:right">累计</th></tr></thead><tbody id="scoreBody"></tbody></table>';
      html += '<div class="modalFoot"><button class="btn" id="nextRound">下一局</button></div>';

      showModal(html, function (card) {
        // 胡牌手牌
        var wh = card.querySelector('.winHand');
        var st = Game.state;
        var hand = r.hand.slice().sort(function (a, b) { return a - b; });
        // 胡的那张牌高亮（点炮/抢杠时它已在手牌中）
        var hi = (r.winTile == null) ? -1 : hand.lastIndexOf(r.winTile);
        hand.forEach(function (t, idx) {
          wh.appendChild(tileEl(t, idx === hi ? 'wintile' : '', st.wildCode));
        });
        // 副露（碰/杠/吃）一并展示，避免只看 11 张造成困惑
        if (r.melds && r.melds.length) {
          var gap = document.createElement('div');
          gap.className = 'winGap';
          wh.appendChild(gap);
          r.melds.forEach(function (ml) {
            var g = document.createElement('div');
            g.className = 'winMeld';
            var ts = ml.tiles || [ml.code, ml.code, ml.code];
            ts.forEach(function (t) { g.appendChild(tileEl(t, 'sm', st.wildCode)); });
            g.title = ({ peng: '碰', gang: '明杠', angang: '暗杠', chi: '吃' }[ml.type] || '副露') + ' ' + Tiles.tileName(ml.code);
            wh.appendChild(g);
          });
        }
        // 番
        var fl = card.querySelector('#fanList');
        if (!res.fans.length) fl.innerHTML = '<p class="muted">无番（平胡）</p>';
        else res.fans.forEach(function (f) {
          var row = document.createElement('div');
          row.className = 'row';
          row.innerHTML = '<span>' + f.name + '</span><span class="v">' + f.fan + ' 番</span>';
          fl.appendChild(row);
        });
        res.mults.forEach(function (m) {
          var row = document.createElement('div');
          row.className = 'row';
          row.innerHTML = '<span>' + m.name + '</span><span class="v">×' + m.mult + '</span>';
          fl.appendChild(row);
        });
        // 花
        var fwl = card.querySelector('#flowerList');
        res.flowers.forEach(function (f) {
          var row = document.createElement('div');
          row.className = 'row';
          row.innerHTML = '<span>' + f.name + '</span><span class="v">' + f.value + ' 花</span>';
          fwl.appendChild(row);
        });
        // 分数
        var body = card.querySelector('#scoreBody');
        var stt = Game.state;
        [0, 1, 2, 3].forEach(function (i) {
          var pm = r.payments.filter(function (x) { return x.seat === i; })[0] || { delta: 0 };
          var tr = document.createElement('tr');
          tr.innerHTML = '<td>' + stt.players[i].name + '</td>' +
            '<td class="num ' + (pm.delta > 0 ? 'pos' : (pm.delta < 0 ? 'neg' : '')) + '">' +
            (pm.delta > 0 ? '+' : '') + pm.delta + '</td>' +
            '<td class="num">' + stt.players[i].score + '</td>';
          body.appendChild(tr);
        });
        card.querySelector('#nextRound').addEventListener('click', function () {
          closeModal();
          resolve();
        });
      });
    });
  };

  UI.showDraw = function () {
    return new Promise(function (resolve) {
      var st = Game.state;
      var html = '<h2>流局</h2><p class="muted">牌墙摸完，四家都未胡牌。' +
        (Game.settings.huangFan ? '进入荒番 ×' + Math.pow(2, st.huangFan) : '') + '</p>';
      html += '<div class="modalFoot"><button class="btn" id="nextRound">下一局</button></div>';
      showModal(html, function (card) {
        card.querySelector('#nextRound').addEventListener('click', function () {
          closeModal(); resolve();
        });
      });
    });
  };

  /* ---------- 规则 / 设置 ---------- */
  var RULES_HTML = [
    '<h2>上海敲麻 · 百搭版</h2>',
    '<p class="muted">按上海本地敲麻规则整理；几处有争议的细节做成了设置项，可自行切换。</p>',
    '<h3>用牌</h3>',
    '<ul><li>共 144 张：万/条/筒各 36，风牌（东南西北）16，花牌 20（中发白各 4 + 春夏秋冬梅兰竹菊各 1）。</li>',
    '<li>中发白在本版按<b>花牌</b>处理：摸到即补花、算 1 花，不参与组牌（可在设置里关闭）。</li></ul>',
    '<h3>百搭</h3>',
    '<ul><li>开局翻一张引导牌，其<b>下一张</b>为百搭（如翻到 5 万，百搭是 6 万；翻到九筒则为一筒；翻到风牌顺延；翻到花牌则为东风）。</li>',
    '<li>百搭可当除花牌外任意牌使用，也可当它本身用。</li>',
    '<li>百搭牌计 1 花；打出后即失效。</li></ul>',
    '<h3>行牌</h3>',
    '<ul><li>只能碰、杠（默认不可吃，可在设置里开启），不能吃牌时下家摸牌。</li>',
    '<li>胡牌必须先<b>敲（报听）</b>：手牌听牌后点「敲」，之后不能换牌，摸什么打什么，有胡必胡。</li>',
    '<li>胡牌方式：自摸、抓铳（别人打出）、抢杠（别人上杠）。</li>',
    '<li>碰出的牌再摸到第 4 张为上杠，别人可抢杠胡。</li></ul>',
    '<h3>花与番</h3>',
    '<ul><li>底花 1；每张花牌 1 花；风刻 1 花、风明杠 2 花、风暗杠 3 花；序数牌明杠 1 花、暗杠 2 花；百搭 1 花。</li>',
    '<li>整手没有花 = <b>无花果</b>，直接计 10 花。</li>',
    '<li>番种：门清 1、碰碰胡 1、混一色 1、大吊车 1、杠开 1；清一色 2、混碰 2；清碰 3。一个番 = ×2。</li>',
    '<li><b>得分 = 花数 × 2^番数 × 倍数</b>；抢杠 ×3，开宝 ×2，荒番每级 ×2。</li>',
    '<li>自摸三家各付；放铳由放铳者独付；抢杠由杠牌者付。</li></ul>',
    '<h3>荒番 / 开宝</h3>',
    '<ul><li>流局累积荒番，下一局胡牌翻倍；有人胡牌则荒番减 1。</li>',
    '<li>开局骰子同点或 1·4 为开宝，本局分数 ×2。</li></ul>',
    '<div class="modalFoot"><button class="btn" id="closeM">知道了</button></div>'
  ].join('');

  function openRules() {
    showModal(RULES_HTML, function (card) {
      card.querySelector('#closeM').addEventListener('click', closeModal);
    });
  }

  function switchRow(id, title, desc, checked) {
    return '<div class="setRow"><div><label for="' + id + '">' + title + '</label>' +
      '<div class="desc">' + desc + '</div></div>' +
      '<span class="switch"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '><i></i></span></div>';
  }

  function openSettings() {
    var S = Game.settings;
    var html = '<h2>设置</h2><p class="muted">改动在下一局生效</p>';
    html += switchRow('setDragon', '中发白算花牌', '敲麻特色：摸到即补花，不参与组牌', S.dragonsAsFlowers);
    html += switchRow('setWild', '启用百搭', '翻牌定百搭，可替代任意牌', S.useWild);
    html += switchRow('setChi', '允许吃牌', '上海多数打法不吃牌，默认关闭', S.allowChi);
    html += switchRow('setKnock', '必须先敲（报听）才能胡', '关闭则听牌即可直接胡', S.mustKnock);
    html += switchRow('setHuang', '荒番 / 开宝加倍', '流局累加荒番，骰子开宝翻倍', S.huangFan);
    html += '<div class="setRow"><div><label>出牌速度</label><div class="desc">电脑思考与动画节奏</div></div>' +
      '<select id="setSpeed" style="font-family:inherit;font-size:13px;padding:6px 10px;border-radius:8px;border:1px solid #dfe3dd">' +
      '<option value="1.4">慢</option><option value="1">正常</option><option value="0.55">快</option></select></div>';
    html += '<div class="modalFoot"><button class="btn ghost" id="closeM">关闭</button>' +
      '<button class="btn" id="restart">保存并重开</button></div>';
    showModal(html, function (card) {
      card.querySelector('#setSpeed').value = String(S.speed);
      card.querySelector('#closeM').addEventListener('click', closeModal);
      card.querySelector('#restart').addEventListener('click', function () {
        S.dragonsAsFlowers = card.querySelector('#setDragon').checked;
        S.useWild = card.querySelector('#setWild').checked;
        S.allowChi = card.querySelector('#setChi').checked;
        S.mustKnock = card.querySelector('#setKnock').checked;
        S.huangFan = card.querySelector('#setHuang').checked;
        S.speed = parseFloat(card.querySelector('#setSpeed').value) || 1;
        saveSettings();
        closeModal();
        UI.pending = null;
        Game.newGame();
      });
    });
  }

  function saveSettings() {
    try {
      localStorage.setItem('qiaoma.settings', JSON.stringify(Game.settings));
    } catch (e) { }
  }
  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem('qiaoma.settings') || 'null');
      if (s) Object.keys(s).forEach(function (k) { if (k in Game.settings) Game.settings[k] = s[k]; });
    } catch (e) { }
  }

  /* ---------- 初始化 ---------- */
  UI.init = function () {
    loadSettings();
    Game.ui = UI;
    $('btnRules').addEventListener('click', openRules);
    $('btnSettings').addEventListener('click', openSettings);
    $('btnNew').addEventListener('click', function () {
      if (UI.pending) { UI.toast('请先完成当前操作'); return; }
      UI.pending = null;
      Game.newGame();
    });
    Game.newGame();
  };

  global.UI = UI;
  document.addEventListener('DOMContentLoaded', function () { UI.init(); });
})(typeof window !== 'undefined' ? window : globalThis);
