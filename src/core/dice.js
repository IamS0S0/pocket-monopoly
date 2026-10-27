// 随机源可注入以测试边界；动画只展示此结果，不能另行决定点数。
export function rollDice(random = Math.random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('随机源必须返回 [0, 1) 内的数');
  return Math.floor(value * 6) + 1;
}

export function movementPath(position, steps, boardLength) {
  if (!Number.isInteger(boardLength) || boardLength < 2 || !Number.isInteger(position) || position < 0 || position >= boardLength || !Number.isInteger(steps) || steps < 1 || steps > 6) {
    throw new Error('移动参数无效');
  }
  return Array.from({ length: steps }, (_, index) => (position + index + 1) % boardLength);
}
