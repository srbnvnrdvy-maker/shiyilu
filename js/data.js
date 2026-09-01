'use strict';
/* ================= 《拾遗录》数据定义 =================
 * 文物拟人战棋：角色 / 敌人 / 章节关卡
 * ================================================== */

const CLASS_INFO = {
  '游锋': { icon: '⚔️', color: '#c0392b', desc: '近战爆发，机动灵活' },
  '铁壁': { icon: '🛡️', color: '#8e7cc3', desc: '前排壁垒，守护同伴' },
  '神射': { icon: '🏹', color: '#b7950b', desc: '远程射手，百步穿杨' },
  '方术': { icon: '🔮', color: '#5b7fa6', desc: '术法攻击，范围伤害' },
  '帷幄': { icon: '📿', color: '#5e9c7f', desc: '治疗增益，掌控全局' },
};

const RARITY_INFO = {
  SSR: { name: '特出', color: '#e05244', dupXin: 10 },
  SR:  { name: '优异', color: '#d8a83c', dupXin: 5 },
  R:   { name: '常见', color: '#8fa3b8', dupXin: 2 },
};

/* ---------- 角色（器灵） ----------
 * base: 1级1星基础面板
 * skill/ult.effects: 效果数组，引擎按序执行
 *   {t:'dmg', mult, aoe?, rider?, condBonus?}  伤害（mult 倍攻击）
 *   {t:'heal', mult} / {t:'healMaxPct', pct}   治疗
 *   {t:'shield', maxHpPct, turns}              护盾
 *   {t:'buff', stat, pct?|flat?, turns}        增益/减益
 *   {t:'energy', amt}                          充能
 *   {t:'dash'}                                 冲到目标身边
 * 效果可带 who 覆盖目标: 'target'|'self'|'allAllies'|'allEnemies'|'selfAoeEnemies'|'lowestAlly'
 */
