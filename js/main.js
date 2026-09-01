'use strict';
/* ================= 《拾遗录》主逻辑 =================
 * 存档 / 顶栏 / 首页 / 关卡选择 / 角色养成 / 寻珍
 * ================================================== */

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE_KEY = 'shiyilu_save_v1';
const STAM_INTERVAL = 5 * 60 * 1000; // 5分钟回1点体力

/* ---------------- 存档 ---------------- */
function defaultState() {
  return {
    v: 1,
    huipo: 1600, books: 20,
    stam: 100, stamTs: Date.now(),
    lv: 1, axp: 0,
    pity: 0, pulls: 0,
    chars: {
      changxin:  { lv: 1, star: 1, xin: 0 },
      fuhao:     { lv: 1, star: 1, xin: 0 },
      shuochang: { lv: 1, star: 1, xin: 0 },
      renmian:   { lv: 1, star: 1, xin: 0 },
    },
    team: ['fuhao', 'changxin', 'shuochang', 'renmian'],
    cleared: {},
    muted: false,
    chapter: 'c1',
  };
}

let G;
try {
  G = Object.assign(defaultState(), JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
} catch (e) { G = defaultState(); }

function save() { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); }

const stamCap = () => 100 + G.lv * 2;
const axpNeed = () => G.lv * 120;

/* 体力随时间恢复 */
function tickStam() {
  const now = Date.now();
  if (G.stam >= stamCap()) { G.stamTs = now; return; }
  const gain = Math.floor((now - G.stamTs) / STAM_INTERVAL);
  if (gain > 0) {
    G.stam = Math.min(stamCap(), G.stam + gain);
    G.stamTs += gain * STAM_INTERVAL;
    save();
  }
}

/* ---------------- 音效 ---------------- */
let AC = null;
function sfx(name) {
  if (G.muted) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const t = AC.currentTime;
    const o = AC.createOscillator(), g = AC.createGain();
    o.connect(g); g.connect(AC.destination);
    const conf = {
      click: [660, 0.05, 'square', 0.04],
      hit:   [180, 0.12, 'sawtooth', 0.08],
      crit:  [120, 0.2,  'sawtooth', 0.12],
      heal:  [520, 0.25, 'sine', 0.08],
      buff:  [440, 0.15, 'triangle', 0.07],
      ult:   [90,  0.5,  'sawtooth', 0.14],
      win:   [523, 0.5,  'triangle', 0.1],
      lose:  [200, 0.6,  'sine', 0.1],
      gacha: [880, 0.3,  'triangle', 0.08],
    }[name] || [440, 0.1, 'sine', 0.05];
    o.type = conf[2];
    o.frequency.setValueAtTime(conf[0], t);
    if (name === 'win') { o.frequency.setValueAtTime(523, t); o.frequency.linearRampToValueAtTime(1046, t + 0.4); }
    if (name === 'heal') o.frequency.linearRampToValueAtTime(conf[0] * 1.5, t + conf[1]);
    if (name === 'ult') o.frequency.linearRampToValueAtTime(400, t + 0.4);
    g.gain.setValueAtTime(conf[3], t);
    g.gain.exponentialRampToValueAtTime(0.001, t + conf[1]);
    o.start(t); o.stop(t + conf[1]);
  } catch (e) { /* 无音频环境则静默 */ }
}

/* ---------------- 通用UI ---------------- */
function toast(msg, ms = 1800) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), ms);
}

function openModal(html, onClose) {
  const m = $('#modal'), box = $('#modal-box');
  box.innerHTML = html;
  m.classList.remove('hidden');
  m._onClose = onClose;
  box.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
}
function closeModal() {
  const m = $('#modal');
  m.classList.add('hidden');
  $('#modal-box').innerHTML = '';
  if (m._onClose) { const f = m._onClose; m._onClose = null; f(); }
}
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeModal();
});

