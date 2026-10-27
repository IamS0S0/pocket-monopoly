import { MAPS } from '../data/maps.js';
import { CHARACTERS } from '../data/characters.js';

export function createDefaultConfig() {
  return {
    mapId: 'city', roundLimit: 30,
    players: CHARACTERS.slice(0, 2).map((character, index) => ({
      id: `player-${index + 1}`, name: `玩家 ${index + 1}`,
      type: index === 0 ? 'human' : 'ai', characterId: character.id,
    })),
  };
}

// 配置边界集中在纯逻辑层：UI 以外的调用方也无法绕过校验。
export function validateConfig(config) {
  if (!config || !MAPS.some(map => map.id === config.mapId)) throw new Error('请选择有效地图');
  if (!Number.isInteger(config.roundLimit) || config.roundLimit < 5 || config.roundLimit > 100) {
    throw new Error('回合上限必须是 5–100 之间的整数');
  }
  if (!Array.isArray(config.players) || config.players.length < 2 || config.players.length > 4) throw new Error('玩家人数应为 2–4 人');
  const characters = new Set();
  const ids = new Set();
  for (const player of config.players) {
    if (!player || typeof player.id !== 'string' || ids.has(player.id)) throw new Error('玩家编号不可重复');
    ids.add(player.id);
    if (typeof player.name !== 'string' || !player.name.trim() || player.name.length > 12) throw new Error('玩家名称需为 1–12 个字符');
    if (!['human', 'ai'].includes(player.type)) throw new Error('请选择真人或 AI');
    if (!CHARACTERS.some(character => character.id === player.characterId)) throw new Error('请选择有效角色');
    if (characters.has(player.characterId)) throw new Error('每位玩家需要不同的角色');
    characters.add(player.characterId);
  }
  return true;
}

export function setPlayerCount(config, count) {
  if (![2, 3, 4].includes(count)) throw new Error('人数必须为 2、3 或 4');
  const next = structuredClone(config);
  next.players = next.players.slice(0, count);
  while (next.players.length < count) {
    const index = next.players.length;
    const available = CHARACTERS.find(character => !next.players.some(player => player.characterId === character.id));
    next.players.push({ id: `player-${index + 1}`, name: `玩家 ${index + 1}`, type: 'ai', characterId: available.id });
  }
  return next;
}

// 选择已被占用的角色时交换，始终维持角色唯一的约束。
export function selectCharacter(config, playerIndex, characterId) {
  if (!CHARACTERS.some(character => character.id === characterId) || !config.players[playerIndex]) throw new Error('无效的角色选择');
  const next = structuredClone(config);
  const previous = next.players[playerIndex].characterId;
  const occupied = next.players.findIndex(player => player.characterId === characterId);
  if (occupied >= 0) next.players[occupied].characterId = previous;
  next.players[playerIndex].characterId = characterId;
  return next;
}
