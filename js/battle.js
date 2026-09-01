'use strict';
/* ================= 《拾遗录》战棋战斗引擎 =================
 * 回合制走格子：移动 + 普攻/技能/绝技，速度决定出手顺序
 * ====================================================== */

const T = 54; // 格子边长(px)
let B = null;
let _uid = 1;

const d = ms => (B && B.fast ? Math.round(ms * 0.45) : ms);
const key = (x, y) => x + ',' + y;
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const opp = side => (side === 'ally' ? 'enemy' : 'ally');
const aliveOf = side => B.units.filter(u => u.alive && u.side === side);
const unitAt = (x, y) => B.units.find(u => u.alive && u.x === x && u.y === y);
const STAT_NAME = { atk: '攻击', def: '防御', spd: '速度', mov: '移动', rng: '射程' };

function eff(u, stat) {
  let m = 1, flat = 0;
  for (const b of u.buffs) {
    if (b.stat !== stat) continue;
    if (b.pct) m += b.pct;
    if (b.flat) flat += b.flat;
  }
  const base = { atk: u.atk0, def: u.def0, spd: u.spd0, mov: u.mov0, rng: u.rng0 }[stat];
  return Math.max(stat === 'mov' ? 1 : 1, Math.round(base * m + flat));
}

/* ---------------- 战斗初始化 ---------------- */
async function startBattle(stage, chapter, teamIds, onEnd) {
  B = {
    stage, chapter, onEnd,
    w: stage.map[0].length, h: stage.map.length,
    obstacles: new Set(), units: [],
    round: 1, queue: [], qi: 0,
    cur: null, pu: null, phase: 'idle', pending: null,
    resolveTurn: null, over: false, win: false,
    auto: false, fast: false,
  };

  const allySpots = [], enemySpots = [];
  stage.map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === '#') B.obstacles.add(key(x, y));
      else if (c === 'A') allySpots.push([x, y]);
      else if (c === 'e' || c === 'B') enemySpots.push([x, y]);
    }
  });

  teamIds.slice(0, allySpots.length).forEach((id, i) => {
    const def = CHAR_MAP[id], st = G.chars[id];
    const s = statsOf(def, st.lv, st.star);
    const [x, y] = allySpots[i];
    B.units.push({
      uid: _uid++, side: 'ally', def, name: def.name, emoji: def.emoji, hue: def.hue, cls: def.cls,
      lv: st.lv, star: st.star, x, y,
      maxHp: s.hp, hp: s.hp, atk0: s.atk, def0: s.def, spd0: s.spd, mov0: s.mov, rng0: s.rng,
      energy: 20, cd: 0, buffs: [], shield: null, moved: false, acted: false, alive: true,
      skill: def.skill, ult: def.ult,
    });
  });
  stage.enemies.forEach((e, i) => {
    if (i >= enemySpots.length) return;
    const def = ENEMIES[e.t];
    const s = enemyStatsOf(def, stage.mul);
    const [x, y] = enemySpots[i];
    B.units.push({
      uid: _uid++, side: 'enemy', def, name: def.name, emoji: def.emoji, hue: def.hue, cls: def.cls,
      lv: stage.lvl, star: 0, x, y,
      maxHp: s.hp, hp: s.hp, atk0: s.atk, def0: s.def, spd0: s.spd, mov0: s.mov, rng0: s.rng,
      energy: 0, cd: 0, buffs: [], shield: null, moved: false, acted: false, alive: true,
      skill: def.skill, ult: null,
    });
  });

  buildBattleDOM();
  renderTiles();
  B.units.forEach(u => {
    u.el = makeUnitEl(u);
    B.unitsEl.appendChild(u.el);
    syncUnitEl(u);
  });
  renderTop(); renderOrder(); renderInfo(null); renderActions(null);

  await showCutin(null, { name: `${stage.id} · ${stage.name}`, uline: '—— 开战 ——' });
  await runLoop();
  await sleep(d(700));
  const result = { win: B.win, stage };
  const cb = B.onEnd; B = null;
  cb(result);
}

