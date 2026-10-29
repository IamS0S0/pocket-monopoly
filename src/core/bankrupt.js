import { propertyValue } from './property.js';

export const saleValue = property => Math.floor(propertyValue(property) / 2);

// 银行按账面价值一半回收；优先变卖价值最低的地产，筹够即停止。
export function settlePayment(state, payerId, amount, creditorId = null) {
  const payer = state.players.find(p => p.id === payerId && !p.bankrupt);
  const creditor = creditorId === null ? null : state.players.find(p => p.id === creditorId && !p.bankrupt);
  if (!payer || !Number.isSafeInteger(amount) || amount < 0 || (creditorId !== null && (!creditor || creditor === payer))) throw new Error('支付参数无效');
  const owned = Object.values(state.properties).filter(p => p.ownerId === payerId)
    .sort((a, b) => saleValue(a) - saleValue(b) || a.index - b.index);
  const sold = [];
  for (const property of owned) {
    if (payer.coins >= amount) break;
    const value = saleValue(property);
    sold.push({ name: property.name, value });
    payer.coins += value; property.ownerId = null; property.level = 0;
  }
  const paid = Math.min(payer.coins, amount);
  payer.coins -= paid;
  if (creditor) creditor.coins += paid;
  if (paid < amount) { payer.bankrupt = true; payer.skippedTurns = 0; }
  return { paid, amount, unpaid: amount - paid, sold, bankrupt: payer.bankrupt };
}
