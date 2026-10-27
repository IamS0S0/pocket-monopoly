import { MAPS } from '../data/maps.js';
import { CHARACTERS } from '../data/characters.js';
import { createDefaultConfig, setPlayerCount, selectCharacter } from '../core/config.js';

export function mountMenu(root, { onPreview, onStart, initialConfig }) {
  let config = structuredClone(initialConfig ?? createDefaultConfig());
  let selectedSeat = 0;
  root.innerHTML = `
    <header class="topbar"><a class="brand" href="./"><span class="brand-icon">▦</span>口袋大富翁<span class="brand-en">POCKET MONOPOLY</span></a><span class="build-label"><i></i> 本地同乐 · 3D 桌游</span><button class="text-button" id="help">怎么玩 <span>↗</span></button></header>
    <main>
      <section class="intro"><div><div class="eyebrow">小小棋盘，大大冒险</div><h1>下一站，<span>好运！</span><span class="heading-star">✦</span></h1><p>选一个世界，叫上你的伙伴。让快乐先走一步。</p></div><div class="ticket"><span>一张通往快乐的车票</span><strong>GOOD TIMES CLUB</strong><span>2–4 位旅伴 / 无限种可能</span></div></section>
      <div class="lobby-grid">
        <section class="world-panel" aria-label="地图选择">
          <div class="panel-top"><span class="step">01</span><h2>挑一个喜欢的世界</h2><span class="muted">三种主题，自由出发</span></div>
          <div class="map-tabs" role="group" aria-label="地图主题">${MAPS.map(map => `<button type="button" data-map="${map.id}" aria-pressed="false"><span>${map.icon}</span>${map.name}</button>`).join('')}</div>
          <div class="world-scene"><div class="scene-copy"><span id="map-tag" class="scene-tag"></span><h3 id="map-name"></h3><p id="map-subtitle"></p></div><div id="preview"></div><span class="scene-note"><i></i> 实时 3D 微缩预览</span><span class="scene-stamp">LET’S<br>EXPLORE ↗</span></div>
          <div class="world-bottom"><span class="compass">✥</span><p id="map-description"></p><span class="world-index" id="world-index"></span></div>
        </section>
        <section class="settings-panel" aria-label="玩家设置">
          <div class="panel-top"><span class="step">02</span><h2>召集你的旅行小队</h2></div>
          <div class="setting-line"><label>玩家人数</label><div class="segmented" id="player-count" role="group" aria-label="玩家人数">${[2, 3, 4].map(count => `<button type="button" data-count="${count}">${count} 人</button>`).join('')}</div></div>
          <div id="seats" class="seats"></div>
          <div class="character-heading"><h3>给<span id="seat-title">玩家 1</span>选个形象</h3><span>占用时自动交换</span></div>
          <div class="characters" id="characters">${CHARACTERS.map(character => `<button type="button" data-character="${character.id}" aria-label="选择${character.name}，${character.title}" style="--character:${character.color}"><span class="avatar-art ${character.style}"><i class="avatar-body"></i><i class="avatar-head"><b></b></i><i class="avatar-hat"></i></span><strong>${character.name}</strong><small>${character.title}</small></button>`).join('')}</div>
          <div class="round-settings"><div><label for="round-limit">回合上限</label><p>到达上限，按总资产结算</p></div><div class="round-input"><input id="round-limit" type="number" min="5" max="100" step="1" value="30" required aria-describedby="round-hint"/><span>回合</span></div></div>
          <p class="small-note" id="round-hint">默认 30 回合 · 支持 5–100 回合</p>
          <p id="form-error" class="form-error" role="alert"></p>
          <button type="button" id="start" class="start-button">集结出发 <span>→</span></button>
          <p class="start-note">阶段③：购买、收租与升级 · AI 暂由玩家代操作</p>
        </section>
      </div>
      <footer><span>✦ 好运在路上，快乐在一起。</span><span>软件工程课程项目 <b> / </b> 第③阶段 · 地产经营</span></footer>
    </main>
    <dialog id="info-dialog" aria-labelledby="dialog-title"><div class="dialog-icon">✦</div><h2 id="dialog-title"></h2><div id="dialog-content"></div><button type="button" class="start-button" id="close-dialog">返回大厅 <span>↩</span></button></dialog>`;

  const dialog = root.querySelector('#info-dialog');
  function showDialog(title, paragraphs) {
    root.querySelector('#dialog-title').textContent = title;
    const content = root.querySelector('#dialog-content');
    content.replaceChildren(...paragraphs.map(text => {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      return paragraph;
    }));
    dialog.showModal();
  }
  function refresh() {
    const map = MAPS.find(item => item.id === config.mapId);
    root.querySelectorAll('[data-map]').forEach(button => button.setAttribute('aria-pressed', button.dataset.map === config.mapId));
    root.querySelectorAll('[data-count]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.count) === config.players.length));
    root.querySelector('#map-name').textContent = map.name;
    root.querySelector('#map-tag').textContent = map.tag;
    root.querySelector('#map-subtitle').textContent = map.subtitle;
    root.querySelector('#map-description').textContent = map.description;
    root.querySelector('#world-index').textContent = `0${MAPS.indexOf(map) + 1} / 03`;
    root.querySelector('.world-scene').style.backgroundColor = map.sky;
    root.querySelector('#seats').innerHTML = config.players.map((player, index) => {
      const character = CHARACTERS.find(item => item.id === player.characterId);
      return `<div class="seat ${selectedSeat === index ? 'selected' : ''}" style="--character:${character.color}"><button type="button" class="seat-select" data-seat="${index}" aria-pressed="${selectedSeat === index}" aria-label="为${player.name}选择角色"><span class="seat-avatar">${character.emoji}</span><span><strong>${player.name}</strong><small>${character.name} · ${selectedSeat === index ? '正在挑选形象' : '点击更换形象'}</small></span></button><select data-type="${index}" aria-label="${player.name}控制方式"><option value="human" ${player.type === 'human' ? 'selected' : ''}>真人</option><option value="ai" ${player.type === 'ai' ? 'selected' : ''}>AI 对手</option></select></div>`;
    }).join('');
    root.querySelector('#seat-title').textContent = config.players[selectedSeat].name;
    root.querySelectorAll('[data-character]').forEach(button => button.setAttribute('aria-pressed', button.dataset.character === config.players[selectedSeat].characterId));
    onPreview(map, config.players);
  }

  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.map) { config.mapId = button.dataset.map; refresh(); }
    if (button.dataset.count) {
      config = setPlayerCount(config, Number(button.dataset.count));
      selectedSeat = Math.min(selectedSeat, config.players.length - 1);
      refresh();
    }
    if (button.dataset.seat !== undefined) { selectedSeat = Number(button.dataset.seat); refresh(); }
    if (button.dataset.character) { config = selectCharacter(config, selectedSeat, button.dataset.character); refresh(); }
    if (button.id === 'help') showDialog('一场轻松的财富旅行', [
      '① 选择地图与 2–4 位旅伴，每个座位都能设为真人或 AI。点击座位后选择角色，占用的角色会自动交换。',
      '② 设置回合上限。完整版本中，大家轮流掷骰、购买地产、升级房屋，并应对旅途中的随机事件。',
      '③ 仅剩一人或达到回合上限时，按总资产排名。',
      '当前为第③阶段：无主地产可购买，踩他人地产自动付租，可在地契中升级自己的房屋。每块地产每回合最多升级一次。AI 暂由玩家代操作，事件与破产规则后续接入。',
    ]);
    if (button.id === 'close-dialog') dialog.close();
    if (button.id === 'start') {
      const error = root.querySelector('#form-error');
      error.textContent = '';
      config.roundLimit = Number(root.querySelector('#round-limit').value);
      try {
        // 启动成功会替换页面，不再访问旧菜单的元素。
        onStart(structuredClone(config));
      } catch (reason) { error.textContent = reason.message; root.querySelector('#round-limit').focus(); }
    }
  });
  root.addEventListener('change', event => {
    if (event.target.dataset.type !== undefined) config.players[Number(event.target.dataset.type)].type = event.target.value;
  });
  root.querySelector('#round-limit').addEventListener('input', () => {
    root.querySelector('#form-error').textContent = '';
  });
  dialog.addEventListener('click', event => {
    // 点击弹窗外部关闭，点击内容与内边距不误关闭。
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  root.querySelector('#round-limit').value = config.roundLimit;
  refresh();
}
