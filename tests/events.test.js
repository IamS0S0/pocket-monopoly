import test from 'node:test';
import assert from 'node:assert/strict';
import { TurnEngine } from '../src/core/engine.js';
import { createDefaultConfig, setPlayerCount } from '../src/core/config.js';
import { settlePayment, saleValue } from '../src/core/bankrupt.js';
import { drawEvent } from '../src/core/event.js';
import { rankPlayers } from '../src/core/result.js';

const create = (eventRandom = () => 0, count = 2) => new TurnEngine(setPlayerCount(createDefaultConfig(), count), () => 0, eventRandom);
function landAt(engine, index) {
  engine.state.players[engine.state.currentPlayerIndex].position = (index - 1 + engine.board.length) % engine.board.length;
  const action = engine.beginRoll(); engine.beginMovement(action.token);
  action.path.forEach(position => engine.completeStep(action.token, position));
  assert.equal(engine.land(action.token), true);
  return action;
}
function resolve(engine) {
  while (engine.state.notice) engine.acknowledge(engine.state.notice.token);
  if (engine.state.offer) engine.decideProperty(engine.state.offer.token, 'skip');
}

test('自动变卖按低价值优先、筹够停止，归还银行并清除等级', () => {
  const engine = create(), state = engine.state, player = state.players[0];
  player.coins = 0;
  state.properties['city-1'].ownerId = player.id;
  state.properties['city-2'].ownerId = player.id;
  state.properties['city-2'].level = 2;
  const result = settlePayment(state, player.id, 100, state.players[1].id);
  assert.equal(result.sold.length, 1); assert.equal(result.paid, 100);
  assert.equal(player.coins, 10); assert.equal(player.bankrupt, false);
  assert.equal(state.players[1].coins, 1600);
  assert.equal(state.properties['city-1'].ownerId, null);
  assert.equal(state.properties['city-2'].ownerId, player.id);
  assert.equal(saleValue(state.properties['city-2']), 286);
});

test('全部变卖后不足：债权人只收到实际款项，玩家无负数且无残留产权', () => {
  const engine = create(), state = engine.state, player = state.players[0];
  player.coins = 10; state.properties['city-1'].ownerId = player.id; state.properties['city-1'].level = 1;
  const result = settlePayment(state, player.id, 500, state.players[1].id);
  assert.equal(result.paid, 186); assert.equal(result.unpaid, 314);
  assert.equal(player.coins, 0); assert.equal(player.bankrupt, true);
  assert.equal(state.players[1].coins, 1686);
  assert.equal(state.properties['city-1'].level, 0); assert.equal(state.properties['city-1'].ownerId, null);
  const before = JSON.stringify(state);
  assert.throws(() => settlePayment(state, player.id, 1));
  assert.equal(JSON.stringify(state), before);
});

test('支付无效金额或债权人时没有任何副作用；现金为零不自动破产', () => {
  const state = create().state, before = JSON.stringify(state);
  for (const amount of [-1, NaN, 1.1, Infinity]) assert.throws(() => settlePayment(state, 'player-1', amount));
  assert.throws(() => settlePayment(state, 'player-1', 1, 'missing'));
  assert.throws(() => settlePayment(state, 'player-1', 1, 'player-1'));
  assert.equal(JSON.stringify(state), before);
  settlePayment(state, 'player-1', 1500);
  assert.equal(state.players[0].bankrupt, false);
});

test('随机事件与机会包含四类效果，异常随机数兜底', () => {
  for (const type of ['event', 'chance']) {
    const cards = [0, .25, .5, .75].map(value => drawEvent(type, () => value));
    assert.equal(cards.filter(card => card.kind === 'money').length, 2);
    assert.ok(cards.some(card => card.kind === 'skip'));
    assert.ok(cards.some(card => card.kind === 'teleport'));
  }
  assert.equal(drawEvent('event', () => NaN).amount, 200);
  assert.equal(drawEvent('event', () => { throw new Error(); }).amount, 200);
});

test('事件确认防重复，奖励只发一次，通知未确认不能推进', () => {
  const engine = create(); landAt(engine, 3);
  const token = engine.state.notice.token;
  assert.equal(engine.state.players[0].coins, 1700);
  assert.equal(engine.beginRoll(), null); assert.equal(engine.endTurn(), false);
  assert.equal(engine.acknowledge(token + 1), false);
  assert.equal(engine.acknowledge(token), true); assert.equal(engine.acknowledge(token), false);
  assert.equal(engine.state.players[0].coins, 1700);
});

test('传送后处理目的地产，确认一次只传送一次且不额外奖励起点', () => {
  const engine = create(() => .75); landAt(engine, 3);
  const token = engine.state.notice.token;
  engine.acknowledge(token);
  assert.equal(engine.state.players[0].position, 4);
  assert.equal(engine.state.phase, 'awaiting-property');
  assert.equal(engine.state.offer.propertyId, 'city-4');
  assert.equal(engine.state.players[0].coins, 1500);
  assert.equal(engine.acknowledge(token), false);
});

