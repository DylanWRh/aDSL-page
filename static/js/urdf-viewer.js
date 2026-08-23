import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import URDFLoader from 'urdf-loader';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const NORMALIZED_VIEWER_RADIUS = 1;
const VIEWER_CAMERA_DISTANCE = 2.8;

document.querySelectorAll('[data-urdf-card]').forEach((card) => {
  const viewer = card.querySelector('[data-viewer]');
  const status = card.querySelector('[data-viewer-status]');
  const resetButton = card.querySelector('[data-viewer-reset]');
  const hint = card.querySelector('[data-viewer-hint]');
  const jointsContainer = card.querySelector('[data-urdf-joints]');
  const urdfUrl = card.dataset.urdfSrc;

  if (!viewer || !urdfUrl) return;

  createUrdfViewer({
    viewer,
    status,
    resetButton,
    hint,
    jointsContainer,
    urdfUrl,
  });
});

function createUrdfViewer({ viewer, status, resetButton, hint, jointsContainer, urdfUrl }) {
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
  renderer.domElement.setAttribute('aria-hidden', 'true');
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

  resetButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    controls.reset();
    controls.autoRotate = !reduceMotion;
    hint?.classList.remove('is-dismissed');
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

  const loadingManager = new THREE.LoadingManager();
  const loader = new URDFLoader(loadingManager);
  const defaultMeshLoader = loader.loadMeshCb;
  let loadedRobot = null;
  let loadFailed = false;
  let isFinalized = false;

  loader.parseVisual = true;
  loader.parseCollision = false;

  loader.loadMeshCb = (path, manager, material, done) => {
    if (!/\.glb$/i.test(path)) {
      defaultMeshLoader(path, manager, material, done);
      return;
    }

    const gltfLoader = new GLTFLoader(manager);
    gltfLoader.load(
      path,
      (gltf) => {
        gltf.scene.traverse((node) => {
          if (node.isMesh && !node.material && material) node.material = material;
        });
        done(gltf.scene);
      },
      undefined,
      (error) => done(null, error)
    );
  };

  const showLoadError = (error) => {
    loadFailed = true;
    console.error('Unable to load the URDF asset.', error);
    if (status) {
      status.classList.add('is-error');
      status.textContent = 'We could not load this URDF asset.';
    }
    if (jointsContainer) jointsContainer.textContent = 'Joint controls are unavailable.';
  };

  const finalizeRobot = (robot) => {
    if (isFinalized) return;
    isFinalized = true;

    try {
      robot.rotation.x = -Math.PI / 2;
      robot.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = true;
        node.receiveShadow = true;
      });

      scene.add(robot);
      robot.updateMatrixWorld(true);

      const initialBox = new THREE.Box3().setFromObject(robot);
      if (initialBox.isEmpty()) throw new Error('The URDF contains no visible geometry.');

      const center = initialBox.getCenter(new THREE.Vector3());
      robot.position.set(-center.x, -initialBox.min.y, -center.z);
      robot.updateMatrixWorld(true);

      const alignedBox = new THREE.Box3().setFromObject(robot);
      const alignedSphere = alignedBox.getBoundingSphere(new THREE.Sphere());

      if (!Number.isFinite(alignedSphere.radius) || alignedSphere.radius <= 0) {
        throw new Error('The URDF has invalid bounds.');
      }

      const viewerScale = NORMALIZED_VIEWER_RADIUS / alignedSphere.radius;
      robot.position.multiplyScalar(viewerScale);
      robot.scale.multiplyScalar(viewerScale);
      robot.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(robot);
      const size = box.getSize(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z, 0.1);
      const target = box.getCenter(new THREE.Vector3());
      const distance = VIEWER_CAMERA_DISTANCE;
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

      buildJointControls(robot, jointsContainer);
      if (loadFailed) {
        if (status) {
          status.classList.add('is-error');
          status.textContent = 'We could not load this URDF asset.';
        }
      } else {
        status?.classList.add('is-ready');
      }
      resize();
      startRendering();
    } catch (error) {
      showLoadError(error);
    }
  };

  loadingManager.onError = (url) => {
    loadFailed = true;
    console.error(`Unable to load the URDF dependency: ${url}`);
  };

  loadingManager.onLoad = () => {
    if (loadedRobot) finalizeRobot(loadedRobot);
  };

  loader.load(
    urdfUrl,
    (robot) => {
      loadedRobot = robot;
    },
    undefined,
    showLoadError
  );

  resize();
  startRendering();
}

function buildJointControls(robot, container) {
  if (!container) return;

  const joints = Object.entries(robot.joints || {}).filter(([, joint]) => {
    return ['continuous', 'revolute', 'prismatic'].includes(joint.jointType);
  });

  container.replaceChildren();

  if (!joints.length) {
    container.textContent = 'No adjustable joints found.';
    return;
  }

  joints.forEach(([name, joint]) => {
    const isAngular = joint.jointType !== 'prismatic';
    let lower = Number(joint.limit?.lower);
    let upper = Number(joint.limit?.upper);

    if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower === upper) {
      lower = isAngular ? -Math.PI : -1;
      upper = isAngular ? Math.PI : 1;
    }

    const initialValue = THREE.MathUtils.clamp(Number(joint.jointValue?.[0]) || 0, lower, upper);
    const label = document.createElement('label');
    const header = document.createElement('span');
    const nameElement = document.createElement('span');
    const valueElement = document.createElement('output');
    const input = document.createElement('input');

    label.className = 'urdf-joint-control';
    header.className = 'urdf-joint-control__header';
    nameElement.textContent = humanizeJointName(name);
    valueElement.textContent = formatJointValue(initialValue, isAngular);

    input.type = 'range';
    input.min = String(lower);
    input.max = String(upper);
    input.step = String(Math.max((upper - lower) / 360, 0.001));
    input.value = String(initialValue);
    input.setAttribute('aria-label', humanizeJointName(name));

    input.addEventListener('input', () => {
      const value = Number(input.value);
      robot.setJointValue(name, value);
      valueElement.textContent = formatJointValue(value, isAngular);
    });

    header.append(nameElement, valueElement);
    label.append(header, input);
    container.append(label);
  });
}

function humanizeJointName(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatJointValue(value, isAngular) {
  return isAngular
    ? `${Math.round(THREE.MathUtils.radToDeg(value))}\u00b0`
    : `${value.toFixed(2)} m`;
}
