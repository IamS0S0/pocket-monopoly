import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultConfig, setPlayerCount } from '../src/core/config.js';
import { createBoard, TILE_TYPES } from '../src/data/boards.js';
import { rollDice, movementPath } from '../src/core/dice.js';
import { TurnEngine } from '../src/core/engine.js';
import { diceOrientation, DICE_FACES, DICE_NORMALS } from '../src/render/dice.js';
import { Vector3 } from 'three';

function finishMove(engine) {
  const action = engine.beginRoll();
  assert.ok(action);
  assert.equal(engine.beginMovement(action.token), true);
  for (const position of action.path) assert.equal(engine.completeStep(action.token, position), true);
  assert.equal(engine.land(action.token), true);
  return action;
}

test('三种棋盘类型完整、位置唯一且相邻步距合理', () => {
  for (const [mapId, length] of [['city', 24], ['forest', 20], ['space', 18]]) {
    const board = createBoard(mapId);
    assert.equal(board.length, length);
    assert.equal(new Set(board.map(tile => tile.id)).size, length);
    assert.equal(new Set(board.map(tile => `${tile.x},${tile.z}`)).size, length);
    assert.deepEqual([...new Set(board.map(tile => tile.type))].sort(), Object.keys(TILE_TYPES).sort());
    board.forEach((tile, index) => {
      const next = board[(index + 1) % length];
      const distance = Math.hypot(next.x - tile.x, next.z - tile.z);
      assert.ok(distance >= 1 && distance < 1.3);
      assert.equal(tile.index, index);
    });
  }
  assert.throws(() => createBoard('unknown'));
});

test('骰子随机数边界与跨起点路径', () => {
  assert.equal(rollDice(() => 0), 1);
  assert.equal(rollDice(() => 0.9999), 6);
  for (const bad of [-1, 1, NaN, Infinity]) assert.throws(() => rollDice(() => bad));
  assert.deepEqual(movementPath(22, 4, 24), [23, 0, 1, 2]);
  assert.throws(() => movementPath(24, 1, 24));
  assert.throws(() => movementPath(0, 7, 24));
});

test('骰子六种结果对应的面最终朝上', () => {
  DICE_FACES.forEach((value, index) => {
    const normal = new Vector3(...DICE_NORMALS[index]).applyQuaternion(diceOrientation(value));
    assert.ok(normal.distanceTo(new Vector3(0, 1, 0)) < 1e-10);
  });
});

test('连掷、越步、提前落格、重复结束都被拒绝', () => {
  const engine = new TurnEngine(createDefaultConfig(), () => 0.5);
  const action = engine.beginRoll();
  assert.equal(engine.beginRoll(), null);
  assert.equal(engine.endTurn(), false);
  assert.equal(engine.completeStep(action.token, 1), false);
  assert.equal(engine.beginMovement(action.token), true);
  assert.equal(engine.beginMovement(action.token), false);
  assert.equal(engine.completeStep(action.token, 2), false);
  assert.equal(engine.land(action.token), false);
  action.path.forEach(position => assert.equal(engine.completeStep(action.token, position), true));
  assert.equal(engine.land(action.token), true);
  assert.equal(engine.land(action.token), false);
  assert.equal(engine.endTurn(), true);
  assert.equal(engine.endTurn(), false);
  assert.equal(engine.state.currentPlayerIndex, 1);
  assert.equal(engine.state.round, 1);
});

test('跨起点只更新位置，当前阶段不擅自改变金币', () => {
  const engine = new TurnEngine(createDefaultConfig(), () => 0.5);
  engine.state.players[0].position = 22;
  finishMove(engine);
  assert.equal(engine.state.players[0].position, 2);
  assert.equal(engine.state.players[0].coins, 1500);
  assert.ok(engine.state.logs.some(message => message.includes('经过起点')));
});

test('动画中断回滚，旧令牌无法改变新动作', () => {
  const engine = new TurnEngine(createDefaultConfig(), () => 0.5);
  const action = engine.beginRoll();
  engine.beginMovement(action.token); engine.completeStep(action.token, 1);
  assert.equal(engine.recover(action.token), true);
  assert.equal(engine.state.players[0].position, 0);
  const next = engine.beginRoll();
  assert.notEqual(next.token, action.token);
  assert.equal(engine.beginMovement(action.token), false);
  engine.dispose();
  assert.equal(engine.beginMovement(next.token), false);
  assert.equal(engine.beginRoll(), null);
});

test('2–4 人完成五轮后停止，不多走一轮', () => {
  for (const count of [2, 3, 4]) {
    const config = setPlayerCount(createDefaultConfig(), count);
    config.roundLimit = 5;
    const engine = new TurnEngine(config, () => 0.999);
    for (let round = 1; round <= 5; round++) {
      for (let index = 0; index < count; index++) {
        assert.equal(engine.state.round, round);
        assert.equal(engine.state.currentPlayerIndex, index);
        finishMove(engine); assert.equal(engine.endTurn(), true);
      }
    }
    assert.equal(engine.state.phase, 'finished');
    assert.equal(engine.beginRoll(), null);
    assert.equal(engine.endTurn(), false);
    assert.ok(engine.state.players.every(player => player.position === 6));
  }
});

test('状态快照独立；随机源异常不锁死回合', () => {
  const engine = new TurnEngine(createDefaultConfig(), () => NaN);
  const state = engine.snapshot(); state.players[0].coins = 0;
  assert.equal(engine.state.players[0].coins, 1500);
  assert.throws(() => engine.beginRoll());
  assert.equal(engine.state.phase, 'awaiting-roll');
});