const CHARS = [
  {
    id: 'yuewang', name: '越王勾践剑', title: '卧薪尝胆', rarity: 'SSR', cls: '游锋',
    emoji: '🗡️', hue: 4,
    desc: '春秋越国青铜剑，深埋两千余年仍寒光逼人、锋利如初，被誉为「天下第一剑」。',
    quote: '卧薪尝胆二十年，只为一朝雪耻。',
    base: { hp: 880, atk: 135, def: 48, spd: 110, mov: 4, rng: 1 },
    skill: { name: '尝胆', cd: 3, target: 'self', desc: '攻击+35%，持续2回合，并获得15点能量。',
      effects: [ {t:'buff', stat:'atk', pct:.35, turns:2, who:'self'}, {t:'energy', amt:15, who:'self'} ] },
    ult: { name: '鸠浅之誓', target: 'enemy', desc: '对单体造成320%攻击的伤害；目标生命低于50%时伤害额外+40%。',
      uline: '三千越甲——可吞吴！',
      effects: [ {t:'dmg', mult:3.2, condBonus:{ hpBelow:.5, add:.4 }} ] },
  },
  {
    id: 'jinou', name: '金瓯永固杯', title: '山河永固', rarity: 'SSR', cls: '铁壁',
    emoji: '🏆', hue: 43,
    desc: '清乾隆金嵌珠石金瓯永固杯，皇帝元旦开笔仪式御用，寓意疆土完整、江山永固。',
    quote: '金瓯无缺，山河永固。',
    base: { hp: 1480, atk: 85, def: 92, spd: 88, mov: 3, rng: 1 },
    skill: { name: '山河永固', cd: 3, target: 'allAllies', desc: '全体友方获得相当于各自最大生命12%的护盾，持续2回合。',
      effects: [ {t:'shield', maxHpPct:.12, turns:2, who:'allAllies'} ] },
    ult: { name: '万年疆土', target: 'allAllies', desc: '全体友方获得22%最大生命的护盾，且防御+30%，持续2回合。',
      uline: '愿此杯中山河，万世永固。',
      effects: [ {t:'shield', maxHpPct:.22, turns:2, who:'allAllies'}, {t:'buff', stat:'def', pct:.3, turns:2, who:'allAllies'} ] },
  },
  {
    id: 'bianzhong', name: '曾侯乙编钟', title: '黄钟大吕', rarity: 'SSR', cls: '方术',
    emoji: '🔔', hue: 205,
    desc: '战国早期大型礼乐重器，一钟双音，音域跨五个八度，改写了世界音乐史。',
    quote: '你听，两千四百年前的声音。',
    base: { hp: 800, atk: 142, def: 40, spd: 96, mov: 3, rng: 2 },
    skill: { name: '黄钟大吕', cd: 2, target: 'enemy', desc: '对目标及周围1格的敌人造成180%攻击的伤害。',
      effects: [ {t:'dmg', mult:1.8, aoe:1} ] },
    ult: { name: '千古绝响', target: 'allEnemies', desc: '对全体敌人造成260%攻击的伤害，并使其攻击-20%，持续2回合。',
      uline: '黄钟大吕，千古绝响！',
      effects: [ {t:'dmg', mult:2.6, who:'allEnemies'}, {t:'buff', stat:'atk', pct:-.2, turns:2, who:'allEnemies'} ] },
  },
  {
    id: 'qianli', name: '千里江山图', title: '只此青绿', rarity: 'SSR', cls: '帷幄',
    emoji: '🖼️', hue: 160,
    desc: '北宋王希孟十八岁所作青绿山水长卷，峰峦叠翠，气象万千，中国十大传世名画之一。',
    quote: '江山千里，只此青绿。',
    base: { hp: 850, atk: 112, def: 45, spd: 100, mov: 3, rng: 2 },
    skill: { name: '青绿山水', cd: 2, target: 'ally', desc: '治疗一名友方220%攻击的生命，并使其攻击+20%，持续2回合。',
      effects: [ {t:'heal', mult:2.2, who:'target'}, {t:'buff', stat:'atk', pct:.2, turns:2, who:'target'} ] },
    ult: { name: '只此青绿', target: 'allAllies', desc: '治疗全体友方180%攻击的生命，并使其速度+15%，持续2回合。',
      uline: '展卷——千里江山，只此青绿。',
      effects: [ {t:'heal', mult:1.8, who:'allAllies'}, {t:'buff', stat:'spd', pct:.15, turns:2, who:'allAllies'} ] },
  },
  {
    id: 'changxin', name: '长信宫灯', title: '长明不熄', rarity: 'SR', cls: '帷幄',
    emoji: '🏮', hue: 35,
    desc: '西汉鎏金铜灯，宫女执灯而坐，烟灰可纳入袖中，堪称两千年前的「环保设计」。',
    quote: '愿以一灯之明，照你前路。',
    base: { hp: 800, atk: 102, def: 42, spd: 104, mov: 3, rng: 2 },
    skill: { name: '光明普照', cd: 2, target: 'lowestAlly', desc: '治疗生命比例最低的友方，恢复260%攻击的生命。',
      effects: [ {t:'heal', mult:2.6, who:'lowestAlly'} ] },
    ult: { name: '长明不熄', target: 'allAllies', desc: '治疗全体友方220%攻击的生命，并获得10%最大生命的护盾。',
      uline: '长明之灯，永不熄灭。',
      effects: [ {t:'heal', mult:2.2, who:'allAllies'}, {t:'shield', maxHpPct:.1, turns:2, who:'allAllies'} ] },
  },
  {
    id: 'matayan', name: '马踏飞燕', title: '追风逐影', rarity: 'SR', cls: '游锋',
    emoji: '🐎', hue: 28,
    desc: '东汉铜奔马，三足腾空，一足轻点飞鸟，是力学与艺术完美结合的奇迹。',
    quote: '风，追不上我。',
    base: { hp: 780, atk: 126, def: 40, spd: 126, mov: 5, rng: 1 },
    skill: { name: '天马行空', cd: 2, target: 'self', desc: '本回合移动力+2、攻击+25%。',
      effects: [ {t:'buff', stat:'mov', flat:2, turns:1, who:'self'}, {t:'buff', stat:'atk', pct:.25, turns:1, who:'self'} ] },
    ult: { name: '燕影逐风', target: 'enemy', desc: '冲至目标身边，造成280%攻击的伤害。',
      uline: '踏燕——追风！',
      effects: [ {t:'dash'}, {t:'dmg', mult:2.8} ] },
  },
  {
    id: 'fuhao', name: '妇好鸮尊', title: '战神鸮鸣', rarity: 'SR', cls: '游锋',
    emoji: '🦉', hue: 262,
    desc: '商代青铜酒器，为女战神妇好所铸，鸮（猫头鹰）形威严神秘。',
    quote: '鸮鸣之处，战无不胜。',
    base: { hp: 960, atk: 122, def: 55, spd: 98, mov: 4, rng: 1 },
    skill: { name: '鸮鸣', cd: 2, target: 'enemy', desc: '造成150%攻击的伤害，并使目标攻击-25%，持续2回合。',
      effects: [ {t:'dmg', mult:1.5, rider:{t:'buff', stat:'atk', pct:-.25, turns:2}} ] },
    ult: { name: '战神之怒', target: 'self', desc: '自身攻击+40%持续2回合，并对周围1格所有敌人造成200%攻击的伤害。',
      uline: '战神的怒火，鸮鸣为号！',
      effects: [ {t:'buff', stat:'atk', pct:.4, turns:2, who:'self'}, {t:'dmg', mult:2.0, who:'selfAoeEnemies'} ] },
  },
  {
    id: 'siyang', name: '四羊方尊', title: '四方之祀', rarity: 'SR', cls: '铁壁',
    emoji: '🐏', hue: 220,
    desc: '商代青铜重器，四羊卷角、通体繁缛，代表商代青铜铸造工艺的巅峰。',
    quote: '四方之羊，佑祀千秋。',
    base: { hp: 1360, atk: 90, def: 86, spd: 85, mov: 3, rng: 1 },
    skill: { name: '四方守护', cd: 3, target: 'self', desc: '自身防御+50%持续2回合，并获得15%最大生命的护盾。',
      effects: [ {t:'buff', stat:'def', pct:.5, turns:2, who:'self'}, {t:'shield', maxHpPct:.15, turns:2, who:'self'} ] },
    ult: { name: '羊尊之祀', target: 'allAllies', desc: '全体友方获得18%最大生命的护盾，自身恢复30%最大生命。',
      uline: '四羊衔瑞，镇守四方。',
      effects: [ {t:'shield', maxHpPct:.18, turns:2, who:'allAllies'}, {t:'healMaxPct', pct:.3, who:'self'} ] },
  },
  {
    id: 'qingming', name: '清明上河图', title: '汴京繁华', rarity: 'SR', cls: '方术',
    emoji: '🌉', hue: 90,
    desc: '北宋张择端所作长卷，汴河两岸车水马龙，一卷尽收东京繁华。',
    quote: '桥上人来人往，皆是人间烟火。',
    base: { hp: 780, atk: 132, def: 40, spd: 94, mov: 3, rng: 2 },
    skill: { name: '汴河烟雨', cd: 2, target: 'enemy', desc: '对目标及周围1格敌人造成160%攻击的伤害，并使其速度-20%，持续2回合。',
      effects: [ {t:'dmg', mult:1.6, aoe:1, rider:{t:'buff', stat:'spd', pct:-.2, turns:2}} ] },
    ult: { name: '繁华如梦', target: 'allEnemies', desc: '对全体敌人造成220%攻击的伤害，并使其速度-25%，持续2回合。',
      uline: '汴河两岸，繁华入梦。',
      effects: [ {t:'dmg', mult:2.2, who:'allEnemies', rider:{t:'buff', stat:'spd', pct:-.25, turns:2}} ] },
  },
  {
    id: 'shuochang', name: '击鼓说唱俑', title: '俳优登场', rarity: 'R', cls: '神射',
    emoji: '🥁', hue: 15,
    desc: '东汉陶俑，袒腹击鼓、眉飞色舞，是两千年前的「说唱艺人」。',
    quote: '诸位看官，且听我一言！',
    base: { hp: 750, atk: 116, def: 38, spd: 106, mov: 3, rng: 3 },
    skill: { name: '俳优戏', cd: 2, target: 'enemy', desc: '造成170%攻击的伤害，自身获得10点能量。',
      effects: [ {t:'dmg', mult:1.7}, {t:'energy', amt:10, who:'self'} ] },
    ult: { name: '开场锣鼓', target: 'allEnemies', desc: '对全体敌人造成180%攻击的伤害，全体友方获得10点能量。',
      uline: '锣鼓开场，好戏登台！',
      effects: [ {t:'dmg', mult:1.8, who:'allEnemies'}, {t:'energy', amt:10, who:'allAllies'} ] },
  },
  {
    id: 'renmian', name: '人面鱼纹盆', title: '远古凝视', rarity: 'R', cls: '方术',
    emoji: '🏺', hue: 18,
    desc: '新石器时代仰韶文化彩陶，人面鱼纹神秘悠远，是六千年前的凝视。',
    quote: '六千年前的凝视，你读懂了吗？',
    base: { hp: 720, atk: 122, def: 35, spd: 92, mov: 3, rng: 2 },
    skill: { name: '鱼纹之力', cd: 2, target: 'enemy', desc: '造成190%攻击的伤害。',
      effects: [ {t:'dmg', mult:1.9} ] },
    ult: { name: '远古图腾', target: 'enemy', desc: '对目标及周围1格敌人造成230%攻击的伤害。',
      uline: '图腾——苏醒。',
      effects: [ {t:'dmg', mult:2.3, aoe:1} ] },
  },
  {
    id: 'guishe', name: '跪射武士俑', title: '万弩齐发', rarity: 'R', cls: '神射',
    emoji: '🧍', hue: 100,
    desc: '秦陵兵马俑之一，跪姿持弩、整装待发，已静静守候了两千年。',
    quote: '弩已上弦，静候将令。',
    base: { hp: 760, atk: 120, def: 40, spd: 100, mov: 3, rng: 3 },
    skill: { name: '连弩齐发', cd: 2, target: 'enemy', desc: '连续射击2次，每次造成90%攻击的伤害。',
      effects: [ {t:'dmg', mult:.9}, {t:'dmg', mult:.9} ] },
    ult: { name: '万箭', target: 'enemy', desc: '蓄力一箭，造成300%攻击的伤害。',
      uline: '万箭——齐发！',
      effects: [ {t:'dmg', mult:3.0} ] },
  },
];

