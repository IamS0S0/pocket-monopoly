import { createGameState } from './state.js';
import { createBoard, TILE_TYPES } from '../data/boards.js';
import { rollDice, movementPath } from './dice.js';
import { createProperties, buyProperty, upgradeProperty, collectRent, MAX_PROPERTY_LEVEL } from './property.js';

export class TurnEngine {
  constructor(config, random = Math.random) {
    this.state = createGameState(config);
    this.state.phase = 'awaiting-roll';
    this.board = createBoard(config.mapId);
    this.state.properties = createProperties(this.board);
    this.state.upgradedThisTurn = [];
    this.state.offer = null;
    this.state.debt = null;
    this.random = random;
    this.serial = 0;
    this.action = null;
    this.state.logs = ['地产系统已就绪：可购买、收租和升级。事件、破产及 AI 自动行动将在后续阶段接入。'];
  }

  snapshot() { return structuredClone({ ...this.state, revision: this.serial }); }
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
    this.state.landing = { ...tile, description: tile.type === 'start' ? '回到起点，旅程继续。' : `这是${TILE_TYPES[tile.type].name}格。特殊事件规则将在第④阶段接入。` };
    this.state.phase = 'awaiting-end';
    this.log(`${player.name}抵达第 ${tile.index + 1} 格「${tile.name}」。`);
    this.action = null;
    if (tile.type === 'property') this.resolveProperty(tile, player);
    return true;
  }

  resolveProperty(tile, player) {
    const property = this.state.properties[tile.id];
    if (!property.ownerId) {
      this.state.phase = 'awaiting-property';
      this.state.offer = { token: ++this.serial, propertyId: tile.id, playerId: player.id };
      this.state.landing.description = `无主地产，售价 ${property.price} 金币。请选择购买或放弃。`;
    } else if (property.ownerId === player.id) {
      this.state.landing.description = '欢迎回到自己的地产。可在地契界面升级，每块地产每个自己的回合最多升级一次。';
    } else {
      const result = collectRent(this.state, tile.id, player.id);
      if (result.ok) {
        this.state.landing.description = `自动向${result.ownerName}支付租金 ${result.amount} 金币。`;
        this.log(`${player.name}向${result.ownerName}支付 ${result.amount} 金币租金。`);
      } else {
        this.state.debt = result.debt ?? null;
        this.state.phase = 'awaiting-payment';
        this.state.landing.description = `${result.message}。第④阶段接入变卖与破产后可继续处理；本次请返回大厅。`;
        this.log(this.state.landing.description);
      }
    }
  }

  decideProperty(token, choice) {
    const offer = this.state.offer;
    if (this.state.phase !== 'awaiting-property' || !offer || token !== offer.token || !['buy', 'skip'].includes(choice)) return { ok: false, message: '该购买请求已经失效' };
    const player = this.state.players[this.state.currentPlayerIndex];
    if (player.id !== offer.playerId) return { ok: false, message: '不是当前玩家的购买请求' };
    const property = this.state.properties[offer.propertyId];
    if (choice === 'buy') {
      const result = buyProperty(this.state, property.id, player.id);
      if (!result.ok) return result;
      this.state.landing.description = `已花费 ${property.price} 金币购入「${property.name}」。可在地契界面升级。`;
      this.log(`${player.name}购买「${property.name}」，支付 ${property.price} 金币。`);
    } else {
      this.state.landing.description = '已放弃购买，地产仍保持无主状态。';
      this.log(`${player.name}放弃购买「${property.name}」。`);
    }
    this.state.offer = null;
    this.state.phase = 'awaiting-end';
    return { ok: true };
  }

  upgrade(propertyId, expectedRevision) {
    // 安全阶段和版本号双重校验，防止旧窗口操作下一位玩家的资产。
    if (!['awaiting-roll', 'awaiting-end'].includes(this.state.phase) || expectedRevision !== this.serial) return { ok: false, message: '当前阶段不能升级，请重新打开地契' };
    if (this.state.upgradedThisTurn.includes(propertyId)) return { ok: false, message: '这块地产本回合已经升级过' };
    const player = this.state.players[this.state.currentPlayerIndex];
    const result = upgradeProperty(this.state, propertyId, player.id);
    if (!result.ok) return result;
    this.state.upgradedThisTurn.push(propertyId);
    this.serial++;
    const property = this.state.properties[propertyId];
    this.log(`${player.name}花费 ${result.amount} 金币，将「${property.name}」升级至 ${property.level}/${MAX_PROPERTY_LEVEL} 级。`);
    return result;
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
    this.serial++;
    this.state.upgradedThisTurn = [];
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
