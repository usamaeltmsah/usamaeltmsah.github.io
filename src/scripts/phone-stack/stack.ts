// Phone stack: every role is an iPhone whose screen shows that role.
// Scrolling deals the phones off the stack, newest first; the active one is a working app.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Kind, Timeline } from '../../lib/timeline';
import { createApp, preload } from './ios-app';

// ---- Phone model: an iPhone 15/16 Pro front, proportions taken from a reference render ----
const PW = 1, PH = 2.06, PD = 0.085;
const R = 0.165;      // outer corner radius
const RIM = 0.014;    // metal band visible around the glass
const BEZEL = 0.034;  // black border between glass edge and the display
const BEV = 0.012;
const FRAME = 0x3c3c3c; // one finish for every phone: black titanium
// Side buttons: [x side, centre y as a fraction from the top, length as a fraction of height]
const BUTTONS = [[-1, 0.23, 0.045], [-1, 0.324, 0.072], [-1, 0.419, 0.072], [1, 0.371, 0.118]];

/** Rounded rectangle centred on the origin. */
function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape(), x = w / 2, y = h / 2;
  s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.absarc(x - r, -y + r, r, -Math.PI / 2, 0);
  s.lineTo(x, y - r); s.absarc(x - r, y - r, r, 0, Math.PI / 2);
  s.lineTo(-x + r, y); s.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI);
  s.lineTo(-x, -y + r); s.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

/**
 * Builds the stack inside `section`, which holds `.stage` and `.rail`.
 * Throws when WebGL can't start, so the caller keeps the plain timeline.
 */