function buildBattleDOM() {
  $('#screen-battle').innerHTML = `
    <div id="bt">
      <div id="bt-top">
        <div id="bt-stage"></div>
        <div id="bt-round"></div>
        <div id="bt-left"></div>
        <div class="bt-btns">
          <button id="bt-auto" class="bt-btn" title="自动战斗">🤖 自动</button>
          <button id="bt-fast" class="bt-btn" title="战斗速度">×1</button>
          <button id="bt-retreat" class="bt-btn bt-danger">撤退</button>
        </div>
      </div>
      <div id="bt-order"></div>
      <div id="bt-field" style="width:${B.w * T}px;height:${B.h * T}px">
        <div id="bt-tiles"></div>
        <div id="bt-units"></div>
        <div id="bt-floats"></div>
      </div>
      <div id="bt-bottom">
        <div id="bt-info"></div>
        <div id="bt-actions"></div>
      </div>
    </div>
    <div id="bt-cutin"><div class="cutin-inner"></div></div>`;
  B.field = $('#bt-field');
  B.tilesEl = $('#bt-tiles');
  B.unitsEl = $('#bt-units');
  B.floatsEl = $('#bt-floats');
  B.infoEl = $('#bt-info');
  B.actionsEl = $('#bt-actions');
  B.tileEls = {};

  $('#bt-auto').onclick = () => {
    B.auto = !B.auto;
    $('#bt-auto').classList.toggle('on', B.auto);
    sfx('click');
    if (B.auto && B.pu && (B.phase === 'select' || B.phase === 'targeting')) {
      const u = B.pu;
      B.pu = null; B.pending = null; B.phase = 'anim';
      clearHL(); renderActions(null);
      aiAct(u); // endAction 内部会唤醒 playerAct 的 Promise
    }
  };
  $('#bt-fast').onclick = () => {
    B.fast = !B.fast;
    $('#bt-fast').textContent = B.fast ? '×2' : '×1';
    sfx('click');
  };
  $('#bt-retreat').onclick = () => {
    if (B.over) return;
    if (!confirm('确定撤退吗？本次战斗消耗的体力不予返还。')) return;
    B.over = true; B.win = false;
    if (B.resolveTurn) { const r = B.resolveTurn; B.resolveTurn = null; r(); }
  };
}

/* ---------------- 格子与单位渲染 ---------------- */
function renderTiles() {
  let html = '';
  for (let y = 0; y < B.h; y++) {
    for (let x = 0; x < B.w; x++) {
      const c = B.stage.map[y][x];
      let cls = 'tile';
      if (c === '#') cls += ' obstacle';
      if (c === 'A') cls += ' spawn-a';
      if (c === 'e' || c === 'B') cls += ' spawn-e';
      html += `<div class="${cls}" data-x="${x}" data-y="${y}">${c === '#' ? B.chapter.deco : ''}</div>`;
    }
  }
  B.tilesEl.style.gridTemplateColumns = `repeat(${B.w}, ${T}px)`;
  B.tilesEl.innerHTML = html;
  B.tilesEl.querySelectorAll('.tile').forEach(t => {
    B.tileEls[key(+t.dataset.x, +t.dataset.y)] = t;
  });
  B.tilesEl.addEventListener('click', e => {
    const t = e.target.closest('.tile');
    if (!t) return;
    onTileClick(+t.dataset.x, +t.dataset.y);
  });
}

function makeUnitEl(u) {
  const el = document.createElement('div');
  el.className = `unit ${u.side}${u.def.boss ? ' boss' : ''}`;
  el.innerHTML = `
    <div class="u-avatar" style="background:radial-gradient(circle at 35% 30%, hsl(${u.hue},55%,52%), hsl(${u.hue},50%,18%))">${u.emoji}</div>
    <div class="u-bars">
      <div class="u-hp"><i></i></div>
      ${u.side === 'ally' ? '<div class="u-en"><i></i></div>' : ''}
    </div>
    <div class="u-badges"></div>`;
  return el;
}

