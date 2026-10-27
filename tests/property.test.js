import test from 'node:test';
import assert from 'node:assert/strict';
import { TurnEngine } from '../src/core/engine.js';
import { createDefaultConfig } from '../src/core/config.js';
import { buyProperty, upgradeProperty, collectRent, currentRent, totalAssets } from '../src/core/property.js';

function create() { return new TurnEngine(createDefaultConfig(), () => 0); }
function move(engine) {
  const action = engine.beginRoll();
  engine.beginMovement(action.token);
  action.path.forEach(position => engine.completeStep(action.token, position));
  engine.land(action.token);
  return action;
}
function buy(engine) {
  move(engine);
  return engine.decideProperty(engine.state.offer.token, 'buy');
}

test('三张地图仅地产有产权，每张新局的产权独立', () => {
  for (const mapId of ['city', 'forest', 'space']) {
    const engine = new TurnEngine({ ...createDefaultConfig(), mapId });
    assert.equal(Object.keys(engine.state.properties).length, engine.board.filter(tile => tile.type === 'property').length);
    for (const property of Object.values(engine.state.properties)) {
      assert.equal(property.ownerId, null); assert.equal(property.level, 0);
      assert.ok(property.rents.every((rent, level, rents) => Number.isInteger(rent) && (level === 0 || rent > rents[level - 1])));
    }
  }
  const first = create(), second = create(); buy(first);
  assert.equal(second.state.properties['city-1'].ownerId, null);
});

test('购买扣款与产权一致，重复点击不重复扣款', () => {
  const engine = create(); move(engine);
  const token = engine.state.offer.token;
  assert.equal(engine.endTurn(), false);
  assert.equal(engine.beginRoll(), null);
  assert.equal(engine.decideProperty(token, 'buy').ok, true);
  assert.equal(engine.state.players[0].coins, 1280);
  assert.equal(engine.state.properties['city-1'].ownerId, 'player-1');
  assert.equal(engine.decideProperty(token, 'buy').ok, false);
  assert.equal(engine.state.players[0].coins, 1280);
  assert.equal(totalAssets(engine.state, 'player-1'), 1500);
});

test('资金刚好可购买，差一金币不扣款且仍可放弃', () => {
  for (const coins of [220, 219]) {
    const engine = create(); engine.state.players[0].coins = coins; move(engine);
    const result = engine.decideProperty(engine.state.offer.token, 'buy');
    assert.equal(result.ok, coins === 220);
    assert.equal(engine.state.players[0].coins, coins === 220 ? 0 : 219);
    if (!result.ok) {
      assert.equal(engine.state.properties['city-1'].ownerId, null);
      assert.equal(engine.decideProperty(engine.state.offer.token, 'skip').ok, true);
      assert.equal(engine.state.phase, 'awaiting-end');
    }
  }
});

test('放弃后另一位玩家仍可购买，旧购买令牌不能串回合', () => {
  const engine = create(); move(engine); const old = engine.state.offer.token;
  engine.decideProperty(old, 'skip'); engine.endTurn(); move(engine);
  assert.equal(engine.decideProperty(old, 'buy').ok, false);
  assert.equal(engine.decideProperty(engine.state.offer.token, 'buy').ok, true);
  assert.equal(engine.state.properties['city-1'].ownerId, 'player-2');
});

test('落到他人地产只付一次租金，租金转账守恒', () => {
  const engine = create(); buy(engine); engine.endTurn();
  const action = move(engine);
  assert.equal(engine.state.players[0].coins, 1313);
  assert.equal(engine.state.players[1].coins, 1467);
  assert.equal(engine.state.players[0].coins + engine.state.players[1].coins, 2780);
  assert.equal(engine.land(action.token), false);
  assert.equal(engine.state.players[1].coins, 1467);
});

test('自己地产不收租，无主地产不收租', () => {
  const engine = create();
  assert.equal(collectRent(engine.state, 'city-1', 'player-1').amount, 0);
  buy(engine);
  assert.equal(collectRent(engine.state, 'city-1', 'player-1').amount, 0);
  assert.equal(engine.state.players[0].coins, 1280);
});

test('升级收费、租金提升、每地每回合一次且禁止越权', () => {
  const engine = create(); buy(engine);
  const revision = engine.snapshot().revision;
  assert.equal(engine.upgrade('city-1', revision).ok, true);
  assert.equal(engine.state.players[0].coins, 1148);
  assert.equal(currentRent(engine.state.properties['city-1']), 66);
  assert.equal(totalAssets(engine.state, 'player-1'), 1500);
  assert.equal(engine.upgrade('city-1', engine.snapshot().revision).ok, false);
  engine.endTurn();
  assert.equal(engine.upgrade('city-1', revision).ok, false);
  assert.equal(engine.upgrade('city-1', engine.snapshot().revision).ok, false);
  move(engine);
  assert.equal(engine.state.players[1].coins, 1434);
  engine.endTurn();
  assert.equal(engine.upgrade('city-1', engine.snapshot().revision).ok, true);
});

test('升级金额边界与最高等级，失败不修改资产', () => {
  const engine = create(); buy(engine);
  engine.state.players[0].coins = 131;
  assert.equal(upgradeProperty(engine.state, 'city-1', 'player-1').ok, false);
  assert.equal(engine.state.players[0].coins, 131);
  engine.state.players[0].coins = 132;
  assert.equal(upgradeProperty(engine.state, 'city-1', 'player-1').ok, true);
  assert.equal(engine.state.players[0].coins, 0);
  engine.state.players[0].coins = 1000;
  upgradeProperty(engine.state, 'city-1', 'player-1'); upgradeProperty(engine.state, 'city-1', 'player-1');
  const before = JSON.stringify(engine.state);
  assert.equal(upgradeProperty(engine.state, 'city-1', 'player-1').ok, false);
  assert.equal(JSON.stringify(engine.state), before);
});

test('租金刚好可支付，不足则保留债务并停止推进', () => {
  for (const cash of [33, 32]) {
    const engine = create(); buy(engine); engine.endTurn();
    engine.state.players[1].coins = cash; move(engine);
    if (cash === 33) {
      assert.equal(engine.state.players[1].coins, 0);
      assert.equal(engine.state.phase, 'awaiting-end');
    } else {
      assert.equal(engine.state.players[1].coins, 32);
      assert.equal(engine.state.players[0].coins, 1280);
      assert.equal(engine.state.phase, 'awaiting-payment');
      assert.equal(engine.state.debt.amount, 33);
      assert.equal(engine.endTurn(), false); assert.equal(engine.beginRoll(), null);
    }
  }
});

test('无效地产、破产玩家和动画中升级被拒绝', () => {
  const engine = create();
  assert.equal(buyProperty(engine.state, 'city-0', 'player-1').ok, false);
  engine.state.players[1].bankrupt = true;
  assert.equal(buyProperty(engine.state, 'city-1', 'player-2').ok, false);
  buy(engine); engine.endTurn(); engine.endTurn();
  engine.beginRoll();
  assert.equal(engine.upgrade('city-1', engine.snapshot().revision).ok, false);
  engine.dispose();
  assert.equal(engine.decideProperty(1, 'buy').ok, false);
});
