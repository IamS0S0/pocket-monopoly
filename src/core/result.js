import { totalAssets } from './property.js';

export function rankPlayers(state) {
  const rows = state.players.map(p => ({ id: p.id, name: p.name, coins: p.coins,
    assets: totalAssets(state, p.id), bankrupt: p.bankrupt }));
  rows.sort((a, b) => Number(a.bankrupt) - Number(b.bankrupt) || b.assets - a.assets);
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    row.rank = previous && row.assets === previous.assets && row.bankrupt === previous.bankrupt ? previous.rank : index + 1;
  });
  return rows;
}