function syncUnitEl(u) {
  if (!u.el) return;
  u.el.style.left = u.x * T + 'px';
  u.el.style.top = u.y * T + 'px';
  const hpBar = u.el.querySelector('.u-hp i');
  hpBar.style.width = Math.max(0, u.hp / u.maxHp * 100) + '%';
  hpBar.className = u.hp / u.maxHp < 0.3 ? 'low' : '';
  const enBar = u.el.querySelector('.u-en i');
  if (enBar) { enBar.style.width = u.energy + '%'; enBar.className = u.energy >= 100 ? 'full' : ''; }
  const badges = [];
  if (u.shield && u.shield.amt > 0) badges.push('🛡');
  if (u.buffs.some(b => (b.pct || b.flat) > 0)) badges.push('✨');
  if (u.buffs.some(b => (b.pct || b.flat) < 0)) badges.push('💢');
  u.el.querySelector('.u-badges').textContent = badges.join('');
  u.el.classList.toggle('cur', B.cur === u && u.alive);
  u.el.classList.toggle('dead', !u.alive);
  u.el.style.zIndex = u.alive ? 10 + u.y : 1;
}

function renderUnits() { B.units.forEach(syncUnitEl); }

function renderTop() {
  $('#bt-stage').textContent = `${B.chapter.name.split(' · ')[0]} ${B.stage.id} ${B.stage.name}`;
  $('#bt-round').textContent = `回合 ${B.round}`;
  $('#bt-left').textContent = `敌方剩余 ${aliveOf('enemy').length}`;
}

function renderOrder() {
  const rest = B.queue.slice(B.qi).filter(u => u.alive);
  const seq = (B.cur && B.cur.alive ? [B.cur] : []).concat(rest).slice(0, 10);
  $('#bt-order').innerHTML = seq.map(u =>
    `<div class="order-item ${u === B.cur ? 'cur' : ''} ${u.side}" title="${u.name}">${u.emoji}</div>`).join('');
}

function renderInfo(u) {
  if (!u) { B.infoEl.innerHTML = '<div class="info-empty">—</div>'; return; }
  const buffTxt = u.buffs.map(b =>
    `${STAT_NAME[b.stat]}${(b.pct || b.flat) > 0 ? '+' : ''}${b.pct ? Math.round(b.pct * 100) + '%' : b.flat}(${b.turns}回合)`).join('　');
  B.infoEl.innerHTML = `
    <div class="info-head">
      <span class="info-emoji" style="background:radial-gradient(circle at 35% 30%, hsl(${u.hue},55%,52%), hsl(${u.hue},50%,18%))">${u.emoji}</span>
      <div class="info-title"><b>${u.name}</b><small>${u.side === 'ally' ? `Lv.${u.lv} ★${u.star} · ${u.cls}` : `${u.cls} · 魇`}</small></div>
    </div>
    <div class="bar hp"><i style="width:${Math.max(0, u.hp / u.maxHp * 100)}%"></i><span>${Math.max(0, u.hp)}/${u.maxHp}${u.shield && u.shield.amt > 0 ? ` <em>🛡${u.shield.amt}</em>` : ''}</span></div>
    ${u.side === 'ally' ? `<div class="bar en"><i style="width:${u.energy}%"></i><span>能量 ${u.energy}/100</span></div>` : ''}
    <div class="info-stats">攻 ${eff(u, 'atk')} ｜ 防 ${eff(u, 'def')} ｜ 速 ${eff(u, 'spd')} ｜ 移 ${eff(u, 'mov')} ｜ 射程 ${eff(u, 'rng')}</div>
    ${buffTxt ? `<div class="info-buffs">${buffTxt}</div>` : ''}`;
}

