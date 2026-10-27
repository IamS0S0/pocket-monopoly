import './styles.css';
import { mountMenu } from './ui/menu.js';
import { WorldPreview } from './render/preview.js';
import { createGameState } from './core/state.js';

let preview;
let unavailable = false;
mountMenu(document.querySelector('#app'), {
  onPreview(map, players) {
    if (unavailable) return;
    try {
      preview ??= new WorldPreview(document.querySelector('#preview'));
      preview.update(map, players);
    } catch (error) {
      preview?.dispose();
      unavailable = true;
      const fallback = document.createElement('p');
      fallback.className = 'preview-fallback';
      fallback.textContent = '3D 预览暂不可用，请启用浏览器硬件加速。你仍可配置游戏。';
      document.querySelector('#preview').replaceChildren(fallback);
      console.error('3D 预览初始化失败：', error);
    }
  },
  onStart: createGameState,
});

// Vite 热更新时释放 GPU 资源，避免开发中积累多个渲染循环。
if (import.meta.hot) import.meta.hot.dispose(() => preview?.dispose());
