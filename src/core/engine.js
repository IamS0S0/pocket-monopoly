import { createGameState } from './state.js';
import { createBoard, TILE_TYPES } from '../data/boards.js';
import { rollDice, movementPath } from './dice.js';

export class TurnEngine {
  constructor(config, random = Math.random) {
    this.state = createGameState(config);
    this.state.phase = 'awaiting-roll';
    this.board = createBoard(config.mapId);
    this.random = random;
    this.serial = 0;
    this.action = null;
    this.state.logs = ['棋盘已就绪。地产、事件与 AI 自动行动将在后续阶段接入。'];
  }

  snapshot() { return structuredClone(this.state); }
  log(message) { this.state.logs.unshift(message); this.state.logs.length = Math.min(this.state.logs.length, 60); }

  beginRoll() {
    if (this.state.phase !== 'awaiting-roll') return null;
    const value = rollDice(this.random);
    const player = this.state.players[this.state.currentPlayerIndex];
    this.action = { token: ++this.serial, playerIndex: this.state.currentPlayerIndex, value,
      path: movementPath(player.position, value, this.board.length), cursor: 0, origin: player.position };
    this.state.phase = 'rolling';
    this.state.diceValue = value;
    this.log(`${player.name}掷出 ${value} 点。`);
    return structuredClone(this.action);
  }

  beginMovement(token) {
    if (!this.valid(token, 'rolling')) return false;
    this.state.phase = 'moving';
    return true;
  }

  valid(token, phase) { return this.action?.token === token && this.state.phase === phase; }

  completeStep(token, position) {
    if (!this.valid(token, 'moving') || this.action.path[this.action.cursor] !== position) return false;
    const player = this.state.players[this.action.playerIndex];
    player.position = position;
    this.action.cursor++;
    if (position === 0) this.log(`${player.name}经过起点（奖励规则待后续接入）。`);
    return true;
  }

  land(token) {
    if (!this.valid(token, 'moving') || this.action.cursor !== this.action.path.length) return false;
    const player = this.state.players[this.action.playerIndex];
    const tile = this.board[player.position];
    this.state.landing = { ...tile, description: tile.type === 'start' ? '回到起点，旅程继续。' : `这是${TILE_TYPES[tile.type].name}格。本阶段展示落点，具体规则将在地产与事件阶段接入。` };
    this.state.phase = 'awaiting-end';
    this.log(`${player.name}抵达第 ${tile.index + 1} 格「${tile.name}」。`);
    this.action = null;
    return true;
  }

  endTurn() {
    if (this.state.phase !== 'awaiting-end') return false;
    const next = this.state.currentPlayerIndex + 1;
    if (next === this.state.players.length && this.state.round >= this.state.roundLimit) {
      this.state.phase = 'finished';
      this.log('已达到回合上限，本次移动演示结束。资产排名将在后续阶段接入。');
      return true;
    }
    this.state.currentPlayerIndex = next % this.state.players.length;
    if (next === this.state.players.length) this.state.round++;
    this.state.phase = 'awaiting-roll';
    this.state.landing = null;
    this.state.diceValue = null;
    return true;
  }

  // 动画异常时回滚本次位置，解除操作锁；不会留下半个回合。
  recover(token) {
    if (!this.action || this.action.token !== token || this.state.phase === 'disposed') return false;
    this.state.players[this.action.playerIndex].position = this.action.origin;
    this.action = null;
    this.serial++;
    this.state.phase = 'awaiting-roll';
    this.log('动画未能完成，位置已恢复，请重新掷骰。');
    return true;
  }

  dispose() { this.serial++; this.action = null; this.state.phase = 'disposed'; }
}