function renderActions(u) {
  if (!u || u.side !== 'ally' || B.phase === 'anim') {
    B.actionsEl.innerHTML = `<div class="act-hint">${B.over ? '' : u && u.side === 'enemy' ? '敌方行动中…' : ''}</div>`;
    return;
  }
  const skillReady = u.cd === 0 && !u.acted;
  const ultReady = u.energy >= 100 && !u.acted;
  B.actionsEl.innerHTML = `
    <div class="act-hint">${B.phase === 'targeting' ? '选择目标（点击其他位置取消）' : '点击<b class="c-blue">蓝色格</b>移动 ｜ 点击<b class="c-red">红框敌人</b>普攻'}</div>
    <div class="act-btns">
      <button id="act-skill" class="act-btn" ${skillReady ? '' : 'disabled'} title="${u.skill.desc}">技能·${u.skill.name}<small>${u.cd > 0 ? `冷却${u.cd}回合` : '就绪'}</small></button>
      <button id="act-ult" class="act-btn ult" ${ultReady ? '' : 'disabled'} title="${u.ult.desc}">绝技·${u.ult.name}<small>能量 ${u.energy}/100</small></button>
      <button id="act-wait" class="act-btn wait">待机<small>结束回合</small></button>
    </div>`;
  $('#act-skill').onclick = () => { if (skillReady) startTargeting(u, u.skill, false); };
  $('#act-ult').onclick = () => { if (ultReady) startTargeting(u, u.ult, true); };
  $('#act-wait').onclick = () => { sfx('click'); u.acted = true; endAction(u); };
}

/* ---------------- 高亮 ---------------- */
function clearHL() {
  Object.values(B.tileEls).forEach(t => t.classList.remove('hl-move', 'hl-atk', 'hl-skill', 'hl-heal'));
}

function refreshPlayerUI() {
  clearHL();
  const u = B.pu;
  if (!u || !u.alive) return;
  if (!u.moved) {
    bfs(u).forEach((dd, k) => {
      if (k !== key(u.x, u.y)) B.tileEls[k].classList.add('hl-move');
    });
  }
  if (!u.acted && B.phase === 'select') {
    aliveOf('enemy').filter(f => dist(u, f) <= eff(u, 'rng'))
      .forEach(f => B.tileEls[key(f.x, f.y)].classList.add('hl-atk'));
  }
  renderInfo(u); renderActions(u); renderUnits(); renderOrder();
}

/* ---------------- 寻路 ---------------- */
function bfs(u) {
  const mov = eff(u, 'mov');
  const map = new Map([[key(u.x, u.y), 0]]);
  const q = [[u.x, u.y]];
  while (q.length) {
    const [x, y] = q.shift();
    const d0 = map.get(key(x, y));
    if (d0 >= mov) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= B.w || ny >= B.h || map.has(k)) continue;
      if (B.obstacles.has(k) || unitAt(nx, ny)) continue;
      map.set(k, d0 + 1);
      q.push([nx, ny]);
    }
  }
  return map;
}

/* ---------------- 回合流程 ---------------- */
function buildQueue() {
  return B.units.filter(u => u.alive).sort((a, b) => eff(b, 'spd') - eff(a, 'spd') || a.uid - b.uid);
}

function nextUnit() {
  while (B.qi < B.queue.length) {
    const u = B.queue[B.qi++];
    if (u.alive) return u;
  }
  return null;
}

function startTurn(u) {
  u.moved = false; u.acted = false;
  u.buffs.forEach(b => b.turns--);
  u.buffs = u.buffs.filter(b => b.turns > 0);
  if (u.shield) { u.shield.turns--; if (u.shield.turns <= 0 || u.shield.amt <= 0) u.shield = null; }
  if (u.cd > 0) u.cd--;
  if (u.side === 'ally') u.energy = Math.min(100, u.energy + 8);
  B.cur = u;
  renderTop(); renderOrder(); renderInfo(u); renderUnits();
}

async function runLoop() {
  B.queue = buildQueue(); B.qi = 0;
  while (!B.over) {
    const u = nextUnit();
    if (!u) {
      B.round++;
      if (B.round > 60) { B.over = true; B.win = false; break; }
      B.queue = buildQueue(); B.qi = 0;
      renderTop(); renderOrder();
      continue;
    }
    startTurn(u);
    if (B.over) break;
    if (u.side === 'ally' && !B.auto) await playerAct(u);
    else await aiAct(u);
  }
  clearHL(); renderUnits(); renderOrder(); renderActions(null);
}

