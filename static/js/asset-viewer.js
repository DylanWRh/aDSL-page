import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelectorAll('[data-asset-card]').forEach((card) => {
  const viewer = card.querySelector('[data-viewer]');
  const status = card.querySelector('[data-viewer-status]');
  const resetButton = card.querySelector('[data-viewer-reset]');
  const hint = card.querySelector('[data-viewer-hint]');
  const prompt = card.querySelector('[data-prompt-text]');
  const modelUrl = card.dataset.modelSrc;
  const promptUrl = card.dataset.promptSrc;

  if (!viewer || !modelUrl) return;

  loadPrompt(promptUrl, prompt);
  createAssetViewer({ viewer, status, resetButton, hint, modelUrl });
});

async function loadPrompt(url, target) {
  if (!url || !target) return;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Prompt request failed: ${response.status}`);
    const text = (await response.text()).trim();
    if (text) target.textContent = text;
  } catch (error) {
    console.warn('Using the inline prompt because the prompt file could not be loaded.', error);
  }
}

function createAssetViewer({ viewer, status, resetButton, hint, modelUrl }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f6f9);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', viewer.getAttribute('aria-label') || 'Interactive 3D model');
  renderer.domElement.setAttribute('tabindex', '0');
  viewer.prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xa7b0bf, 2.1));

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(4, 7, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.bias = -0.00015;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xcfe2ff, 1.4);
  rimLight.position.set(-5, 3, -4);
  scene.add(rimLight);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.65;

  let visible = true;
  let frameId = 0;
  let floor = null;

  const render = () => {
    if (!visible) {
      frameId = 0;
      return;
    }
    controls.update();
    renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(render);
  };

  const startRendering = () => {
    if (!frameId) frameId = window.requestAnimationFrame(render);
  };

  const resize = () => {
    const width = Math.max(viewer.clientWidth, 1);
    const height = Math.max(viewer.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
  };

  const stopAutoRotate = () => {
    controls.autoRotate = false;
    hint?.classList.add('is-dismissed');
  };

  controls.addEventListener('start', stopAutoRotate);
  renderer.domElement.addEventListener('keydown', stopAutoRotate);

  resetButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    controls.reset();
    controls.autoRotate = !reduceMotion;
    hint?.classList.remove('is-dismissed');
    renderer.domElement.focus({ preventScroll: true });
  });

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewer);

  if ('IntersectionObserver' in window) {
    const visibilityObserver = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) startRendering();
    }, { threshold: 0.02 });
    visibilityObserver.observe(viewer);
  }

  new GLTFLoader().load(
    modelUrl,
    (gltf) => {
      const model = gltf.scene;
      model.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;
      });

      const initialBox = new THREE.Box3().setFromObject(model);
      const center = initialBox.getCenter(new THREE.Vector3());
      model.position.set(-center.x, -initialBox.min.y, -center.z);
      scene.add(model);

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z, 0.1);
      const target = new THREE.Vector3(0, size.y * 0.46, 0);
      const distance = (maxDimension / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) * 1.45;
      const direction = new THREE.Vector3(1.1, 0.82, 1.25).normalize();

      camera.position.copy(target).add(direction.multiplyScalar(distance));
      camera.near = Math.max(distance / 100, 0.001);
      camera.far = distance * 100;
      camera.updateProjectionMatrix();

      controls.target.copy(target);
      controls.minDistance = distance * 0.32;
      controls.maxDistance = distance * 3;
      controls.update();
      controls.saveState();

      floor = new THREE.Mesh(
        new THREE.CircleGeometry(maxDimension * 1.15, 64),
        new THREE.MeshStandardMaterial({ color: 0xe7ebf0, roughness: 1, transparent: true, opacity: 0.72 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -maxDimension * 0.006;
      floor.receiveShadow = true;
      scene.add(floor);

      keyLight.position.set(maxDimension * 1.2, maxDimension * 2, maxDimension * 1.4);
      keyLight.shadow.camera.left = -maxDimension;
      keyLight.shadow.camera.right = maxDimension;
      keyLight.shadow.camera.top = maxDimension;
      keyLight.shadow.camera.bottom = -maxDimension;
      keyLight.shadow.camera.near = 0.01;
      keyLight.shadow.camera.far = maxDimension * 5;
      keyLight.shadow.camera.updateProjectionMatrix();

      status?.classList.add('is-ready');
      resize();
      startRendering();
    },
    undefined,
    (error) => {
      console.error('Unable to load the 3D asset.', error);
      if (status) {
        status.classList.add('is-error');
        status.innerHTML = '<span>We could not load this 3D asset. You can still download the GLB below.</span>';
      }
    }
  );

  resize();
  startRendering();
}