function updateTop() {
  tickStam();
  $('#tb-lv').textContent = 'Lv.' + G.lv;
  $('#tb-axp').style.width = Math.min(100, G.axp / axpNeed() * 100) + '%';
  $('#tb-stam').textContent = `${G.stam}/${stamCap()}`;
  $('#tb-huipo').textContent = G.huipo;
  $('#tb-books').textContent = G.books;
  $('#btn-mute').textContent = G.muted ? '🔇' : '🔊';
}

/* ---------------- 界面切换 ---------------- */
function showScreen(name) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
  $$('#mainnav .nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
  $('#mainnav').style.display = name === 'battle' ? 'none' : '';
  if (name === 'home') renderHome();
  if (name === 'stages') renderStages();
  if (name === 'chars') renderChars();
  if (name === 'gacha') renderGacha();
  updateTop();
}

$$('#mainnav .nav-btn').forEach(b => b.onclick = () => { sfx('click'); showScreen(b.dataset.screen); });
$$('.menu-btn[data-goto]').forEach(b => b.onclick = () => { sfx('click'); showScreen(b.dataset.goto); });
$('#btn-mute').onclick = () => { G.muted = !G.muted; save(); updateTop(); };

/* ---------------- 首页 ---------------- */
function renderHome() {
  const fid = G.team[0] || Object.keys(G.chars)[0];
  const def = CHAR_MAP[fid];
  if (def) {
    $('#home-emoji').textContent = def.emoji;
    $('#home-emoji').style.background = `radial-gradient(circle at 35% 30%, hsl(${def.hue},60%,55%), hsl(${def.hue},55%,22%))`;
    $('#home-name').textContent = `${def.name} · ${def.title}`;
    $('#home-quote').textContent = `「${def.quote}」`;
  }
  $('#home-progress').textContent = `图鉴收集 ${Object.keys(G.chars).length}/${CHARS.length} ｜ 已通关 ${Object.keys(G.cleared).length}/12`;
}

$('#btn-help').onclick = () => {
  sfx('click');
  openModal(`
    <h2 class="modal-title">📖 玩法说明</h2>
    <div class="help-body">
      <p><b>◆ 战斗</b>：回合制战棋。速度决定出手顺序。每名器灵每回合可<b>移动1次 + 行动1次</b>（普攻 / 技能 / 绝技）。点击蓝色格子移动，点击红框敌人攻击。</p>
      <p><b>◆ 绝技</b>：攻击与受击会积攒能量，能量满100即可释放强力绝技。</p>
      <p><b>◆ 职业</b>：⚔️游锋近战爆发 ｜ 🛡️铁壁守护前排 ｜ 🏹神射远程输出 ｜ 🔮方术范围术法 ｜ 📿帷幄治疗增益。</p>
      <p><b>◆ 养成</b>：消耗📜古籍残页升级；重复获得的器灵会转化为「信物」，用于升星提升等级上限与属性。</p>
      <p><b>◆ 寻珍</b>：消耗💠玉璧寻访器灵。玉璧通过通关与升级获得。</p>
      <p><b>◆ 体力</b>：出战消耗体力，每5分钟恢复1点。败北或撤退不退还，请量力而行。</p>
    </div>
    <div class="modal-foot"><button class="btn" data-close>关闭</button></div>
  `);
};