function playerAct(u) {
  return new Promise(res => {
    B.resolveTurn = res;
    B.pu = u;
    B.phase = 'select';
    refreshPlayerUI();
  });
}

function endAction(u) {
  checkEnd();
  renderUnits(); renderTop();
  if (B.pu === u) B.pu = null;
  B.phase = 'idle';
  B.pending = null;
  clearHL(); renderActions(null);
  const r = B.resolveTurn; B.resolveTurn = null;
  if (r) r();
}

function checkEnd() {
  if (B.over) return;
  if (!aliveOf('enemy').length) { B.over = true; B.win = true; }
  else if (!aliveOf('ally').length) { B.over = true; B.win = false; }
}

/* ---------------- 玩家操作 ---------------- */
function onTileClick(x, y) {
  if (!B || B.over || !B.pu) return;
  const u = B.pu;
  const clicked = unitAt(x, y);

  if (B.phase === 'targeting' && B.pending) {
    const p = B.pending;
    const okEnemy = p.sk.target === 'enemy' && clicked && clicked.side === 'enemy' && dist(u, clicked) <= eff(u, 'rng');
    const okAlly = p.sk.target === 'ally' && clicked && clicked.side === 'ally' && dist(u, clicked) <= eff(u, 'rng');
    if (okEnemy || okAlly) {
      const sk = p.sk, isUlt = p.isUlt;
      B.pending = null;
      execSkillAction(u, sk, clicked, isUlt);
    } else {
      B.pending = null; B.phase = 'select';
      refreshPlayerUI();
    }
    return;
  }

  if (B.phase !== 'select') return;

  if (clicked && clicked.side === 'enemy' && !u.acted && dist(u, clicked) <= eff(u, 'rng')) {
    playerBasic(u, clicked);
    return;
  }
  if (!clicked && !u.moved && bfs(u).has(key(x, y)) && !(x === u.x && y === u.y)) {
    playerMove(u, x, y);
  }
}

async function playerMove(u, x, y) {
  B.phase = 'anim';
  clearHL();
  u.x = x; u.y = y; u.moved = true;
  syncUnitEl(u);
  sfx('click');
  await sleep(d(280));
  if (B.over) return;
  B.phase = 'select';
  refreshPlayerUI();
}

async function playerBasic(u, target) {
  B.phase = 'anim';
  clearHL(); renderActions(null);
  await doStrike(u, [target], 1, {});
  u.energy = Math.min(100, u.energy + 25);
  u.acted = true;
  endAction(u);
}

function startTargeting(u, sk, isUlt) {
  sfx('click');
  // 无需点选目标的技能直接释放
  if (['self', 'allAllies', 'allEnemies', 'lowestAlly'].includes(sk.target)) {
    execSkillAction(u, sk, null, isUlt);
    return;
  }
  B.phase = 'targeting';
  B.pending = { sk, isUlt };
  clearHL();
  const cls = sk.target === 'enemy' ? 'hl-skill' : 'hl-heal';
  const side = sk.target === 'enemy' ? 'enemy' : 'ally';
  aliveOf(side).filter(t => dist(u, t) <= eff(u, 'rng'))
    .forEach(t => B.tileEls[key(t.x, t.y)].classList.add(cls));
  renderActions(u);
}

/* ---------------- 技能与效果 ---------------- */
async function execSkillAction(u, sk, targetUnit, isUlt) {
  B.phase = 'anim';
  B.pending = null;
  clearHL(); renderActions(null);
  if (isUlt) {
    u.energy = 0;
    await showCutin(u, sk);
  } else {
    floatOver(u, sk.name, 'f-skill');
    sfx('buff');
    await sleep(d(350));
  }
  let dealtDmg = false;
  for (const ef of sk.effects) {
    if (ef.t === 'dmg') dealtDmg = true;
    await applyEffect(u, ef, targetUnit, sk);
    if (B.over) break;
  }
  if (!isUlt) u.cd = sk.cd;
  if (dealtDmg && u.side === 'ally') u.energy = Math.min(100, u.energy + 25);
  u.acted = true;
  renderUnits();
  endAction(u);
}