const CHAR_MAP = Object.fromEntries(CHARS.map(c => [c.id, c]));

/* ---------- 敌人（魇） ---------- */
const ENEMIES = {
  youyan: { name: '游魇', emoji: '👺', cls: '游锋', hue: 280,
    base: { hp: 700, atk: 100, def: 40, spd: 100, mov: 4, rng: 1 },
    skill: { name: '撕裂', cd: 2, target: 'enemy', effects: [ {t:'dmg', mult:1.5} ] } },
  dunyan: { name: '盾魇', emoji: '🗿', cls: '铁壁', hue: 260,
    base: { hp: 1200, atk: 78, def: 76, spd: 80, mov: 3, rng: 1 },
    skill: { name: '硬壳', cd: 3, target: 'self', effects: [ {t:'shield', maxHpPct:.2, turns:2, who:'self'} ] } },
  gongyan: { name: '弓魇', emoji: '👾', cls: '神射', hue: 290,
    base: { hp: 620, atk: 112, def: 30, spd: 95, mov: 3, rng: 3 },
    skill: { name: '贯穿箭', cd: 3, target: 'enemy', effects: [ {t:'dmg', mult:1.8} ] } },
  wuyan: { name: '魇巫', emoji: '🧿', cls: '方术', hue: 300,
    base: { hp: 660, atk: 122, def: 35, spd: 90, mov: 3, rng: 2 },
    skill: { name: '蚀魂雾', cd: 3, target: 'enemy', effects: [ {t:'dmg', mult:1.5, aoe:1} ] } },
  yuyan: { name: '愈魇', emoji: '🎭', cls: '帷幄', hue: 320, healAI: true,
    base: { hp: 700, atk: 82, def: 40, spd: 95, mov: 3, rng: 2 },
    skill: { name: '缝合', cd: 2, target: 'lowestAlly', effects: [ {t:'heal', mult:2.4, who:'lowestAlly'} ] } },
  taotie: { name: '饕餮魇', emoji: '👹', cls: '铁壁', hue: 350, boss: true,
    base: { hp: 2600, atk: 108, def: 56, spd: 88, mov: 3, rng: 1 },
    skill: { name: '吞食天地', cd: 3, target: 'allEnemies', effects: [ {t:'dmg', mult:1.6, who:'allEnemies'} ] } },
  zhulong: { name: '烛龙魇', emoji: '🐉', cls: '方术', hue: 15, boss: true,
    base: { hp: 3200, atk: 130, def: 74, spd: 102, mov: 3, rng: 2 },
    skill: { name: '幽冥龙焰', cd: 2, target: 'enemy', effects: [ {t:'dmg', mult:1.9, aoe:1} ] } },
};

