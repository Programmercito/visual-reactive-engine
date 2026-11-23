import * as THREE from 'three';

export interface GiftEffectOptions {
  gift: string;
  y: number;
}

export class GiftEffect {
  readonly group = new THREE.Group();

  constructor(parent: THREE.Group, options: GiftEffectOptions) {
    this.group.position.set(0, options.y, 4);
    parent.add(this.group);

    if (this.isRose(options.gift)) {
      this.createRose();
      this.group.scale.setScalar(0.7);
    } else {
      this.createGiftBox();
    }
  }

  private isRose(gift: string): boolean {
    const normalized = gift.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return normalized.includes('rosa') || normalized.includes('rose');
  }

  private createRose(): void {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.07, 1.25, 12),
      new THREE.MeshStandardMaterial({ color: 0x188447, roughness: 0.55 }),
    );
    stem.position.set(0, -0.34, 0);
    stem.rotation.z = -0.08;
    this.group.add(stem);

    const leafGeometry = new THREE.SphereGeometry(0.22, 14, 10);
    for (const side of [-1, 1]) {
      const leaf = new THREE.Mesh(
        leafGeometry,
        new THREE.MeshStandardMaterial({ color: 0x24a858, roughness: 0.55 }),
      );
      leaf.position.set(side * 0.17, -0.22 + side * 0.08, 0);
      leaf.scale.set(1.25, 0.28, 0.55);
      leaf.rotation.z = side * 0.45;
      this.group.add(leaf);
    }

    const petals = new THREE.Group();
    petals.position.y = 0.42;
    this.group.add(petals);
    const petalGeometry = new THREE.SphereGeometry(0.18, 14, 10);
    const petalColors = [0xff477e, 0xe91e63, 0xc91650];
    for (let index = 0; index < 9; index += 1) {
      const angle = (index / 9) * Math.PI * 2;
      const petal = new THREE.Mesh(
        petalGeometry,
        new THREE.MeshStandardMaterial({ color: petalColors[index % petalColors.length], roughness: 0.4 }),
      );
      const radius = index < 6 ? 0.16 : 0.085;
      petal.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, Math.sin(angle) * 0.08);
      petal.scale.set(1, 1.25, 0.6);
      petal.rotation.z = angle + Math.PI / 2;
      petals.add(petal);
    }

    const center = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0xb10e43, roughness: 0.4 }),
    );
    center.position.z = 0.11;
    petals.add(center);
  }

  private createGiftBox(): void {
    const box = new THREE.Group();
    box.position.y = 0.95;
    this.group.add(box);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x2388ee, roughness: 0.3, metalness: 0.12 });
    const ribbonMaterial = new THREE.MeshStandardMaterial({ color: 0xffd34e, roughness: 0.3, metalness: 0.12 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.15, 1.05), bodyMaterial);
    box.add(body);
    const verticalRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.16, 0.04), ribbonMaterial);
    verticalRibbon.position.set(0, 0, 0.54);
    box.add(verticalRibbon);
    const horizontalRibbon = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.16, 0.04), ribbonMaterial);
    horizontalRibbon.position.set(0, -0.08, 0.54);
    box.add(horizontalRibbon);

    const lid = new THREE.Group();
    lid.position.y = 0.66;
    box.add(lid);
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.3, 1.2), bodyMaterial);
    lid.add(lidMesh);
    const lidRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.31, 0.05), ribbonMaterial);
    lidRibbon.position.set(0, 0, 0.62);
    lid.add(lidRibbon);

    const loopGeometry = new THREE.TorusGeometry(0.18, 0.045, 8, 16);
    for (const side of [-1, 1]) {
      const loop = new THREE.Mesh(loopGeometry, ribbonMaterial);
      loop.position.set(side * 0.16, 0.23, 0.02);
      loop.scale.set(1.1, 0.65, 0.55);
      loop.rotation.z = side * 0.55;
      lid.add(loop);
    }
  }
}
