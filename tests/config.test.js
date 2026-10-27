import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultConfig, validateConfig, setPlayerCount, selectCharacter } from '../src/core/config.js';
import { createGameState } from '../src/core/state.js';

test('默认配置为两人、都市和三十回合', () => {
  const config = createDefaultConfig();
  assert.equal(validateConfig(config), true);
  assert.equal(config.players.length, 2);
  assert.equal(config.roundLimit, 30);
  assert.equal(config.mapId, 'city');
});

test('人数增减后保留已有设置，并保证角色唯一', () => {
  const config = createDefaultConfig();
  config.players[0].type = 'ai';
  const four = setPlayerCount(config, 4);
  assert.equal(four.players[0].type, 'ai');
  assert.equal(new Set(four.players.map(player => player.characterId)).size, 4);
  assert.equal(validateConfig(four), true);
  assert.equal(setPlayerCount(four, 2).players.length, 2);
  assert.equal(config.players.length, 2);
  assert.throws(() => setPlayerCount(config, 5));
});

test('交换已占用角色不会造成重复，也不修改原配置', () => {
  const config = createDefaultConfig();
  const next = selectCharacter(config, 0, 'sprout');
  assert.equal(next.players[0].characterId, 'sprout');
  assert.equal(next.players[1].characterId, 'sunny');
  assert.equal(config.players[0].characterId, 'sunny');
  assert.equal(validateConfig(next), true);
});

test('回合上下界有效，非法值被拒绝', () => {
  for (const limit of [5, 30, 100]) assert.equal(validateConfig({ ...createDefaultConfig(), roundLimit: limit }), true);
  for (const limit of [0, 4, 101, 5.5, NaN, Infinity, '30']) assert.throws(() => validateConfig({ ...createDefaultConfig(), roundLimit: limit }));
});

test('拒绝未知地图、角色、控制方式以及重复身份', () => {
  assert.throws(() => validateConfig({ ...createDefaultConfig(), mapId: 'unknown' }));
  assert.throws(() => validateConfig(null));
  for (const [key, value] of [['characterId', 'unknown'], ['type', 'remote'], ['id', 'player-2'], ['name', '']]) {
    const config = createDefaultConfig();
    config.players[0][key] = value;
    assert.throws(() => validateConfig(config));
  }
  const duplicate = createDefaultConfig();
  duplicate.players[1].characterId = duplicate.players[0].characterId;
  assert.throws(() => validateConfig(duplicate));
});

test('真人局和全 AI 局均可创建独立初始状态', () => {
  for (const type of ['human', 'ai']) {
    const config = setPlayerCount(createDefaultConfig(), 4);
    config.players.forEach(player => { player.type = type; });
    const state = createGameState(config);
    assert.equal(state.phase, 'ready');
    assert.equal(state.players.length, 4);
    assert.ok(state.players.every(player => player.coins === 1500 && player.position === 0 && !player.bankrupt));
    state.players[0].name = '已修改';
    assert.equal(config.players[0].name, '玩家 1');
  }
});
