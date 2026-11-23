// Interactive STL viewer for the Project 3 axle model.
// The <img class="still"> inside .stl stays as the fallback if WebGL or the CDN is unavailable.
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const VIEWS = {
  iso:    [1, -1.25, 0.9],
  front:  [0, -1, 0],
  top:    [0, -0.0001, 1],
  bottom: [0, -0.0001, -1],
};

export async function mountStl(el, opts = {}) {
  const css = getComputedStyle(document.documentElement);
  const colour = opts.colour || css.getPropertyValue('--pen').trim() || '#1f6fd1';

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!opts.still });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(18, 1, 0.1, 1000);
  camera.up.set(0, 0, 1);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(40, -60, 80);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(-50, 40, -30);
  scene.add(rim);

  const geo = await new Promise((res, rej) => new STLLoader().load(el.dataset.src, res, undefined, rej));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  const centre = geo.boundingBox.getCenter(new THREE.Vector3());
  geo.translate(-centre.x, -centre.y, -centre.z);
  const size = geo.boundingBox.getSize(new THREE.Vector3()).length();

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colour, roughness: 0.55, metalness: 0.05 }));
  scene.add(mesh);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: 0x1d1c22, transparent: true, opacity: 0.55 }));
  scene.add(edges);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = size * 1.4;
  controls.maxDistance = size * 6;

  function setView(name) {
    const d = new THREE.Vector3(...VIEWS[name]).normalize().multiplyScalar(size * 2.9);
    camera.position.copy(d);
    controls.target.set(0, 0, 0);
    controls.update();
  }

  function resize() {
    const w = el.clientWidth, h = el.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', el.dataset.label || '3D model');
  el.prepend(renderer.domElement);
  el.classList.add('live');
  resize();
  setView('iso');

  let spin = false;
  function frame() {
    if (spin) mesh.rotation.z = edges.rotation.z = mesh.rotation.z + 0.01;
    controls.update();
    renderer.render(scene, camera);
  }
  if (opts.still) { frame(); return { setView: v => { setView(v); frame(); }, canvas: renderer.domElement }; }
  renderer.setAnimationLoop(frame);
  new ResizeObserver(resize).observe(el);

  return {
    setView,
    setSpin: on => { spin = on; },
    canvas: renderer.domElement,
  };
}

// Wire up the page's viewer, loading only once it scrolls near the viewport.
const el = document.getElementById('stl');
if (el && !window.__stlStill) {
  const io = new IntersectionObserver(async (es) => {
    if (!es.some(e => e.isIntersecting)) return;
    io.disconnect();
    try {
      const v = await mountStl(el);
      document.querySelectorAll('.stl-tools [data-view]').forEach(b => b.addEventListener('click', () => {
        v.setView(b.dataset.view);
        document.querySelectorAll('.stl-tools [data-view]').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
      }));
      const s = document.querySelector('.stl-tools [data-spin]');
      if (s) s.addEventListener('click', () => {
        const on = s.getAttribute('aria-pressed') !== 'true';
        s.setAttribute('aria-pressed', String(on));
        v.setSpin(on);
      });
      document.querySelector('.stl-tools')?.removeAttribute('hidden');
    } catch (err) {
      console.warn('STL viewer unavailable, showing the still render.', err);
    }
  }, { rootMargin: '200px' });
  io.observe(el);
}
