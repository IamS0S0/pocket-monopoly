import { validateConfig } from './config.js';

// 规则状态与 Three.js 完全分离；后续引擎通过状态驱动 UI 和动画。
export function createGameState(config) {
  validateConfig(config);
  return {
    phase: 'ready', mapId: config.mapId, roundLimit: config.roundLimit,
    round: 1, currentPlayerIndex: 0,
    players: config.players.map(player => ({ ...player, coins: 1500, position: 0, bankrupt: false, skippedTurns: 0 })),
    properties: {}, logs: ['旅行队伍已集结，等待进入棋盘。'],
  };
}