/* ---------------- 出征 ---------------- */
function renderStages() {
  const tabs = $('#chapter-tabs');
  tabs.innerHTML = CHAPTERS.map(ch =>
    `<button class="ch-tab ${ch.id === G.chapter ? 'active' : ''}" data-ch="${ch.id}">${ch.name}</button>`).join('');
  tabs.querySelectorAll('.ch-tab').forEach(b => b.onclick = () => { sfx('click'); G.chapter = b.dataset.ch; save(); renderStages(); });

  const ch = CHAPTERS.find(c => c.id === G.chapter);
  const list = $('#stage-list');
  // 解锁规则：本章第一关，或上一关已通
  const allStages = CHAPTERS.flatMap(c => c.stages);
  list.innerHTML = ch.stages.map(s => {
    const idx = allStages.indexOf(s);
    const unlocked = idx === 0 || G.cleared[allStages[idx - 1].id];
    const cleared = !!G.cleared[s.id];
    const enemyEmojis = s.enemies.map(e => ENEMIES[e.t].emoji).join(' ');
    return `
      <div class="stage-card ${cleared ? 'cleared' : ''} ${unlocked ? '' : 'locked'}" data-stage="${unlocked ? s.id : ''}">
        <div class="stage-id">${s.id}</div>
        <div class="stage-name">${s.name}</div>
        <div class="stage-info">推荐 Lv.${s.lvl} ｜ ⚡${s.cost}</div>
        <div class="stage-enemies">${enemyEmojis}</div>
        <div class="stage-state">${cleared ? '✅ 已通关' : unlocked ? `首通 💠${s.first.huipo} 📜${s.first.books}` : '🔒 未解锁'}</div>
      </div>`;
  }).join('');
  list.querySelectorAll('.stage-card[data-stage]').forEach(c => {
    if (!c.dataset.stage) return;
    c.onclick = () => { sfx('click'); openPrep(c.dataset.stage); };
  });
}