/* ---------- 关卡 ----------
 * map: '#'障碍 '.'地面 'A'己方出生点 'e'/'B'敌方出生点（按阅读顺序对应 enemies）
 */
const CHAPTERS = [
  {
    id: 'c1', name: '第一章 · 青铜之醒', deco: '🏺',
    stages: [
      { id: '1-1', name: '子夜苏醒', lvl: 1, mul: 0.95, cost: 10,
        story: '子夜，博物馆闭馆。青铜的锈色之下，有什么东西——睁开了眼。',
        map: [
          '........',
          '.A.....e',
          '.A......',
          '.A.....e',
          '.A......',
          '........',
        ],
        enemies: [ {t:'youyan'}, {t:'youyan'} ],
        first: { huipo: 100, books: 8 }, acct: 20 },
      { id: '1-2', name: '锈迹之下', lvl: 2, mul: 1.0, cost: 10,
        story: '被「魇」侵蚀的碎片在展厅游荡。器灵们决定出手。',
        map: [
          '.........',
          '.A..#...e',
          '.A.......',
          '.A..#..e.',
          '.A......e',
          '.........',
        ],
        enemies: [ {t:'youyan'}, {t:'youyan'}, {t:'gongyan'} ],
        first: { huipo: 100, books: 8 }, acct: 22 },
      { id: '1-3', name: '回廊魅影', lvl: 4, mul: 1.05, cost: 10,
        story: '回廊尽头的影子动了起来——它们，想夺走文物的「记忆」。',
        map: [
          '.........',
          '.A....#..',
          '.A.e....e',
          '.A....#..',
          '.A.e....e',
          '.........',
        ],
        enemies: [ {t:'youyan'}, {t:'gongyan'}, {t:'youyan'}, {t:'wuyan'} ],
        first: { huipo: 100, books: 9 }, acct: 24 },
      { id: '1-4', name: '坚壳', lvl: 6, mul: 1.1, cost: 10,
        story: '石化的巨影挡在库房门前。硬碰硬，或者——智取。',
        map: [
          '.........',
          '.A.#....e',
          '.A....#..',
          '.A..e...e',
          '.A.#....e',
          '.........',
        ],
        enemies: [ {t:'dunyan'}, {t:'youyan'}, {t:'gongyan'}, {t:'yuyan'} ],
        first: { huipo: 100, books: 9 }, acct: 26 },
      { id: '1-5', name: '缝合之声', lvl: 8, mul: 1.15, cost: 10,
        story: '魇群之中，有东西在修补它们的伤口。先解决那个「医者」。',
        map: [
          '.........',
          '.A....#..',
          '.A.e....e',
          '.A.#....e',
          '.A.e..#..',
          '....e....',
        ],
        enemies: [ {t:'youyan'}, {t:'wuyan'}, {t:'youyan'}, {t:'gongyan'}, {t:'yuyan'} ],
        first: { huipo: 100, books: 10 }, acct: 28 },
      { id: '1-6', name: '青铜之王', lvl: 10, mul: 1.2, cost: 12,
        story: '库房最深处，贪食之魇张开了巨口——它想把整座博物馆吞下去。',
        map: [
          '.........',
          '.A...B...',
          '.A..#..e.',
          '.A.......',
          '.A..#..e.',
          '.........',
        ],
        enemies: [ {t:'taotie'}, {t:'dunyan'}, {t:'wuyan'} ],
        first: { huipo: 200, books: 15 }, acct: 35 },
    ],
  },
  {
    id: 'c2', name: '第二章 · 玉帛之路', deco: '🪨',
    stages: [
      { id: '2-1', name: '玉门之外', lvl: 13, mul: 1.28, cost: 12,
        story: '追随着魇的踪迹，器灵们来到丝路故道。风沙里全是低语。',
        map: [
          '.........',
          '.A......e',
          '.A..##...',
          '.A......e',
          '.A..#...e',
          '.........',
        ],
        enemies: [ {t:'youyan'}, {t:'gongyan'}, {t:'wuyan'} ],
        first: { huipo: 120, books: 10 }, acct: 30 },
      { id: '2-2', name: '驼铃幽响', lvl: 15, mul: 1.35, cost: 12,
        story: '驼铃声自千年前传来，只是这一次，铃声里混着杂音。',
        map: [
          '.........',
          '.A.e....e',
          '.A.......',
          '.A.#..#..',
          '.A.e....e',
          '....e....',
        ],
        enemies: [ {t:'youyan'}, {t:'gongyan'}, {t:'youyan'}, {t:'wuyan'}, {t:'yuyan'} ],
        first: { huipo: 120, books: 10 }, acct: 32 },
      { id: '2-3', name: '沙海遗珍', lvl: 17, mul: 1.42, cost: 12,
        story: '流沙之下埋着无数遗珍。不能让它们落入魇手。',
        map: [
          '.........',
          '.A..#...e',
          '.A....e..',
          '.A.#....e',
          '.A....e..',
          '....#...e',
        ],
        enemies: [ {t:'gongyan'}, {t:'youyan'}, {t:'wuyan'}, {t:'youyan'}, {t:'gongyan'} ],
        first: { huipo: 120, books: 11 }, acct: 34 },
      { id: '2-4', name: '石窟低语', lvl: 19, mul: 1.5, cost: 12,
        story: '石窟壁画上的飞天闭上了眼。低语声，越来越响了。',
        map: [
          '.........',
          '.A...#..e',
          '.A.e.....',
          '.A.....#.',
          '.A.e....e',
          '......e..',
        ],
        enemies: [ {t:'dunyan'}, {t:'youyan'}, {t:'wuyan'}, {t:'youyan'}, {t:'yuyan'} ],
        first: { huipo: 120, books: 11 }, acct: 36 },
      { id: '2-5', name: '烽燧残烟', lvl: 21, mul: 1.6, cost: 12,
        story: '古烽火台的残烟未散。魇群在此集结——决战在即。',
        map: [
          '.........',
          '.A.e...#e',
          '.A....e..',
          '.A.#.....',
          '.A.e...#e',
          '.....e...',
        ],
        enemies: [ {t:'youyan'}, {t:'wuyan'}, {t:'youyan'}, {t:'youyan'}, {t:'wuyan'}, {t:'yuyan'} ],
        first: { huipo: 120, books: 12 }, acct: 38 },
      { id: '2-6', name: '烛照幽冥', lvl: 24, mul: 1.72, cost: 15,
        story: '钟山之神，睁眼为昼、闭目为夜。被蚀的烛龙，正要把世界拖入永夜。',
        map: [
          '.........',
          '.A....B..',
          '.A..#....',
          '.A.....e.',
          '.A..#....',
          '....e...e',
        ],
        enemies: [ {t:'zhulong'}, {t:'wuyan'}, {t:'youyan'}, {t:'gongyan'} ],
        first: { huipo: 240, books: 18 }, acct: 45 },
    ],
  },
];

function findStage(stageId) {
  for (const ch of CHAPTERS) {
    const s = ch.stages.find(s => s.id === stageId);
    if (s) return { stage: s, chapter: ch };
  }
  return null;
}

/* ---------- 数值成长 ---------- */
const LV_CAP = [0, 20, 30, 40, 50, 60];          // 各星级等级上限
const STAR_COST = { 1: 10, 2: 20, 3: 30, 4: 40 }; // 升星所需信物
const BOOK_COST = lv => Math.ceil(lv * 0.4);      // 升1级所需古籍残页

function statsOf(def, lv, star) {
  const m = (1 + 0.05 * (lv - 1)) * (1 + 0.12 * (star - 1));
  const b = def.base;
  return {
    hp: Math.round(b.hp * m), atk: Math.round(b.atk * m), def: Math.round(b.def * m),
    spd: b.spd, mov: b.mov, rng: b.rng,
  };
}

function enemyStatsOf(def, mul) {
  const b = def.base;
  return {
    hp: Math.round(b.hp * mul), atk: Math.round(b.atk * mul), def: Math.round(b.def * mul),
    spd: b.spd, mov: b.mov, rng: b.rng,
  };
}
