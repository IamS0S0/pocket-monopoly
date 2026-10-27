import * as THREE from 'three';

// 所有角色由基础几何体构成，不加载任何外部模型或纹理。
export function createCharacter(character) {
  const group = new THREE.Group();
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
  const skin = material('#ffddbb');
  const cloth = material(character.color);
  const dark = material('#3a4143');
  const cream = material('#fffae9');
  function part(geometry, mat, x, y, z, scale) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    if (scale) mesh.scale.set(...scale);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  }
  const sphere = () => new THREE.SphereGeometry(1, 20, 14);
  part(new THREE.CapsuleGeometry(0.28, 0.35, 4, 12), cloth, 0, 0.66, 0);
  part(sphere(), skin, 0, 1.26, 0, [0.43, 0.42, 0.38]);
  for (const side of [-1, 1]) {
    part(sphere(), dark, side * 0.14, 1.3, 0.349, [0.043, 0.061, 0.035]);
    part(sphere(), material('#f1aa9d'), side * 0.26, 1.17, 0.31, [0.07, 0.035, 0.02]);
    part(new THREE.CapsuleGeometry(0.09, 0.2, 4, 8), skin, side * 0.35, 0.69, 0).rotation.z = side * 0.3;
    part(sphere(), cream, side * 0.16, 0.14, 0.08, [0.14, 0.14, 0.22]);
  }
  if (character.style === 'cap') {
    part(sphere(), cloth, 0, 1.53, -0.01, [0.45, 0.2, 0.4]);
    part(sphere(), cloth, 0, 1.48, 0.34, [0.35, 0.045, 0.26]);
  } else if (character.style === 'sprout') {
    part(new THREE.CylinderGeometry(0.025, 0.035, 0.28), cloth, 0, 1.75, 0);
    part(sphere(), cloth, -0.12, 1.85, 0, [0.2, 0.07, 0.1]).rotation.z = -0.35;
    part(sphere(), cloth, 0.13, 1.9, 0, [0.2, 0.07, 0.1]).rotation.z = 0.35;
  } else if (character.style === 'astronaut') {
    part(new THREE.TorusGeometry(0.42, 0.075, 8, 24), cream, 0, 1.28, 0.06);
    part(new THREE.BoxGeometry(0.36, 0.4, 0.25), cream, 0, 0.74, -0.27);
    part(new THREE.CylinderGeometry(0.025, 0.025, 0.3), dark, 0.32, 1.72, 0);
    part(sphere(), cloth, 0.32, 1.9, 0, [0.07, 0.07, 0.07]);
  } else {
    for (const side of [-1, 1]) {
      part(sphere(), cloth, side * 0.21, 1.76, 0, [0.12, 0.35, 0.1]).rotation.z = side * -0.18;
      part(sphere(), cream, side * 0.21, 1.79, 0.085, [0.055, 0.22, 0.025]);
    }
  }
  return group;
}