test('传送目的地租金不足可破产，确认通知后立即结束双人局', () => {
  const engine = create(() => .75); engine.state.players[0].coins = 1;
  engine.state.properties['city-4'].ownerId = 'player-2';
  landAt(engine, 3); engine.acknowledge(engine.state.notice.token);
  assert.equal(engine.state.players[0].bankrupt, true);
  assert.equal(engine.state.phase, 'awaiting-event');
  engine.acknowledge(engine.state.notice.token);
  assert.equal(engine.state.phase, 'finished');
  assert.equal(engine.state.results.ranking[0].id, 'player-2');
  assert.equal(engine.beginRoll(), null);
});

test('税收和负面事件均通过变卖清偿处理', () => {
  for (const [tile, due] of [[12, 150], [3, 180], [9, 120]]) {
    const engine = create(() => .25); landAt(engine, tile);
    assert.equal(engine.state.players[0].coins, 1500 - due);
    resolve(engine); assert.equal(engine.state.phase, 'awaiting-end');
  }
});

test('监狱和休息事件跳过下一次本人回合后自动恢复', () => {
  for (const tile of [6, 3]) {
    const engine = create(() => .5); landAt(engine, tile); resolve(engine);
    assert.equal(engine.state.players[0].skippedTurns, 1);
    engine.endTurn(); landAt(engine, 1); resolve(engine); engine.endTurn();
    assert.equal(engine.state.currentPlayerIndex, 1); assert.equal(engine.state.round, 2);
    assert.equal(engine.state.players[0].skippedTurns, 0);
    landAt(engine, 1); resolve(engine); engine.endTurn();
    assert.equal(engine.state.currentPlayerIndex, 0); assert.equal(engine.state.round, 3);
  }
});

test('三人局破产退场后其他玩家继续，破产座位后续跳过', () => {
  const engine = create(() => 0, 3); engine.state.players[0].coins = 1;
  landAt(engine, 12); resolve(engine); engine.endTurn();
  assert.equal(engine.state.currentPlayerIndex, 1);
  landAt(engine, 1); resolve(engine); engine.endTurn();
  landAt(engine, 1); resolve(engine); engine.endTurn();
  assert.equal(engine.state.currentPlayerIndex, 1); assert.equal(engine.state.round, 2);
});

test('跨起点中断不重复领取奖励，结束和销毁后旧事件令牌无效', () => {
  const engine = create(); engine.state.players[0].position = 23;
  const action = engine.beginRoll(); engine.beginMovement(action.token); engine.completeStep(action.token, 0);
  engine.recover(action.token); assert.equal(engine.state.players[0].coins, 1500);
  assert.equal(engine.state.players[0].position, 23);
  landAt(engine, 3); const token = engine.state.notice.token; engine.dispose();
  assert.equal(engine.acknowledge(token), false);
});

test('资产排名计入升级投入，同资产并列；存活玩家优先于破产玩家', () => {
  const engine = create(() => 0, 3), state = engine.state;
  state.players[0].coins = 1280; state.properties['city-1'].ownerId = 'player-1';
  assert.deepEqual(rankPlayers(state).map(p => p.rank), [1, 1, 1]);
  state.players[0].coins = 0; state.properties['city-1'].ownerId = null; state.players[0].bankrupt = true;
  state.players[1].coins = 0;
  assert.deepEqual(rankPlayers(state).map(p => p.id), ['player-3', 'player-2', 'player-1']);
});

test('三张地图、2–4人完整规则局到达结算且不出现负数或悬空产权', () => {
  for (const mapId of ['city', 'forest', 'space']) for (const count of [2, 3, 4]) {
    const config = setPlayerCount(createDefaultConfig(), count); config.mapId = mapId; config.roundLimit = 5;
    let seed = 731;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const engine = new TurnEngine(config, random, random);
    let turns = 0;
    while (engine.state.phase !== 'finished' && turns++ < 100) {
      const action = engine.beginRoll(); assert.ok(action); engine.beginMovement(action.token);
      action.path.forEach(position => engine.completeStep(action.token, position)); engine.land(action.token);
      while (engine.state.notice) engine.acknowledge(engine.state.notice.token);
      if (engine.state.offer) {
        const result = engine.decideProperty(engine.state.offer.token, 'buy');
        if (!result.ok) engine.decideProperty(engine.state.offer.token, 'skip');
      }
      if (engine.state.phase !== 'finished') assert.equal(engine.endTurn(), true);
      assert.ok(engine.state.players.every(p => p.coins >= 0));
      assert.ok(Object.values(engine.state.properties).every(p => !p.ownerId || engine.state.players.some(player => player.id === p.ownerId && !player.bankrupt)));
    }
    assert.equal(engine.state.phase, 'finished'); assert.ok(turns < 100);
    assert.equal(engine.state.results.ranking.length, count);
  }
});

test('所有存活玩家都暂停时不会死循环，跨越上限直接结算', () => {
  const engine = create();
  engine.state.round = engine.state.roundLimit;
  engine.state.currentPlayerIndex = 1;
  engine.state.phase = 'awaiting-end';
  engine.state.players.forEach(p => { p.skippedTurns = 1; });
  assert.equal(engine.endTurn(), true);
  assert.equal(engine.state.phase, 'finished');
  assert.equal(engine.state.round, engine.state.roundLimit);
  assert.equal(engine.endTurn(), false);
});
