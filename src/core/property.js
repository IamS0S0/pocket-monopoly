export const MAX_PROPERTY_LEVEL = 3;

// 所有金额使用整数金币，各级租金由同一份数据驱动 UI 和规则。
export function propertyTerms(tile) {
  if (!tile || tile.type !== 'property') throw new Error('该格不是地产');
  const price = 180 + (tile.index % 5) * 40;
  const upgradeCost = Math.round(price * 0.6);
  const baseRent = Math.round(price * 0.15);
  return { price, upgradeCost, rents: [1, 2, 4, 7].map(factor => baseRent * factor) };
}

export function createProperties(board) {
  return Object.fromEntries(board.filter(tile => tile.type === 'property').map(tile => [tile.id, {
    id: tile.id, index: tile.index, name: tile.name, ownerId: null, level: 0, ...propertyTerms(tile),
  }]));
}

export function currentRent(property) { return property.rents[property.level]; }
export function propertyValue(property) { return property.price + property.level * property.upgradeCost; }
export function totalAssets(state, playerId) {
  const player = state.players.find(item => item.id === playerId);
  if (!player) throw new Error('玩家不存在');
  return player.coins + Object.values(state.properties).filter(item => item.ownerId === playerId).reduce((total, item) => total + propertyValue(item), 0);
}

function transactionContext(state, propertyId, playerId) {
  const property = state.properties[propertyId];
  const player = state.players.find(item => item.id === playerId);
  if (!property || !player || player.bankrupt) return null;
  return { property, player };
}

// 先检查再修改；失败时不能留下扣款或产权变更。
export function buyProperty(state, propertyId, playerId) {
  const context = transactionContext(state, propertyId, playerId);
  if (!context) return { ok: false, message: '地产或玩家无效' };
  const { property, player } = context;
  if (property.ownerId !== null) return { ok: false, message: '地产已有主人' };
  if (player.coins < property.price) return { ok: false, message: '金币不足，无法购买' };
  player.coins -= property.price;
  property.ownerId = player.id;
  return { ok: true, amount: property.price };
}

export function upgradeProperty(state, propertyId, playerId) {
  const context = transactionContext(state, propertyId, playerId);
  if (!context) return { ok: false, message: '地产或玩家无效' };
  const { property, player } = context;
  if (property.ownerId !== playerId) return { ok: false, message: '只能升级自己的地产' };
  if (property.level >= MAX_PROPERTY_LEVEL) return { ok: false, message: '房屋已达到最高等级' };
  if (player.coins < property.upgradeCost) return { ok: false, message: '金币不足，无法升级' };
  player.coins -= property.upgradeCost;
  property.level++;
  return { ok: true, amount: property.upgradeCost };
}

export function collectRent(state, propertyId, visitorId) {
  const context = transactionContext(state, propertyId, visitorId);
  if (!context) return { ok: false, message: '地产或玩家无效' };
  const { property, player } = context;
  if (!property.ownerId || property.ownerId === visitorId) return { ok: true, amount: 0 };
  const owner = state.players.find(item => item.id === property.ownerId && !item.bankrupt);
  if (!owner) return { ok: false, message: '地产所有者无效' };
  const amount = currentRent(property);
  if (player.coins < amount) {
    // 返回完整债务，由引擎交给变卖清偿模块处理。
    return { ok: false, debt: { propertyId, payerId: player.id, creditorId: owner.id, amount }, message: '金币不足以支付租金' };
  }
  player.coins -= amount;
  owner.coins += amount;
  return { ok: true, amount, ownerName: owner.name };
}
