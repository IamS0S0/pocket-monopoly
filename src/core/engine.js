import { createGameState } from './state.js';
import { createBoard } from '../data/boards.js';
import { rollDice, movementPath } from './dice.js';
import { createProperties, buyProperty, upgradeProperty, collectRent, MAX_PROPERTY_LEVEL } from './property.js';

import { settlePayment } from './bankrupt.js';
import { drawEvent } from './event.js';
import { rankPlayers } from './result.js';

export class TurnEngine {
  constructor(config, random = Math.random, eventRandom = Math.random) {
    this.state = createGameState(config);
    this.state.phase = 'awaiting-roll';
    this.board = createBoard(config.mapId);
    this.state.properties = createProperties(this.board);
    this.state.upgradedThisTurn = [];
    this.state.offer = null;
    this.state.debt = null;
    this.random = random;
    this.eventRandom = eventRandom;
    this.state.notice = null;
    this.state.results = null;
    this.serial = 0;
    this.action = null;
    this.state.logs = ['旅行开始！经过起点奖励 200 金币；欠款时自动半价变卖房产，仍不足则破产。'];
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

    return true;
  }

  land(token) {
    if (!this.valid(token, 'moving') || this.action.cursor !== this.action.path.length) return false;
    const player = this.state.players[this.action.playerIndex];
    if (this.action.path.includes(0)) { player.coins += 200; this.log(`${player.name}经过起点，获得 200 金币。`); }
    const tile = this.board[player.position];
    this.state.landing = { ...tile, description: '回到起点，旅程继续。' };
    this.state.phase = 'awaiting-end';
    this.log(`${player.name}抵达第 ${tile.index + 1} 格「${tile.name}」。`);
    this.action = null;
    this.resolveTile(tile, player);
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
        const debt = result.debt;
        this.pay(player, debt.amount, debt.creditorId, '租金清偿');
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

  notify(title, text, destination = null) {
    this.state.notice = { token: ++this.serial, title, text, destination };
    this.state.phase = 'awaiting-event';
    this.state.landing.description = text;
    this.log(text);
  }

  pay(player, amount, creditorId = null, title = '支付账单') {
    const result = settlePayment(this.state, player.id, amount, creditorId);
    const sales = result.sold.map(p => `变卖「${p.name}」回收 ${p.value} 金币`).join('；');
    const text = `${player.name}应付 ${amount}，实付 ${result.paid} 金币。${sales ? sales + '。' : ''}${result.bankrupt ? `变卖后仍欠 ${result.unpaid} 金币，宣告破产并退场，余债核销。` : '支付完成。'}`;
    this.notify(title, text);
  }

  resolveTile(tile, player) {
    if (tile.type === 'property') return this.resolveProperty(tile, player);
    if (tile.type === 'tax') return this.pay(player, 150, null, '城市税收');
    if (tile.type === 'jail') {
      player.skippedTurns = 1;
      return this.notify('暂住监狱', `${player.name}暂停下一次自己的回合，之后自动恢复。`);
    }
    if (!['event', 'chance'].includes(tile.type)) return;
    const event = drawEvent(tile.type, this.eventRandom);
    if (event.kind === 'money' && event.amount < 0) return this.pay(player, -event.amount, null, event.title);
    if (event.kind === 'money') player.coins += event.amount;
    if (event.kind === 'skip') player.skippedTurns = 1;
    let destination = null;
    if (event.kind === 'teleport') {
      // 只传送到地产，不递归抽事件，防止传送链无限循环。
      for (let step = 1; step <= this.board.length; step++) {
        const index = (player.position + step) % this.board.length;
        if (this.board[index].type === 'property') { destination = index; break; }
      }
    }
    this.notify(event.title, `${player.name}：${event.text}`, destination);
  }

  acknowledge(token) {
    const notice = this.state.notice;
    if (this.state.phase !== 'awaiting-event' || notice?.token !== token) return false;
    this.state.notice = null;
    this.serial++;
    this.state.phase = 'awaiting-end';
    if (this.checkSurvivor()) return true;
    if (notice.destination !== null) {
      const player = this.state.players[this.state.currentPlayerIndex];
      player.position = notice.destination;
      const tile = this.board[player.position];
      this.state.landing = { ...tile, description: '传送抵达地产。' };
      this.log(`${player.name}传送到「${tile.name}」。`);
      this.resolveProperty(tile, player);
    }
    return true;
  }

  finish(reason) {
    this.serial++;
    this.action = null;
    this.state.offer = null;
    this.state.phase = 'finished';
    this.state.results = { reason, ranking: rankPlayers(this.state) };
    this.log(reason);
  }

  checkSurvivor() {
    if (this.state.players.filter(p => !p.bankrupt).length <= 1) {
      this.finish('仅剩一名玩家，旅行结束！'); return true;
    }
    return false;
  }

  endTurn() {
    if (this.state.phase !== 'awaiting-end') return false;
    if (this.checkSurvivor()) return true;
    // 每经过最后一个座位算一轮；破产座位不行动，暂停次数仅在轮到本人时消耗。
    while (true) {
      const next = (this.state.currentPlayerIndex + 1) % this.state.players.length;
      if (next === 0) {
        if (this.state.round >= this.state.roundLimit) {
          this.finish('达到回合上限，按总资产结算。'); return true;
        }
        this.state.round++;
      }
      this.state.currentPlayerIndex = next;
      const player = this.state.players[next];
      if (player.bankrupt) continue;
      if (player.skippedTurns > 0) {
        player.skippedTurns--;
        this.log(`${player.name}暂停本次回合，之后恢复行动。`);
        continue;
      }
      break;
    }
    this.serial++;
    this.state.upgradedThisTurn = [];
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
