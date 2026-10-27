import './styles.css';
import './game.css';
import { mountMenu } from './ui/menu.js';
import { mountGame } from './ui/game.js';
import { WorldPreview } from './render/preview.js';
import { BoardView } from './render/board.js';
import { TurnEngine } from './core/engine.js';
import { MAPS } from './data/maps.js';

const app = document.querySelector('#app');
let disposePage = () => {};
let lastConfig;

function newPage() {
  disposePage();
  disposePage = () => {};
  // 使用新容器挂载页面，避免旧菜单事件累积。
  const root = document.createElement('div');
  app.replaceChildren(root);
  return root;
}

function showMenu() {
  const root = newPage();
  let preview, unavailable = false;
  disposePage = () => preview?.dispose();
  mountMenu(root, {
    initialConfig: lastConfig,
    onPreview(map, players) {
      if (unavailable) return;
      try {
        preview ??= new WorldPreview(root.querySelector('#preview'));
        preview.update(map, players);
      } catch (error) {
        preview?.dispose(); unavailable = true;
        root.querySelector('#preview').textContent = '3D 预览不可用，请检查浏览器硬件加速。';
        console.error('预览初始化失败：', error);
      }
    },
    onStart(config) {
      // 校验通过后才销毁菜单，非法输入仍能显示在原页面。
      const engine = new TurnEngine(config);
      lastConfig = structuredClone(config);
      showGame(engine);
    },
  });
}

function showGame(engine) {
  const root = newPage();
  const map = MAPS.find(item => item.id === engine.state.mapId);
  let view, closed = false, graphicsFailed = false;
  const update = () => { if (!closed) { hud.update(engine.snapshot()); view?.focus(engine.state.currentPlayerIndex); } };
  const hud = mountGame(root, map, engine.board, {
    async roll() {
      if (closed || !view || graphicsFailed) return;
      let action;
      try {
        action = engine.beginRoll();
        if (!action) return;
        hud.error(''); update();
        if (!await view.roll(action.value) || closed) return;
        if (!engine.beginMovement(action.token)) return;
        update();
        for (const position of action.path) {
          if (!await view.hop(action.playerIndex, position) || closed) return;
          if (!engine.completeStep(action.token, position)) return;
          update();
        }
        engine.land(action.token); update();
      } catch (error) {
        if (closed) return;
        if (action) engine.recover(action.token);
        view?.sync(engine.state.players);
        hud.error('本次操作未完成，已恢复位置，请重新掷骰。'); update();
        console.error('回合执行失败：', error);
      }
    },
    end() { if (!closed && !graphicsFailed && engine.endTurn()) update(); },
    leave: showMenu,
    camera(follow) { if (view) view.follow = follow; },
  });
  disposePage = () => { closed = true; engine.dispose(); view?.dispose(); };
  update();
  try {
    view = new BoardView(hud.canvas, map, engine.state.players, engine.board);
    view.onFailure = () => {
      graphicsFailed = true; engine.dispose(); update();
      hud.error('图形设备连接已中断，请返回大厅后重试。');
    };
  } catch (error) {
    graphicsFailed = true; engine.dispose(); update();
    hud.error('无法启动 3D 棋盘，请开启硬件加速后返回大厅重试。');
    console.error('棋盘初始化失败：', error);
  }
}

showMenu();
if (import.meta.hot) import.meta.hot.dispose(() => disposePage());
