// 主题数据只包含普通对象，不依赖渲染库；棋盘规则将在第二阶段接入。
export const MAPS = [
  { id: 'city', name: '欢乐都市', subtitle: '把每个街角，变成你的主场', tag: '城市漫游', icon: '▦', color: '#f8bd5b', ground: '#b9d8ba', sky: '#e9efe4', accent: '#ef926b', layout: 'square', description: '暖阳、街角小店与彩色屋顶。一场从家门口开始的财富旅行。' },
  { id: 'forest', name: '童话森林', subtitle: '沿着蘑菇小径，寻找幸运', tag: '林间奇遇', icon: '♧', color: '#94bba1', ground: '#a7c9aa', sky: '#e1eee3', accent: '#d78097', layout: 'circle', description: '在树屋与巨型蘑菇之间漫步，让森林为你捎来一点好运。' },
  { id: 'space', name: '星际旅行', subtitle: '下一站，是属于你的星球', tag: '宇宙假日', icon: '✧', color: '#aaa3db', ground: '#a7a2ca', sky: '#e9e6f4', accent: '#8b80cf', layout: 'hexagon', description: '登上月面基地，绕行梦幻星环，开启一段轻盈的宇宙假日。' },
];