function resolveTargets(user, who, targetUnit) {
  switch (who) {
    case 'self': return [user];
    case 'target': return targetUnit ? [targetUnit] : [];
    case 'allAllies': return aliveOf(user.side);
    case 'allEnemies': return aliveOf(opp(user.side));
    case 'lowestAlly': {
      const arr = aliveOf(user.side).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      return arr.length ? [arr[0]] : [];
    }
    case 'selfAoeEnemies': return aliveOf(opp(user.side)).filter(t => dist(user, t) <= 1);
    default: return targetUnit ? [targetUnit] : [];
  }
}

async function applyEffect(user, ef, targetUnit, sk) {
  const who = ef.who || (sk.target === 'enemy' || sk.target === 'ally' ? 'target' : sk.target);
  if (ef.t === 'dash' && targetUnit) {
    const spots = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => [targetUnit.x + dx, targetUnit.y + dy])
      .filter(([x, y]) => x >= 0 && y >= 0 && x < B.w && y < B.h && !B.obstacles.has(key(x, y)) && !unitAt(x, y))
      .sort((a, b) => dist(user, { x: a[0], y: a[1] }) - dist(user, { x: b[0], y: b[1] }));
    if (spots.length) {
      user.x = spots[0][0]; user.y = spots[0][1];
      syncUnitEl(user);
      await sleep(d(250));
    }
    return;
  }
  if (ef.t === 'dmg') {
    let targets;
    if (ef.aoe && targetUnit && (!ef.who || ef.who === 'target')) {
      targets = aliveOf(opp(user.side)).filter(t => dist(t, targetUnit) <= ef.aoe);
    } else {
      targets = resolveTargets(user, who, targetUnit);
    }
    await doStrike(user, targets, ef.mult, { rider: ef.rider, condBonus: ef.condBonus });
    return;
  }
  const targets = resolveTargets(user, who, targetUnit);
  for (const t of targets) {
    if (!t.alive) continue;
    if (ef.t === 'heal') {
      const amt = Math.round(eff(user, 'atk') * ef.mult);
      const real = Math.min(t.maxHp - t.hp, amt);
      t.hp += real;
      floatOver(t, '+' + real, 'f-heal');
      sfx('heal');
    } else if (ef.t === 'healMaxPct') {
      const amt = Math.round(t.maxHp * ef.pct);
      const real = Math.min(t.maxHp - t.hp, amt);
      t.hp += real;
      floatOver(t, '+' + real, 'f-heal');
      sfx('heal');
    } else if (ef.t === 'shield') {
      const amt = Math.round(t.maxHp * ef.maxHpPct);
      t.shield = { amt, turns: ef.turns };
      floatOver(t, `护盾 ${amt}`, 'f-shield');
      sfx('buff');
    } else if (ef.t === 'buff') {
      t.buffs.push({ stat: ef.stat, pct: ef.pct, flat: ef.flat, turns: ef.turns });
      const up = (ef.pct || ef.flat) > 0;
      floatOver(t, STAT_NAME[ef.stat] + (up ? '↑' : '↓'), up ? 'f-buff' : 'f-debuff');
      sfx('buff');
    } else if (ef.t === 'energy') {
      t.energy = Math.min(100, Math.max(0, t.energy + ef.amt));
      floatOver(t, '能量+' + ef.amt, 'f-energy');
    }
    syncUnitEl(t);
    await sleep(d(140));
  }
  checkEnd();
}

