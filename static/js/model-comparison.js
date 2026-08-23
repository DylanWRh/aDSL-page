import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const NORMALIZED_COMPARISON_RADIUS = 1;
const COMPARISON_CAMERA_DISTANCE = 2.8;

document.querySelectorAll('[data-model-comparison]').forEach((comparison) => {
  createModelComparison(comparison);
});

function createModelComparison(comparison) {
  const canvas = comparison.querySelector('[data-comparison-canvas]');
  const divider = comparison.querySelector('[data-comparison-divider]');
  const status = comparison.querySelector('[data-comparison-status]');
  const hint = comparison.querySelector('[data-comparison-hint]');
  const resetButton = comparison.querySelector('[data-comparison-reset]');
  const beforeUrl = comparison.dataset.beforeModel;
  const afterUrl = comparison.dataset.afterModel;

  if (!canvas || !divider || !beforeUrl || !afterUrl) return;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf1f5f9);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setScissorTest(true);

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

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;

  controls.addEventListener('start', () => {
    hint?.classList.add('is-dismissed');
  });

  resetButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    controls.reset();
    hint?.classList.remove('is-dismissed');
  });

  let beforeModel = null;
  let afterModel = null;
  let split = 0.5;
  let draggingDivider = false;
  let visible = true;
  let frameId = 0;
  let renderWidth = 0;
  let renderHeight = 0;

  function resizeRenderer() {
    const width = Math.max(comparison.clientWidth, 1);
    const height = Math.max(comparison.clientHeight, 1);

    if (width === renderWidth && height === renderHeight) return;

    renderWidth = width;
    renderHeight = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render() {
    if (!visible) {
      frameId = 0;
      return;
    }

    resizeRenderer();
    controls.update();

    const splitPixels = Math.round(renderWidth * split);
    renderer.setViewport(0, 0, renderWidth, renderHeight);

    if (beforeModel && afterModel) {
      beforeModel.visible = true;
      afterModel.visible = false;
      renderer.setScissor(0, 0, splitPixels, renderHeight);
      renderer.render(scene, camera);

      beforeModel.visible = false;
      afterModel.visible = true;
      renderer.setScissor(splitPixels, 0, renderWidth - splitPixels, renderHeight);
      renderer.render(scene, camera);

      beforeModel.visible = true;
      afterModel.visible = true;
    } else {
      renderer.setScissor(0, 0, renderWidth, renderHeight);
      renderer.render(scene, camera);
    }

    frameId = window.requestAnimationFrame(render);
  }

  function startRendering() {
    if (!frameId) frameId = window.requestAnimationFrame(render);
  }

  function setSplit(nextSplit) {
    split = THREE.MathUtils.clamp(nextSplit, 0.02, 0.98);
    const originalPercent = Math.round(split * 100);
    divider.style.left = `${originalPercent}%`;
  }

  function updateSplitFromPointer(event) {
    const bounds = comparison.getBoundingClientRect();
    setSplit((event.clientX - bounds.left) / bounds.width);
  }

  divider.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    draggingDivider = true;
    divider.setPointerCapture(event.pointerId);
    updateSplitFromPointer(event);
  });

  divider.addEventListener('pointermove', (event) => {
    if (!draggingDivider) return;
    event.preventDefault();
    updateSplitFromPointer(event);
  });

  function finishDividerDrag(event) {
    draggingDivider = false;
    if (divider.hasPointerCapture(event.pointerId)) {
      divider.releasePointerCapture(event.pointerId);
    }
  }

  divider.addEventListener('pointerup', finishDividerDrag);
  divider.addEventListener('pointercancel', finishDividerDrag);

  const resizeObserver = new ResizeObserver(() => {
    resizeRenderer();
    startRendering();
  });
  resizeObserver.observe(comparison);

  if ('IntersectionObserver' in window) {
    const visibilityObserver = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) startRendering();
    }, { threshold: 0.02 });
    visibilityObserver.observe(comparison);
  }

  const loader = new GLTFLoader();
  const loadModel = (url) => new Promise((resolve, reject) => {
    loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
  });

  Promise.all([loadModel(beforeUrl), loadModel(afterUrl)])
    .then(([loadedBefore, loadedAfter]) => {
      beforeModel = loadedBefore;
      afterModel = loadedAfter;

      balanceReplacementMaterials(afterModel);

      [beforeModel, afterModel].forEach((model) => {
        model.traverse((node) => {
          if (!node.isMesh) return;
          node.castShadow = true;
          node.receiveShadow = true;
        });
        scene.add(model);
        model.updateMatrixWorld(true);
      });

      const initialBounds = new THREE.Box3()
        .expandByObject(beforeModel)
        .expandByObject(afterModel);

      if (initialBounds.isEmpty()) throw new Error('The comparison models contain no visible geometry.');

      const initialCenter = initialBounds.getCenter(new THREE.Vector3());
      const sharedOffset = new THREE.Vector3(
        -initialCenter.x,
        -initialBounds.min.y,
        -initialCenter.z
      );

      beforeModel.position.add(sharedOffset);
      afterModel.position.add(sharedOffset);
      beforeModel.updateMatrixWorld(true);
      afterModel.updateMatrixWorld(true);

      const alignedBounds = new THREE.Box3()
        .expandByObject(beforeModel)
        .expandByObject(afterModel);
      const alignedSphere = alignedBounds.getBoundingSphere(new THREE.Sphere());

      if (!Number.isFinite(alignedSphere.radius) || alignedSphere.radius <= 0) {
        throw new Error('The comparison models have invalid bounds.');
      }

      const comparisonScale = NORMALIZED_COMPARISON_RADIUS / alignedSphere.radius;

      [beforeModel, afterModel].forEach((model) => {
        model.position.multiplyScalar(comparisonScale);
        model.scale.multiplyScalar(comparisonScale);
        model.updateMatrixWorld(true);
      });

      const bounds = new THREE.Box3()
        .expandByObject(beforeModel)
        .expandByObject(afterModel);
      const size = bounds.getSize(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z, 0.1);

      resizeRenderer();

      const target = bounds.getCenter(new THREE.Vector3());
      const distance = COMPARISON_CAMERA_DISTANCE;
      const direction = new THREE.Vector3(1.1, 0.72, 1.35).normalize();

      camera.position.copy(target).add(direction.multiplyScalar(distance));
      camera.near = Math.max(distance / 100, 0.001);
      camera.far = distance * 100;
      camera.updateProjectionMatrix();

      controls.target.copy(target);
      controls.minDistance = distance * 0.32;
      controls.maxDistance = distance * 3;
      controls.update();
      controls.saveState();

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(maxDimension * 1.15, 64),
        new THREE.MeshStandardMaterial({
          color: 0xe7ebf0,
          roughness: 1,
          transparent: true,
          opacity: 0.72,
        })
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
      startRendering();
    })
    .catch((error) => {
      console.error('Unable to load the high-fidelity comparison.', error);
      if (status) {
        status.classList.add('is-error');
        status.textContent = 'We could not load the comparison models.';
      }
    });

  setSplit(0.5);
  resizeRenderer();
  startRendering();
}

function balanceReplacementMaterials(model) {
  const adjustedMaterials = new Map();

  function adjustMaterial(material) {
    if (adjustedMaterials.has(material)) return adjustedMaterials.get(material);

    const adjusted = material.clone();
    if (typeof adjusted.metalness === 'number') adjusted.metalness = Math.min(adjusted.metalness, 0.55);
    if (typeof adjusted.roughness === 'number') adjusted.roughness = Math.min(adjusted.roughness, 0.85);
    adjustedMaterials.set(material, adjusted);
    return adjusted;
  }

  model.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    node.material = Array.isArray(node.material)
      ? node.material.map(adjustMaterial)
      : adjustMaterial(node.material);
  });
}