export async function mount(section: HTMLElement, data: Timeline) {
  const stage = section.querySelector<HTMLElement>('.stage');
  const rail = section.querySelector<HTMLElement>('.rail');
  if (!stage || !rail) throw new Error('phone stack markup is missing .stage or .rail');
  const { roles } = data;

  const token = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const KIND: Record<Kind, string> = { 'Full-time': token('--accent'), Freelance: token('--accent2'), 'Part-time': '#14b8a6', Contract: '#14b8a6', Internship: '#14b8a6', Education: '#f59e0b', Volunteering: '#ec4899' };

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; // reflections for the metal band
  scene.environmentIntensity = 0.55;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 1.5);
  rim.position.set(4, 2, -4);
  scene.add(rim);

  // Metal band: an extruded rounded slab with a soft bevel, so light rolls over the edges
  const bandGeo = new THREE.ExtrudeGeometry(roundedRect(PW - BEV * 2, PH - BEV * 2, R - BEV), { depth: PD - BEV * 2, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 5, curveSegments: 32 });
  bandGeo.translate(0, 0, -(PD - BEV * 2) / 2);
  // Front glass (black) and the display inset by the bezel
  const GW = PW - RIM * 2, GH = PH - RIM * 2;
  const frontGeo = new THREE.ShapeGeometry(roundedRect(GW, GH, R - RIM), 32);
  const SW = GW - BEZEL * 2, SH = GH - BEZEL * 2;
  const screenGeo = new THREE.ShapeGeometry(roundedRect(SW, SH, R - RIM - BEZEL), 32);
  { // map UVs to 0..1 across the display
    const p = screenGeo.attributes.position, uv = screenGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / SW + 0.5, p.getY(i) / SH + 0.5);
  }
  // Dynamic Island with the front camera lens
  const islandGeo = new THREE.ShapeGeometry(roundedRect(0.215, 0.078, 0.039), 16);
  const lensGeo = new THREE.CircleGeometry(0.017, 24);
  const lensRingGeo = new THREE.RingGeometry(0.017, 0.024, 24);
  const buttonGeos = BUTTONS.map(([, , len]) => new RoundedBoxGeometry(0.03, len * PH, PD * 0.45, 3, 0.012));

  const front = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03 });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x1a1a4a, roughness: 0.1, metalness: 0.2, clearcoat: 1 });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x0d0d14 });
  const metal = new THREE.MeshPhysicalMaterial({ color: FRAME, metalness: 0.95, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.2 });

  await preload([...data.projects.map((p) => p.image), ...roles.map((r) => r.image)]);

  const phones = roles.map((r, i) => {
    const group = new THREE.Group();
    const ui = createApp(r, data, KIND[r.kind]);
    ui.render();
    const tex = new THREE.CanvasTexture(ui.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const frameMat = metal.clone(); // cloned so each phone can fade on its own
    const band = new THREE.Mesh(bandGeo, frameMat);
    const face = new THREE.Mesh(frontGeo, front.clone());
    face.position.z = PD / 2 + 0.001;
    const glass = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    glass.position.z = PD / 2 + 0.002;
    const island = new THREE.Mesh(islandGeo, black.clone());
    island.position.set(0, SH / 2 - 0.068, PD / 2 + 0.003);
    const ring = new THREE.Mesh(lensRingGeo, ringMat.clone());
    const lens = new THREE.Mesh(lensGeo, lensMat.clone());
    ring.position.set(0.064, island.position.y, PD / 2 + 0.0035);
    lens.position.set(0.064, island.position.y, PD / 2 + 0.004);
    // Draw front-to-back layers in a fixed order; they are nearly coplanar and fade together
    [band, face, glass, island, ring, lens].forEach((m, n) => { m.renderOrder = n; });
    group.add(band, face, glass, island, ring, lens);
    BUTTONS.forEach(([side, top], n) => {
      const b = new THREE.Mesh(buttonGeos[n], frameMat);
      b.position.set(side * (PW / 2 + 0.004), PH * (0.5 - top), 0);
      group.add(b);
    });
    const faded = [band, face, island, ring, lens].map((m) => m.material);
    for (const m of [...faded, glass.material]) m.transparent = true;
    scene.add(group);
    return { group, glass, i, ui, tex, faded };
  });

  // ---- Year rail: one button per role, newest first ----
  rail.innerHTML = '';
  const buttons = roles.map((r, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.setProperty('--c', KIND[r.kind]);
    b.setAttribute('aria-label', `${r.title}, ${r.org}, ${r.dates}`);
    b.innerHTML = `<span>${r.year}</span>`;
    b.addEventListener('click', () => {
      const top = section.getBoundingClientRect().top + scrollY + (i / (roles.length - 1)) * (section.offsetHeight - innerHeight);
      scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
    });
    rail.append(b);
    return b;
  });
  let shown = -1;
  const show = (i: number) => {
    if (i === shown) return;
    shown = i;
    buttons.forEach((b, j) => b.toggleAttribute('aria-current', j === i));
    // Keep the current year in view on narrow screens; scrollIntoView would also move the page
    const b = buttons[i];
    rail.scrollLeft = b.offsetLeft - (rail.clientWidth - b.offsetWidth) / 2;
  };

  // ---- Layout ----
  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  const pointer = new THREE.Vector2();
  addEventListener('pointermove', (e) => pointer.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5), { passive: true });

  // ---- Touch: the active phone is a working app ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const canvasEl = renderer.domElement;
  let activeIndex = 0, settled = false;
  /** Canvas-pixel point under the pointer on the active phone's display, or null. */
  function screenPoint(e: MouseEvent) {
    if (!settled) return null;
    const b = canvasEl.getBoundingClientRect();
    ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const ph = phones[activeIndex];
    const hitPoint = ray.intersectObject(ph.glass)[0];
    return hitPoint?.uv ? { ph, x: hitPoint.uv.x * ph.ui.canvas.width, y: (1 - hitPoint.uv.y) * ph.ui.canvas.height } : null;
  }
  canvasEl.addEventListener('pointermove', (e) => {
    const p = screenPoint(e);
    canvasEl.style.cursor = p && p.ph.ui.hover(p.x, p.y) ? 'pointer' : '';
  });
  canvasEl.addEventListener('click', (e) => {
    const p = screenPoint(e);
    if (p) p.ph.ui.tap(p.x, p.y, () => { p.ph.tex.needsUpdate = true; });
  });

  // Only draw while the section is on screen
  let visible = false, raf = 0;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(frame);
  }).observe(section);

  let focus = 0;
  const clock = new THREE.Clock();
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  function frame() {
    raf = 0;
    const r = section.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
    const target = p * (roles.length - 1);
    focus += (target - focus) * (reduced ? 1 : 0.09);
    activeIndex = Math.round(focus);
    show(activeIndex);
    settled = Math.abs(focus - activeIndex) < 0.12;
    const t = clock.getElapsedTime();
    // Fit the phone to ~86% of the stage height (or width on narrow screens), centred
    const fitH = 2.3 / (0.86 * 2 * tanHalf);
    const fitW = 1.2 / (0.86 * 2 * tanHalf * camera.aspect);
    camera.position.set(pointer.x * 0.25, -pointer.y * 0.2, Math.max(fitH, fitW));
    camera.lookAt(0, -0.06, 0);

    for (const ph of phones) {
      const k = ph.i - focus; // <0 already dealt, 0 active, >0 still in the stack
      const g = ph.group;
      if (k >= 0) {
        // Waiting in the stack, directly behind: each one a step further back and peeking out above
        const d = Math.min(k, 6);
        g.position.set(0, d * 0.13, -d * 0.45);
        g.rotation.set(-0.04 * d, 0, 0);
      } else {
        // Dealt: swing off to the left and fall away
        const d = -k;
        g.position.set(-d * 1.7, -d * 0.25, -d * 0.4);
        g.rotation.set(0.1 * d, 0.9 * Math.min(d, 1.2), 0.18 * d);
      }
      const active = Math.max(0, 1 - Math.abs(k));
      if (!reduced) g.position.y += Math.sin(t * 1.2 + ph.i) * 0.02 * active; // idle float
      g.rotation.y += pointer.x * 0.12 * active; // gentle tilt; stays easy to tap
      const fade = k < 0 ? Math.max(0, 1 - -k * 1.4) : k > 6 ? 0 : 1;
      g.visible = fade > 0.01;
      ph.glass.material.opacity = fade;
      for (const m of ph.faded) m.opacity = fade;
    }
    renderer.render(scene, camera);
    if (visible) raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
}