async function doStrike(att, targets, mult, opts = {}) {
  targets = targets.filter(t => t.alive);
  if (!targets.length) return;
  for (const t of targets) {
    let m = mult;
    if (opts.condBonus && t.hp / t.maxHp < opts.condBonus.hpBelow) m += opts.condBonus.add;
    const crit = Math.random() < 0.15;
    let dmg = eff(att, 'atk') * m * (crit ? 1.5 : 1) * (0.95 + Math.random() * 0.1);
    dmg = Math.max(1, Math.round(dmg * 100 / (100 + eff(t, 'def'))));
    if (t.shield && t.shield.amt > 0) {
      const ab = Math.min(t.shield.amt, dmg);
      t.shield.amt -= ab; dmg -= ab;
      if (ab > 0) floatOver(t, '格挡 ' + ab, 'f-shield');
    }
    if (dmg > 0) {
      t.hp -= dmg;
      floatOver(t, (crit ? '暴击 ' : '') + dmg, crit ? 'f-crit' : 'f-dmg');
      t.el.classList.add('hit');
      setTimeout(() => t.el && t.el.classList.remove('hit'), 300);
      if (B.field) { B.field.classList.add('shake'); setTimeout(() => B.field && B.field.classList.remove('shake'), 200); }
    }
    if (t.side === 'ally') t.energy = Math.min(100, t.energy + 15);
    sfx(crit ? 'crit' : 'hit');
    if (t.hp <= 0) {
      t.hp = 0; t.alive = false;
      t.el.classList.add('dead');
      floatOver(t, '击破', 'f-ko');
    } else if (opts.rider) {
      t.buffs.push({ stat: opts.rider.stat, pct: opts.rider.pct, flat: opts.rider.flat, turns: opts.rider.turns });
      const up = (opts.rider.pct || opts.rider.flat) > 0;
      floatOver(t, STAT_NAME[opts.rider.stat] + (up ? '↑' : '↓'), up ? 'f-buff' : 'f-debuff');
    }
    syncUnitEl(t);
    renderTop();
    await sleep(d(260));
  }
  checkEnd();
}

/* ---------------- AI ---------------- */
function pickSkillTarget(u, foes) {
  const sk = u.skill;
  if (!sk) return null;
  if (sk.target === 'self') return u;
  if (sk.target === 'allEnemies') return foes[0] || null;
  if (sk.target === 'enemy') {
    const inRange = foes.filter(f => dist(u, f) <= eff(u, 'rng'));
    if (!inRange.length) return null;
    return inRange.sort((a, b) => {
      const ca = aliveOf('ally').filter(t => dist(t, a) <= (sk.effects[0] && sk.effects[0].aoe || 0)).length;
      const cb = aliveOf('ally').filter(t => dist(t, b) <= (sk.effects[0] && sk.effects[0].aoe || 0)).length;
      return cb - ca || a.hp - b.hp;
    })[0];
  }
  return null;
}

function pickUltTarget(u, foes) {
  const sk = u.ult;
  if (!sk) return null;
  if (sk.target === 'allEnemies') return foes.length ? foes[0] : null;
  if (sk.target === 'allAllies') return aliveOf('ally').some(a => a.hp < a.maxHp * 0.85) ? u : null;
  if (sk.target === 'self') return foes.some(f => dist(u, f) <= 2) ? u : null;
  if (sk.target === 'ally') {
    const hurt = aliveOf('ally').filter(a => a.hp < a.maxHp * 0.9 && dist(u, a) <= eff(u, 'rng'))
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    return hurt || null;
  }
  if (sk.target === 'enemy') {
    const inRange = foes.filter(f => dist(u, f) <= eff(u, 'rng'));
    return inRange.sort((a, b) => a.hp - b.hp)[0] || null;
  }
  return null;
}

function aiPickTile(u, focus) {
  const foes = aliveOf(opp(u.side));
  let best = [u.x, u.y], bestScore = 1e9;
  bfs(u).forEach((dd, k) => {
    const [x, y] = k.split(',').map(Number);
    const dmin = Math.min(...foes.map(f => Math.abs(x - f.x) + Math.abs(y - f.y)));
    let score = dmin;
    if (dmin <= eff(u, 'rng')) score -= 100;
    if (focus) score = Math.abs(x - focus.x) + Math.abs(y - focus.y) - (dist({ x, y }, focus) <= eff(u, 'rng') ? 100 : 0);
    if (score < bestScore) { bestScore = score; best = [x, y]; }
  });
  return best;
}

