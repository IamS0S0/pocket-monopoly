import { MAPS } from './maps.js';

export const TILE_TYPES = {
  start: { name: '起点', color: '#f3c45f', symbol: '出发' },
  property: { name: '地产', color: '#fff6de', symbol: '地产' },
  event: { name: '事件', color: '#efa48d', symbol: '事件' },
  chance: { name: '机会', color: '#a8c7df', symbol: '机会' },
  jail: { name: '监狱', color: '#b6b3ce', symbol: '监狱' },
  tax: { name: '税收', color: '#e1bbd1', symbol: '税收' },
};

const DEFINITIONS = {
  city: { count: 24, streets: ['阳光街', '奶茶巷', '花园路', '风车街'], special: { 0: 'start', 3: 'event', 6: 'jail', 9: 'chance', 12: 'tax', 15: 'event', 18: 'chance', 21: 'tax' } },
  forest: { count: 20, streets: ['蘑菇径', '精灵谷', '松果林', '萤火湾'], special: { 0: 'start', 2: 'chance', 5: 'event', 8: 'tax', 10: 'jail', 13: 'chance', 16: 'event' } },
  space: { count: 18, streets: ['月光站', '星云港', '彗星湾', '银河城'], special: { 0: 'start', 3: 'tax', 5: 'chance', 7: 'event', 9: 'jail', 12: 'chance', 15: 'event' } },
};

// 坐标与格子类型属于普通数据，可直接在 Node.js 中验证，不依赖 Three.js。
export function createBoard(mapId) {
  const definition = DEFINITIONS[mapId];
  if (!definition) throw new Error('未知棋盘主题');
  const map = MAPS.find(item => item.id === mapId);
  return Array.from({ length: definition.count }, (_, index) => {
    let x, z, rotation = 0;
    if (map.layout === 'square') {
      const side = Math.floor(index / 6), offset = index % 6 * 1.1;
      [x, z] = [[-3.3 + offset, 3.3], [3.3, 3.3 - offset], [3.3 - offset, -3.3], [-3.3, -3.3 + offset]][side];
    } else if (map.layout === 'circle') {
      rotation = index / definition.count * Math.PI * 2;
      x = Math.sin(rotation) * 3.35;
      z = Math.cos(rotation) * 3.35;
    } else {
      // 六边形每条边分三段，按边插值，保证角点和移动次序一致。
      const side = Math.floor(index / 3), progress = index % 3 / 3;
      const a = side * Math.PI / 3, b = (side + 1) * Math.PI / 3;
      x = 3.65 * (Math.sin(a) * (1 - progress) + Math.sin(b) * progress);
      z = 3.65 * (Math.cos(a) * (1 - progress) + Math.cos(b) * progress);
      rotation = a + Math.PI / 6;
    }
    const type = definition.special[index] ?? 'property';
    return { id: `${mapId}-${index}`, index, type, x, z, rotation,
      name: type === 'property' ? `${definition.streets[Math.floor(index / 5) % 4]}${index}号` : TILE_TYPES[type].name };
  });
}