/* 出战准备 */
function openPrep(stageId) {
  const { stage, chapter } = findStage(stageId);
  let picked = G.team.filter(id => G.chars[id]).slice(0, 4);
  if (!picked.length) picked = Object.keys(G.chars).slice(0, 1);

  function render() {
    const roster = Object.keys(G.chars)
      .map(id => ({ id, def: CHAR_MAP[id], st: G.chars[id] }))
      .sort((a, b) => rarityRank(b.def.rarity) - rarityRank(a.def.rarity) || b.st.lv - a.st.lv);
    openModal(`
      <h2 class="modal-title">${chapter.name} · ${stage.id} ${stage.name}</h2>
      <p class="prep-story">${stage.story}</p>
      <div class="prep-row">
        <span>推荐等级 <b>Lv.${stage.lvl}</b></span>
        <span>消耗 ⚡${stage.cost}</span>
        <span>${G.cleared[stage.id] ? `重复通关：💠${Math.round(stage.first.huipo / 4)} 📜×8` : `首通：💠${stage.first.huipo} 📜${stage.first.books}`}</span>
      </div>
      <div class="prep-enemies">
        ${stage.enemies.map(e => { const d = ENEMIES[e.t]; return `<span class="prep-enemy" title="${d.name}">${d.emoji}</span>`; }).join('')}
      </div>
      <h3 class="prep-sub">出战编队（${picked.length}/4，点击调整，按选择顺序入场）</h3>
      <div class="prep-roster">
        ${roster.map(r => {
          const selIdx = picked.indexOf(r.id);
          return `<div class="prep-char ${selIdx >= 0 ? 'sel' : ''} r-${r.def.rarity}" data-id="${r.id}">
            <div class="pc-emoji">${r.def.emoji}</div>
            <div class="pc-name">${r.def.name}</div>
            <div class="pc-lv">Lv.${r.st.lv} ★${r.st.star}</div>
            ${selIdx >= 0 ? `<div class="pc-order">${selIdx + 1}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
      <div class="modal-foot">
        <button class="btn" data-close>取消</button>
        <button class="btn btn-gold" id="btn-start" ${picked.length ? '' : 'disabled'}>出 战</button>
      </div>
    `);
    $('#modal-box').querySelectorAll('.prep-char').forEach(c => {
      c.onclick = () => {
        sfx('click');
        const id = c.dataset.id;
        const i = picked.indexOf(id);
        if (i >= 0) picked.splice(i, 1);
        else if (picked.length < 4) picked.push(id);
        else { toast('最多出战4名器灵'); return; }
        render();
      };
    });
    const startBtn = $('#btn-start');
    if (startBtn) startBtn.onclick = () => {
      if (!picked.length) return;
      if (G.stam < stage.cost) { toast('体力不足！'); return; }
      G.stam -= stage.cost;
      G.team = picked.slice();
      save();
      closeModal();
      sfx('click');
      showScreen('battle');
      startBattle(stage, chapter, picked, onBattleEnd);
    };
  }
  render();
}

function rarityRank(r) { return { SSR: 3, SR: 2, R: 1 }[r] || 0; }

/* 战斗结算 */
function onBattleEnd(result) {
  const { stage } = result;
  if (result.win) {
    const first = !G.cleared[stage.id];
    G.cleared[stage.id] = true;
    let huipo = Math.round(stage.first.huipo / 4), books = 8;
    if (first) { huipo = stage.first.huipo; books = stage.first.books; }
    G.huipo += huipo; G.books += books;
    G.axp += stage.acct;
    let lvups = 0;
    while (G.axp >= axpNeed()) { G.axp -= axpNeed(); G.lv++; lvups++; G.huipo += 60; G.stam = Math.min(stamCap(), G.stam + 20); }
    save();
    sfx('win');
    openModal(`
      <h2 class="modal-title" style="color:var(--gold2)">🏆 战斗胜利</h2>
      <div class="result-body">
        <p class="result-line">${first ? '首次通关！' : '通关！'}</p>
        <p>💠 玉璧 +${huipo}${lvups ? `（含升级奖励 +${lvups * 60}）` : ''}</p>
        <p>📜 古籍残页 +${books}</p>
        <p>✨ 馆长经验 +${stage.acct}${lvups ? `<br><b style="color:var(--gold2)">馆长等级提升至 Lv.${G.lv}！体力+20</b>` : ''}</p>
      </div>
      <div class="modal-foot"><button class="btn btn-gold" data-close>确 定</button></div>
    `, () => showScreen('stages'));
  } else {
    sfx('lose');
    openModal(`
      <h2 class="modal-title" style="color:#c05a4a">💔 战线崩溃</h2>
      <div class="result-body">
        <p>器灵们被迫撤退……强化编队后再来挑战吧。</p>
        <p style="color:#9a8a72;font-size:13px">提示：在「器灵」页用📜残页把出战角色升到推荐等级，胜率会大幅提升；残页可通过重复通关已解锁关卡获得。</p>
      </div>
      <div class="modal-foot"><button class="btn" data-close>返 回</button></div>
    `, () => showScreen('stages'));
  }
}

/* ---------------- 器灵 ---------------- */
function renderChars() {
  const grid = $('#char-grid');
  grid.innerHTML = CHARS.map(def => {
    const owned = G.chars[def.id];
    if (!owned) {
      return `<div class="char-card locked r-${def.rarity}">
        <div class="cc-emoji">${def.emoji}</div>
        <div class="cc-name">？？？</div>
        <div class="cc-sub">${RARITY_INFO[def.rarity].name} · ${def.cls}</div>
        <div class="cc-lock">未获得</div>
      </div>`;
    }
    const st = statsOf(def, owned.lv, owned.star);
    const inTeam = G.team.includes(def.id);
    return `<div class="char-card r-${def.rarity}" data-id="${def.id}">
      ${inTeam ? '<div class="cc-team">出战中</div>' : ''}
      <div class="cc-emoji" style="background:radial-gradient(circle at 35% 30%, hsl(${def.hue},60%,55%), hsl(${def.hue},55%,22%))">${def.emoji}</div>
      <div class="cc-name">${def.name}</div>
      <div class="cc-sub">${RARITY_INFO[def.rarity].name} · ${CLASS_INFO[def.cls].icon}${def.cls}</div>
      <div class="cc-lv">Lv.${owned.lv} <span class="cc-star">${'★'.repeat(owned.star)}</span></div>
    </div>`;
  }).join('');
  grid.querySelectorAll('.char-card[data-id]').forEach(c => c.onclick = () => { sfx('click'); openChar(c.dataset.id); });
}

function openChar(id) {
  const def = CHAR_MAP[id], st = G.chars[id];
  function render() {
    updateTop();
    const s = statsOf(def, st.lv, st.star);
    const cap = LV_CAP[st.star];
    const bookCost = BOOK_COST(st.lv);
    const starCost = STAR_COST[st.star];
    const inTeam = G.team.includes(id);
    openModal(`
      <div class="cd-head r-${def.rarity}">
        <div class="cd-emoji" style="background:radial-gradient(circle at 35% 30%, hsl(${def.hue},60%,55%), hsl(${def.hue},55%,22%))">${def.emoji}</div>
        <div>
          <div class="cd-name">${def.name} <small>「${def.title}」</small></div>
          <div class="cd-tags">
            <span class="tag" style="border-color:${RARITY_INFO[def.rarity].color};color:${RARITY_INFO[def.rarity].color}">${RARITY_INFO[def.rarity].name}</span>
            <span class="tag" style="border-color:${CLASS_INFO[def.cls].color};color:${CLASS_INFO[def.cls].color}">${CLASS_INFO[def.cls].icon} ${def.cls}</span>
            <span class="tag">${'★'.repeat(st.star)}</span>
          </div>
        </div>
      </div>
      <p class="cd-desc">${def.desc}</p>
      <div class="cd-stats">
        <div><small>生命</small><b>${s.hp}</b></div>
        <div><small>攻击</small><b>${s.atk}</b></div>
        <div><small>防御</small><b>${s.def}</b></div>
        <div><small>速度</small><b>${s.spd}</b></div>
        <div><small>移动</small><b>${s.mov}</b></div>
        <div><small>射程</small><b>${s.rng}</b></div>
      </div>
      <div class="cd-skills">
        <div class="cd-skill"><b>技能 · ${def.skill.name}</b><span>冷却${def.skill.cd}回合</span><p>${def.skill.desc}</p></div>
        <div class="cd-skill"><b>绝技 · ${def.ult.name}</b><span>能量100</span><p>${def.ult.desc}</p></div>
      </div>
      <div class="cd-actions">
        <button class="btn" id="cd-team">${inTeam ? '移出编队' : '加入编队'}</button>
        <button class="btn btn-gold" id="cd-lvup" ${st.lv >= cap || G.books < bookCost ? 'disabled' : ''}>
          升级 <small>Lv.${st.lv}→${st.lv + 1} 📜×${bookCost}</small>
        </button>
        <button class="btn btn-gold" id="cd-starup" ${st.star >= 5 || st.xin < starCost ? 'disabled' : ''}>
          升星 <small>信物 ${st.xin}/${starCost || '-'}</small>
        </button>
      </div>
      ${st.lv >= cap ? '<p class="cd-tip">已达当前星级等级上限，升星后可继续升级。</p>' : ''}
      <div class="modal-foot"><button class="btn" data-close>关闭</button></div>
    `);
    $('#cd-team').onclick = () => {
      sfx('click');
      const i = G.team.indexOf(id);
      if (i >= 0) G.team.splice(i, 1);
      else if (G.team.length < 4) G.team.push(id);
      else { toast('编队已满（4人）'); return; }
      save(); render();
    };
    const lvBtn = $('#cd-lvup');
    if (lvBtn && !lvBtn.disabled) lvBtn.onclick = () => {
      if (G.books < bookCost || st.lv >= cap) return;
      G.books -= bookCost; st.lv++;
      save(); sfx('buff'); toast(`${def.name} 升至 Lv.${st.lv}`); render();
    };
    const starBtn = $('#cd-starup');
    if (starBtn && !starBtn.disabled) starBtn.onclick = () => {
      if (st.star >= 5 || st.xin < starCost) return;
      st.xin -= starCost; st.star++;
      save(); sfx('gacha'); toast(`${def.name} 升至 ★${st.star}！`); render();
    };
  }
  render();
}

/* ---------------- 寻珍 ---------------- */
function renderGacha() {
  $('#gacha-pity').textContent = G.pity;
  $('#gacha-pool-list').innerHTML = ['SSR', 'SR', 'R'].map(r => `
    <div class="pool-row">
      <span class="pool-rarity" style="color:${RARITY_INFO[r].color}">${RARITY_INFO[r].name}</span>
      ${CHARS.filter(c => c.rarity === r).map(c =>
        `<span class="pool-char" title="${c.name}">${c.emoji}</span>`).join('')}
    </div>`).join('');
}

function rollRarity() {
  if (G.pity + 1 >= 70) return 'SSR';
  const r = Math.random();
  if (r < 0.02) return 'SSR';
  if (r < 0.20) return 'SR';
  return 'R';
}
function rollChar(rarity) {
  const pool = CHARS.filter(c => c.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}
function grantChar(id) {
  const def = CHAR_MAP[id];
  if (G.chars[id]) {
    const n = RARITY_INFO[def.rarity].dupXin;
    G.chars[id].xin += n;
    return { type: 'dupe', xin: n };
  }
  G.chars[id] = { lv: 1, star: 1, xin: 0 };
  return { type: 'new' };
}

async function doPull(n) {
  const cost = n * 150;
  if (G.huipo < cost) { toast('玉璧不足！通关关卡可获得玉璧。'); return; }
  G.huipo -= cost;
  const results = [];
  let hasSRplus = false;
  for (let i = 0; i < n; i++) {
    let r = rollRarity();
    if (r !== 'R') hasSRplus = true;
    results.push(r);
  }
  if (n === 10 && !hasSRplus) results[9] = 'SR'; // 十连保底
  const cards = results.map(r => {
    const def = rollChar(r);
    G.pulls++;
    if (r === 'SSR') G.pity = 0; else G.pity++;
    const grant = grantChar(def.id);
    return { def, grant };
  });
  save(); updateTop(); renderGacha();
  sfx('gacha');

  // 揭示动画
  const overlay = $('#gacha-overlay'), box = $('#gacha-cards');
  overlay.classList.remove('hidden');
  $('#gacha-tip').textContent = '点击跳过';
  box.innerHTML = cards.map(c => `
    <div class="gacha-card r-${c.def.rarity} back">
      <div class="gc-inner">
        <div class="gc-face gc-back">🏺</div>
        <div class="gc-face gc-front">
          <div class="gc-emoji" style="background:radial-gradient(circle at 35% 30%, hsl(${c.def.hue},60%,55%), hsl(${c.def.hue},55%,22%))">${c.def.emoji}</div>
          <div class="gc-name">${c.def.name}</div>
          <div class="gc-rarity">${RARITY_INFO[c.def.rarity].name}</div>
          <div class="gc-grant">${c.grant.type === 'new' ? '✨ NEW!' : `信物 +${c.grant.xin}`}</div>
        </div>
      </div>
    </div>`).join('');

  let skipped = false;
  const skip = () => { skipped = true; };
  overlay.onclick = () => {
    if (!done) { skipped = true; skip(); return; }
    overlay.classList.add('hidden');
    overlay.onclick = null;
  };
  let done = false;
  const els = box.querySelectorAll('.gacha-card');
  for (let i = 0; i < els.length; i++) {
    if (skipped) { els.forEach(e => e.classList.remove('back')); break; }
    els[i].classList.remove('back');
    if (cards[i].def.rarity === 'SSR') { sfx('ult'); els[i].classList.add('shine'); }
    else sfx('click');
    await sleep(260);
  }
  done = true;
  $('#gacha-tip').textContent = '点击任意处继续';
}

$('#btn-pull1').onclick = () => doPull(1);
$('#btn-pull10').onclick = () => doPull(10);

/* ---------------- 启动 ---------------- */
document.addEventListener('click', () => { if (AC && AC.state === 'suspended') AC.resume(); }, { once: true });
setInterval(updateTop, 5000);
updateTop();
showScreen('home');