async function aiMoveTo(u, tile) {
  if (!tile) return;
  const [x, y] = tile;
  if (x === u.x && y === u.y) return;
  u.x = x; u.y = y; u.moved = true;
  syncUnitEl(u);
  await sleep(d(320));
}

async function aiBasic(u, t) {
  await doStrike(u, [t], 1, {});
  if (u.side === 'ally') u.energy = Math.min(100, u.energy + 25);
  u.acted = true;
  endAction(u);
}

async function aiAct(u) {
  await sleep(d(380));
  if (B.over || !u.alive) { if (!B.over) endAction(u); return; }
  const foes = aliveOf(opp(u.side));
  if (!foes.length) { endAction(u); return; }
  const isHealer = u.def.healAI || u.cls === '帷幄';

  if (u.side === 'ally' && u.ult && u.energy >= 100) {
    const tgt = pickUltTarget(u, foes);
    if (tgt !== null) { await execSkillAction(u, u.ult, tgt, true); return; }
  }
  if (isHealer && u.skill && u.cd === 0) {
    const hurt = aliveOf(u.side).filter(f => f.hp < f.maxHp * 0.92)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (hurt) {
      if (u.skill.target === 'lowestAlly' || dist(u, hurt) <= eff(u, 'rng')) {
        await execSkillAction(u, u.skill, hurt, false); return;
      }
      if (!u.moved) {
        await aiMoveTo(u, aiPickTile(u, hurt));
        if (u.skill.target === 'lowestAlly' || dist(u, hurt) <= eff(u, 'rng')) {
          await execSkillAction(u, u.skill, hurt, false); return;
        }
      }
    }
  }
  if (u.skill && u.cd === 0 && u.skill.target !== 'lowestAlly') {
    const tgt = pickSkillTarget(u, foes);
    if (tgt) { await execSkillAction(u, u.skill, tgt, false); return; }
  }
  let t = foes.filter(f => dist(u, f) <= eff(u, 'rng')).sort((a, b) => a.hp - b.hp)[0];
  if (t) { await aiBasic(u, t); return; }
  if (!u.moved) await aiMoveTo(u, aiPickTile(u, null));
  if (B.over) return;
  if (u.skill && u.cd === 0 && u.skill.target !== 'lowestAlly') {
    const tgt = pickSkillTarget(u, foes);
    if (tgt) { await execSkillAction(u, u.skill, tgt, false); return; }
  }
  t = foes.filter(f => dist(u, f) <= eff(u, 'rng')).sort((a, b) => a.hp - b.hp)[0];
  if (t) { await aiBasic(u, t); return; }
  endAction(u);
}

/* ---------------- 飘字 / 演出 ---------------- */
function floatAt(x, y, text, cls) {
  if (!B || !B.floatsEl) return;
  const f = document.createElement('div');
  f.className = 'float ' + cls;
  f.textContent = text;
  f.style.left = x * T + T / 2 + 'px';
  f.style.top = y * T + 'px';
  B.floatsEl.appendChild(f);
  setTimeout(() => f.remove(), 1150);
}
function floatOver(u, text, cls) { floatAt(u.x, u.y, text, cls); }

async function showCutin(u, sk) {
  const box = $('#bt-cutin');
  const inner = box.querySelector('.cutin-inner');
  if (u) {
    inner.innerHTML = `
      <div class="cutin-emoji" style="background:radial-gradient(circle at 35% 30%, hsl(${u.hue},60%,55%), hsl(${u.hue},55%,20%))">${u.emoji}</div>
      <div class="cutin-text"><div class="cutin-name">${sk.name}</div><div class="cutin-line">${sk.uline || ''}</div></div>`;
    sfx('ult');
  } else {
    inner.innerHTML = `<div class="cutin-text"><div class="cutin-name">${sk.name}</div><div class="cutin-line">${sk.uline || ''}</div></div>`;
  }
  box.classList.add('show');
  await sleep(d(u ? 1000 : 900));
  box.classList.remove('show');
  await sleep(120);
}
