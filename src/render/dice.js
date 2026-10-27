import * as THREE from 'three';

const DOTS = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
};

export const DICE_NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
export const DICE_FACES = [1, 6, 2, 5, 3, 4];

export function createDice() {
  const materials = DICE_FACES.map(value => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff8e7'; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#dfd4b7'; ctx.lineWidth = 7; ctx.strokeRect(3, 3, 122, 122);
    ctx.fillStyle = value === 1 ? '#cb704d' : '#355947';
    DOTS[value].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(64 + x * 31, 64 + y * 31, 10, 0, Math.PI * 2); ctx.fill(); });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.65 });
  });
  const dice = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), materials);
  dice.castShadow = true;
  return dice;
}

// 将结果所在面的法线转向世界上方，保证骰面与规则点数一致。
export function diceOrientation(value) {
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...DICE_NORMALS[DICE_FACES.indexOf(value)]), new THREE.Vector3(0, 1, 0));
}
