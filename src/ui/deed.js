import { currentRent, propertyValue, MAX_PROPERTY_LEVEL } from '../core/property.js';

export function mountDeeds(root, actions) {
  const host = document.createElement('div');
  host.innerHTML = `
    <dialog id="purchase-dialog" aria-labelledby="purchase-title"><div class="eyebrow">新的街角，等你拥有</div><h2 id="purchase-title"></h2><div id="purchase-info"></div><p id="purchase-error" role="alert"></p><button id="confirm-buy" class="start-button">购买地产</button><button id="skip-buy" class="text-button dialog-secondary">暂不购买</button></dialog>
    <dialog id="deed-dialog" class="deed-dialog" aria-labelledby="deed-title"><div class="deed-header"><div><div class="eyebrow">每一块土地，都有自己的故事</div><h2 id="deed-title">地产与地契</h2></div><button id="close-deeds" class="text-button">关闭</button></div><div class="deed-layout"><nav id="deed-list" aria-label="选择地产"></nav><section id="deed-detail"></section></div><p id="deed-error" role="alert"></p></dialog>`;
  root.append(host);
  const query = selector => host.querySelector(selector);
  const purchaseDialog = query('#purchase-dialog'), deedDialog = query('#deed-dialog');
  let state, selectedId, offerToken, revision;
  const text = (tag, value, className) => { const node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node; };

  function renderDeed() {
    if (!state) return;
    const properties = Object.values(state.properties);
    const active = state.players[state.currentPlayerIndex];
    selectedId ??= properties.find(property => property.ownerId === active.id)?.id ?? properties[0]?.id;
    query('#deed-list').replaceChildren(...properties.map(property => {
      const owner = state.players.find(player => player.id === property.ownerId);
      const button = text('button', `${property.name} · ${owner?.name ?? '无主'}`);
      button.type = 'button'; button.dataset.deed = property.id;
      button.setAttribute('aria-pressed', String(property.id === selectedId));
      button.addEventListener('click', () => { selectedId = property.id; query('#deed-error').textContent = ''; renderDeed(); });
      return button;
    }));
    const property = state.properties[selectedId];
    const detail = query('#deed-detail'); detail.replaceChildren();
    if (!property) return;
    const owner = state.players.find(player => player.id === property.ownerId);
    detail.append(text('h3', property.name), text('p', `第 ${property.index + 1} 格 · ${owner ? `${owner.name}所有` : '无主地产'}`), text('div', `${property.level} / ${MAX_PROPERTY_LEVEL} 级`, 'deed-level'));
    const facts = document.createElement('dl'); facts.className = 'deed-facts';
    for (const [label, value] of [['购入价格', property.price], ['单次升级', property.upgradeCost], ['当前租金', currentRent(property)], ['账面价值', propertyValue(property)]]) facts.append(text('dt', label), text('dd', `${value} 金币`));
    detail.append(facts);
    const table = document.createElement('table'); table.className = 'rent-table';
    table.innerHTML = '<caption>各等级租金</caption><thead><tr><th>等级</th><th>租金</th></tr></thead>';
    const body = document.createElement('tbody');
    property.rents.forEach((rent, level) => {
      const row = document.createElement('tr');
      if (level === property.level) row.className = 'current-level';
      row.append(text('td', `${level} 级${level === property.level ? '（当前）' : ''}`), text('td', `${rent} 金币`)); body.append(row);
    });
    table.append(body); detail.append(table);
    let reason = '';
    if (property.ownerId !== active.id) reason = '只能升级当前玩家自己的地产';
    else if (!['awaiting-roll', 'awaiting-end'].includes(state.phase)) reason = '请在掷骰前或落格处理完成后升级';
    else if (property.level >= MAX_PROPERTY_LEVEL) reason = '已达到最高等级';
    else if (state.upgradedThisTurn.includes(property.id)) reason = '本回合已升级过，下一次自己的回合可继续';
    else if (active.coins < property.upgradeCost) reason = '当前金币不足以升级';
    const button = text('button', reason || `花费 ${property.upgradeCost} 金币升级`, 'start-button');
    button.id = 'upgrade-property'; button.disabled = Boolean(reason);
    const expectedRevision = revision;
    button.addEventListener('click', () => actions.upgrade(property.id, expectedRevision));
    detail.append(button, text('p', '账面价值按购入价加已投入的升级费用计算；欠款时自动按账面价值的 50% 变卖，优先出售低价值地产。'));
  }

  const decide = choice => actions.decide(offerToken, choice);
  query('#confirm-buy').addEventListener('click', () => decide('buy'));
  query('#skip-buy').addEventListener('click', () => decide('skip'));
  purchaseDialog.addEventListener('cancel', event => { event.preventDefault(); decide('skip'); });
  query('#close-deeds').addEventListener('click', () => deedDialog.close());
  return {
    open() { renderDeed(); deedDialog.showModal(); },
    error(message) { query('#purchase-error').textContent = message; query('#deed-error').textContent = message; },
    update(next) {
      state = next; revision = state.revision;
      query('#purchase-error').textContent = ''; query('#deed-error').textContent = '';
      if (state.phase === 'awaiting-property' && state.offer) {
        const property = state.properties[state.offer.propertyId];
        const player = state.players[state.currentPlayerIndex];
        offerToken = state.offer.token;
        query('#purchase-title').textContent = `购入「${property.name}」？`;
        query('#purchase-info').replaceChildren(text('p', `轮到${player.name}选择。这是一块无主地产。`), text('div', `${property.price} 金币`, 'purchase-price'), text('p', `基础租金 ${currentRent(property)} 金币 · 升级费用 ${property.upgradeCost} 金币 / 级`), text('p', `你的金币：${player.coins} · ${player.coins >= property.price ? `购买后剩余：${player.coins - property.price}` : '资金不足，请选择暂不购买'}`));
        query('#confirm-buy').disabled = player.coins < property.price;
        if (!purchaseDialog.open) purchaseDialog.showModal();
      } else if (purchaseDialog.open) purchaseDialog.close();
      if (deedDialog.open) renderDeed();
    },
  };
}
