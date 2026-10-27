import { CHARACTERS } from '../data/characters.js';
import { TILE_TYPES } from '../data/boards.js';

export function mountGame(root, map, board, actions) {
  root.innerHTML = `
    <header class="topbar"><span class="brand"><span class="brand-icon">▦</span>口袋大富翁</span><span class="build-label">${map.name} · ${board.length} 格环形棋盘</span><button id="leave-game" class="text-button">返回大厅 ↩</button></header>
    <main class="game-main"><div class="game-heading"><div><div class="eyebrow">把快乐，再往前走一步</div><h1>${map.name}<span class="heading-star">✦</span></h1></div><div class="round-badge" id="round-status"></div></div>
    <div class="play-layout"><section class="board-panel"><div class="board-toolbar"><span id="phase-status" role="status" aria-live="polite"></span><button id="camera-toggle" class="text-button" aria-pressed="true">镜头跟随：开</button></div><div id="board-canvas"></div><div class="tile-legend">${Object.values(TILE_TYPES).map(type => `<span><i style="background:${type.color}"></i>${type.name}</span>`).join('')}</div></section>
    <aside class="game-sidebar"><section class="game-card"><div class="eyebrow">本轮旅伴</div><div id="game-players"></div></section>
    <section class="game-card turn-card"><div id="turn-heading"></div><div class="dice-readout" id="dice-result">?</div><p id="turn-description"></p><button id="roll-dice" class="start-button">掷骰子 →</button><button id="end-turn" class="start-button" hidden>结束回合 →</button><p id="game-error" role="alert"></p></section>
    <section class="game-card landing-card" id="landing-card" aria-live="polite"></section></aside></div>
    <section class="game-card log-card"><h2>旅行日志</h2><ol id="game-logs"></ol></section>
    <details class="board-directory"><summary>查看棋盘顺序与格子名称</summary><ol>${board.map(tile => `<li>${tile.index + 1}. ${tile.name} · ${TILE_TYPES[tile.type].name}</li>`).join('')}</ol></details>
    <footer><span>第②阶段 · 棋盘与掷骰移动</span><span>地产、事件、破产结算与 AI 自动行动将在后续阶段接入</span></footer></main>
    <dialog id="leave-dialog" aria-labelledby="leave-title"><h2 id="leave-title">结束这次旅行？</h2><p>返回大厅会清除本局进度，保留地图和队伍配置。移动中的动画也会停止。</p><button id="confirm-leave" class="start-button">返回大厅</button><button id="cancel-leave" class="text-button">继续旅行</button></dialog>`;
  const query = selector => root.querySelector(selector);
  query('#roll-dice').addEventListener('click', actions.roll);
  query('#end-turn').addEventListener('click', actions.end);
  query('#leave-game').addEventListener('click', () => query('#leave-dialog').showModal());
  query('#cancel-leave').addEventListener('click', () => query('#leave-dialog').close());
  query('#confirm-leave').addEventListener('click', actions.leave);
  let follow = true;
  query('#camera-toggle').addEventListener('click', () => {
    follow = !follow; actions.camera(follow);
    query('#camera-toggle').textContent = `镜头跟随：${follow ? '开' : '关'}`;
    query('#camera-toggle').setAttribute('aria-pressed', String(follow));
  });
  return {
    canvas: query('#board-canvas'),
    error(message) { query('#game-error').textContent = message; },
    update(state) {
      const player = state.players[state.currentPlayerIndex];
      const phaseText = { 'awaiting-roll': '等待掷骰', rolling: '骰子滚动中…', moving: '沿棋盘前进中…', 'awaiting-end': '已抵达，查看落点', finished: '移动演示已结束', disposed: '对局已停止' };
      query('#round-status').textContent = `第 ${state.round} / ${state.roundLimit} 回合`;
      query('#phase-status').textContent = `${player.name} · ${phaseText[state.phase] ?? ''}`;
      query('#game-players').replaceChildren(...state.players.map((item, index) => {
        const character = CHARACTERS.find(c => c.id === item.characterId);
        const card = document.createElement('div');
        card.className = `game-player ${index === state.currentPlayerIndex ? 'active' : ''}`;
        card.innerHTML = `<span class="seat-avatar" style="--character:${character.color}">${character.emoji}</span><div><strong></strong><small></small></div><span class="player-coins"></span>`;
        card.querySelector('strong').textContent = `${item.name} · ${character.name}`;
        card.querySelector('small').textContent = `第 ${item.position + 1} 格 · ${item.type === 'ai' ? 'AI（暂代操作）' : '真人'}`;
        card.querySelector('.player-coins').textContent = `${item.coins.toLocaleString()} 金`;
        return card;
      }));
      query('#turn-heading').textContent = state.phase === 'finished' ? '本次移动演示完成' : `轮到 ${player.name}`;
      query('#dice-result').textContent = state.phase === 'rolling' ? '…' : state.diceValue ?? '?';
      query('#turn-description').textContent = state.phase === 'finished' ? '已达到回合上限。资产排名与胜负界面将在后续阶段接入。' : player.type === 'ai' ? 'AI 策略尚未接入，请代为掷骰与结束回合。' : '掷骰后自动前进，落定后结束当前回合。';
      query('#roll-dice').disabled = state.phase !== 'awaiting-roll';
      query('#roll-dice').hidden = ['awaiting-end', 'finished'].includes(state.phase);
      query('#end-turn').hidden = state.phase !== 'awaiting-end';
      const landing = query('#landing-card');
      landing.replaceChildren();
      const heading = document.createElement('h2'), description = document.createElement('p');
      heading.textContent = state.landing ? `第 ${state.landing.index + 1} 格 · ${state.landing.name}` : '旅途即将开始';
      description.textContent = state.landing?.description ?? '棋子按格子编号依次前进；经过起点后继续绕行。';
      landing.append(heading, description);
      query('#game-logs').replaceChildren(...state.logs.map(message => { const li = document.createElement('li'); li.textContent = message; return li; }));
    },
  };
}
