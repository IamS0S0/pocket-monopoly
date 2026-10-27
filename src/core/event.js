const EVENTS = [
  { title: '社区嘉奖', kind: 'money', amount: 200, text: '热心帮助邻居，获得 200 金币。' },
  { title: '临时维修', kind: 'money', amount: -180, text: '旅行装备需要维修，支付 180 金币。' },
  { title: '悠闲假日', kind: 'skip', text: '好好休息一下，暂停下一次自己的回合。' },
  { title: '幸运传送门', kind: 'teleport', text: '传送到下一块地产，并正常处理购买或租金；传送不领取起点奖励。' },
];
const CHANCES = [
  { title: '幸运奖金', kind: 'money', amount: 300, text: '抽中旅行大奖，获得 300 金币。' },
  { title: '旅行账单', kind: 'money', amount: -120, text: '支付旅行账单 120 金币。' },
  EVENTS[3], EVENTS[2],
];

export function drawEvent(type, random = Math.random) {
  const deck = type === 'chance' ? CHANCES : EVENTS;
  // 随机源异常使用固定事件兜底，避免落格后陷入无法继续的状态。
  let value;
  try { value = random(); } catch { value = 0; }
  if (!Number.isFinite(value) || value < 0 || value >= 1) value = 0;
  return { ...deck[Math.floor(value * deck.length)] };
}
