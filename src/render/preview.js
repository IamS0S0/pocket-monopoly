import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createCharacter } from './character.js';
import { CHARACTERS } from '../data/characters.js';
import { createBoard, TILE_TYPES } from '../data/boards.js';

export class WorldPreview {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(10.8, 11.5, 13.5);
    this.camera.lookAt(0, 0, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-label', '当前地图的 3D 微缩场景预览');
    this.renderer.domElement.setAttribute('role', 'img');
    container.append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#a4b39a', 3));
    const sun = new THREE.DirectionalLight('#fff5dc', 4);
    sun.position.set(-3, 10, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.animate = time => {
      if (this.world && !this.reducedMotion.matches) {
        this.world.rotation.y = Math.sin(time * 0.00016) * 0.08;
        this.figures.forEach((figure, index) => { figure.position.y = 0.58 + Math.sin(time * 0.002 + index) * 0.045; });
      }
      this.renderer.render(this.scene, this.camera);
    };
    this.renderer.setAnimationLoop(this.animate);
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  clearWorld() {
    if (!this.world) return;
    this.scene.remove(this.world);
    this.world.traverse(object => {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach(material => { material.map?.dispose(); material.dispose(); });
    });
  }

  update(map, players, gameBoard = null) {
    this.clearWorld();
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.figures = [];
    const mat = color => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    const box = (w, h, d, color, x, y, z, radius = 0.08) => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), mat(color));
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.world.add(mesh);
      return mesh;
    };
    const shape = (geometry, color, x, y, z) => {
      const mesh = new THREE.Mesh(geometry, mat(color));
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      this.world.add(mesh);
      return mesh;
    };
    box(8.6, 0.55, 8.6, map.ground, 0, 0, 0, 0.2);
    box(8.3, 0.12, 8.3, '#eae8ce', 0, -0.32, 0, 0.04);
    const board = gameBoard ?? createBoard(map.id);
    const positions = board.map(tile => [tile.x, tile.z]);
    this.tileMeshes = [];
    for (const data of board) {
      const tile = box(0.95, 0.22, 0.95, TILE_TYPES[data.type].color, data.x, 0.39, data.z);
      tile.rotation.y = data.rotation;
      this.tileMeshes.push(tile);
      if (gameBoard) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.textAlign = 'center'; ctx.fillStyle = '#355443';
        ctx.font = 'bold 30px Microsoft YaHei, sans-serif';
        ctx.fillText(TILE_TYPES[data.type].symbol, 64, 72);
        ctx.font = '22px sans-serif'; ctx.fillText(String(data.index + 1).padStart(2, '0'), 64, 35);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const label = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
        label.rotation.x = -Math.PI / 2;
        label.position.set(data.x, 0.515, data.z);
        this.world.add(label);
      }
    }
    if (map.id === 'city') {
      for (const [x, z, h, color] of [[-1.3, -1, 1.5, '#f0b565'], [0.1, -1.4, 2.3, '#f5d8ad'], [1.4, -0.8, 1.3, '#e99883'], [0.9, 1, 0.9, '#faf1d5'], [-1, 1, 1.1, '#93bdb7']]) {
        box(1, h, 0.9, color, x, h / 2 + 0.3, z);
        const roof = shape(new THREE.ConeGeometry(0.82, 0.55, 4), '#c87658', x, h + 0.55, z);
        roof.rotation.y = Math.PI / 4;
        for (let y = 0.75; y < h + 0.2; y += 0.48) {
          for (const offset of [-0.24, 0.24]) box(0.17, 0.23, 0.05, '#fff6d6', x + offset, y, z + 0.46, 0.02);
        }
      }
    } else if (map.id === 'forest') {
      for (const [x, z, height] of [[-1.5, -1.4, 2], [1.3, -1.5, 2.5], [0.3, 0, 2.1], [-1.6, 1, 1.4], [1.5, 1, 1.3]]) {
        shape(new THREE.CylinderGeometry(0.14, 0.22, height), '#a27859', x, height / 2 + 0.3, z);
        shape(new THREE.IcosahedronGeometry(0.85, 1), '#639f78', x, height + 0.1, z);
      }
      for (const x of [-0.8, 0.7]) {
        shape(new THREE.CylinderGeometry(0.16, 0.2, 0.55), '#fff2d9', x, 0.58, 1.8);
        const cap = shape(new THREE.SphereGeometry(0.48, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#e6979c', x, 0.85, 1.8);
        cap.scale.y = 0.7;
      }
    } else {
      const planet = shape(new THREE.SphereGeometry(1.25, 24, 16), '#f1c37e', 0, 2.1, -0.4);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.13, 8, 64), mat('#faf0d3'));
      ring.rotation.x = 1.25;
      planet.add(ring);
      for (const x of [-1.6, 1.6]) {
        const dome = shape(new THREE.SphereGeometry(0.7, 16, 12), '#e6e5f6', x, 0.35, 1.5);
        dome.scale.y = 0.8;
        box(0.25, 0.35, 0.12, '#8e84bf', x, 0.5, 2.1);
      }
    }
    players.forEach((player, index) => {
      const figure = createCharacter(CHARACTERS.find(character => character.id === player.characterId));
      const [x, z] = positions[gameBoard ? player.position : (index * 6) % board.length];
      figure.position.set(x, 0.58, z);
      figure.rotation.y = 0.45;
      figure.scale.setScalar(0.7);
      this.world.add(figure);
      this.figures.push(figure);
    });
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.clearWorld();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
