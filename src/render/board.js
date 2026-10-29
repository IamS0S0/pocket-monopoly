import * as THREE from 'three';
import { WorldPreview } from './preview.js';
import { createDice, diceOrientation } from './dice.js';
import { CHARACTERS } from '../data/characters.js';

export class BoardView extends WorldPreview {
  constructor(container, map, players, board) {
    super(container);
    this.board = board;
    this.tweens = new Set();
    this.follow = true;
    this.target = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.update(map, players, board);
    this.scene.background = new THREE.Color(map.sky);
    this.renderer.domElement.setAttribute('aria-label', '可操作棋盘的三维画面');
    this.dice = createDice();
    this.dice.position.set(0, 3.9, 0);
    this.world.add(this.dice);
    this.marker = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.045, 8, 32), new THREE.MeshBasicMaterial({ color: '#f0ad33' }));
    this.marker.rotation.x = -Math.PI / 2;
    this.world.add(this.marker);
    this.activeIndex = 0;
    this.sync(players);
    this.resize();
    this.renderer.setAnimationLoop(time => {
      const dt = Math.min((time - (this.lastFrame ?? time)) / 1000, 0.05);
      this.lastFrame = time;
      for (const job of [...this.tweens]) {
        job.start ??= time;
        const progress = Math.min((time - job.start) / job.duration, 1);
        try { job.update(progress); } catch (error) { this.tweens.delete(job); job.reject(error); continue; }
        if (progress === 1) { this.tweens.delete(job); job.resolve(true); }
      }
      const figure = this.figures[this.activeIndex];
      if (figure) {
        this.marker.position.set(figure.position.x, 0.56, figure.position.z);
        this.target.copy(figure.position).multiplyScalar(this.follow && !this.reducedMotion.matches ? 0.28 : 0);
        this.target.y = 0;
      }
      this.look.lerp(this.target, 1 - Math.exp(-5 * dt));
      const distance = this.camera.aspect < 1 ? 1.35 : 1;
      this.camera.position.set(10.8 * distance + this.look.x, 12.8 * distance, 13.5 * distance + this.look.z);
      this.camera.lookAt(this.look);
      this.renderer.render(this.scene, this.camera);
    });
    this.onContextLost = event => { event.preventDefault(); this.cancelAnimations(); this.onFailure?.(); };
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
  }

  position(index, tileIndex) {
    const tile = this.board[tileIndex];
    // 固定座位偏移，四人落在同一格时也不会完全重叠。
    return new THREE.Vector3(tile.x + (index % 2 ? 0.19 : -0.19), 0.55, tile.z + (index < 2 ? 0.17 : -0.17));
  }

  sync(players) {
    players.forEach((player, index) => {
      this.figures[index].position.copy(this.position(index, player.position));
      this.figures[index].scale.setScalar(0.48);
      this.figures[index].visible = !player.bankrupt;
    });
  }

  focus(index) { this.activeIndex = index; }

  syncProperties(properties, players) {
    this.propertyVisuals ??= new Map();
    for (const property of Object.values(properties)) {
      const key = `${property.ownerId}:${property.level}`;
      const previous = this.propertyVisuals.get(property.id);
      if (previous?.key === key) continue;
      if (previous) {
        this.world.remove(previous.group);
        previous.group.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
      }
      const group = new THREE.Group();
      this.world.add(group);
      this.propertyVisuals.set(property.id, { key, group });
      if (!property.ownerId) continue;
      const owner = players.find(player => player.id === property.ownerId);
      if (!owner) continue;
      const color = CHARACTERS.find(character => character.id === owner.characterId).color;
      const tile = this.board[property.index];
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.035, 6, 24), new THREE.MeshBasicMaterial({ color }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(tile.x, 0.54, tile.z);
      group.add(ring);
      // 房屋靠近棋盘内侧，避免与同格玩家站位完全重叠。
      const centerDistance = Math.hypot(tile.x, tile.z);
      const x = tile.x - tile.x / centerDistance * 0.32;
      const z = tile.z - tile.z / centerDistance * 0.32;
      const height = 0.12 + property.level * 0.18;
      const house = new THREE.Mesh(new THREE.BoxGeometry(0.26, height, 0.26), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
      house.position.set(x, 0.53 + height / 2, z); house.castShadow = true; group.add(house);
      if (property.level > 0) {
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.17, 4), new THREE.MeshStandardMaterial({ color: '#fff2cc' }));
        roof.position.set(x, 0.53 + height + 0.085, z); roof.rotation.y = Math.PI / 4; roof.castShadow = true; group.add(roof);
      }
    }
  }

  tween(duration, update) {
    if (this.closed) return Promise.resolve(false);
    return new Promise((resolve, reject) => this.tweens.add({ duration: this.reducedMotion.matches ? 80 : duration, update, resolve, reject }));
  }

  async roll(value) {
    const target = diceOrientation(value);
    const completed = await this.tween(800, progress => {
      this.dice.rotation.set(progress * Math.PI * 6, progress * Math.PI * 4, progress * Math.PI * 2);
      this.dice.position.y = 3.9 + Math.sin(progress * Math.PI) * 1.1;
    });
    if (!completed) return false;
    const from = this.dice.quaternion.clone();
    return this.tween(220, progress => this.dice.quaternion.slerpQuaternions(from, target, progress));
  }

  hop(playerIndex, tileIndex) {
    const figure = this.figures[playerIndex];
    const from = figure.position.clone(), to = this.position(playerIndex, tileIndex);
    figure.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    return this.tween(260, progress => {
      const eased = progress * progress * (3 - 2 * progress);
      figure.position.lerpVectors(from, to, eased);
      if (!this.reducedMotion.matches) figure.position.y += Math.sin(progress * Math.PI) * 0.42;
    });
  }

  cancelAnimations() {
    for (const job of this.tweens) job.resolve(false);
    this.tweens.clear();
  }

  dispose() {
    this.closed = true;
    this.cancelAnimations();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    super.dispose();
  }
}
