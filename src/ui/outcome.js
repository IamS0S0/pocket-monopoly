// 只展示规则层结果；关闭通知不会再次执行奖励或扣款。
export function mountOutcome(root, actions) {
  const host = document.createElement('div');
  host.innerHTML = `<dialog id="event-dialog" aria-labelledby="event-title"><div class="eyebrow">旅途中的小插曲 ✦</div><h2 id="event-title"></h2><p id="event-text"></p><button id="event-confirm" class="start-button">知道了，继续 →</button></dialog>
    <dialog id="result-dialog" aria-labelledby="result-title"><div class="eyebrow">每一段旅行，都值得纪念</div><h2 id="result-title">🏆 旅行结算</h2><p id="result-reason"></p><ol id="result-ranking"></ol><button id="result-leave" class="start-button">返回大厅，再来一局</button></dialog>`;
  root.append(host);
  const query = selector => host.querySelector(selector);
  const eventDialog = query('#event-dialog'), resultDialog = query('#result-dialog');
  let token;
  query('#event-confirm').addEventListener('click', () => actions.acknowledge(token));
  eventDialog.addEventListener('cancel', event => { event.preventDefault(); actions.acknowledge(token); });
  resultDialog.addEventListener('cancel', event => event.preventDefault());
  query('#result-leave').addEventListener('click', actions.leave);
  return {
    update(state) {
      if (state.phase === 'awaiting-event' && state.notice) {
        token = state.notice.token;
        query('#event-title').textContent = state.notice.title;
        query('#event-text').textContent = state.notice.text;
        if (!eventDialog.open) eventDialog.showModal();
      } else if (eventDialog.open) eventDialog.close();
      if (state.phase === 'finished' && state.results) {
        query('#result-reason').textContent = state.results.reason;
        query('#result-ranking').replaceChildren(...state.results.ranking.map(row => {
          const item = document.createElement('li');
          item.className = row.rank === 1 ? 'result-winner' : '';
          item.textContent = `${row.rank === 1 ? '🏆 ' : ''}第 ${row.rank} 名 · ${row.name} · 总资产 ${row.assets} 金币（现金 ${row.coins}）${row.bankrupt ? ' · 破产退场' : row.rank === 1 ? ' · 获胜' : ' · 下次加油'}`;
          return item;
        }));
        if (!resultDialog.open) resultDialog.showModal();
      } else if (resultDialog.open) resultDialog.close();
    },
  };
}
