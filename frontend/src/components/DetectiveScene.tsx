import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Loader2, Sparkles, Shield, Camera, Archive, Image as ImageIcon, Video, FileText, Globe } from 'lucide-react';

interface DetectiveSceneProps {
  onInspectEvidence?: (type: string) => void;
}

interface EvidenceCardConfig {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  iconType: 'photo' | 'video' | 'document' | 'web' | 'shield';
  basePos: THREE.Vector3;
  baseRot: THREE.Euler;
  scale: number;
}

export const DetectiveScene: React.FC<DetectiveSceneProps> = ({ onInspectEvidence }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [activeActionName, setActiveActionName] = useState<string>('idle');
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [inspectedCardId, setInspectedCardId] = useState<string | null>(null);

  // References for Three.js render loop & interactions
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const triggerInspectionRef = useRef<((cardIndex?: number) => void) | null>(null);
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0
  });

  const triggerAnimation = useCallback((animName: string) => {
    const actions = actionsRef.current;
    const currentAction = actions[activeActionName];
    const newAction = actions[animName];

    if (newAction && newAction !== currentAction) {
      if (currentAction) {
        currentAction.fadeOut(0.3);
      }
      newAction.reset().fadeIn(0.3).play();
      setActiveActionName(animName);

      if (animName !== 'idle') {
        setTimeout(() => {
          if (actions['idle']) {
            newAction.fadeOut(0.5);
            actions['idle'].reset().fadeIn(0.5).play();
            setActiveActionName('idle');
          }
        }, 2800);
      }
    }
  }, [activeActionName]);

  const handleInspectClick = useCallback(() => {
    if (triggerInspectionRef.current) {
      triggerInspectionRef.current();
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check WebGL availability
    const checkWebGL = () => {
      try {
        const canvas = document.createElement('canvas');
        return !!(
          window.WebGLRenderingContext &&
          (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
        );
      } catch {
        return false;
      }
    };

    if (!checkWebGL()) {
      setHasError(true);
      setLoading(false);
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Scene Setup
    const scene = new THREE.Scene();

    const width = container.clientWidth || 520;
    const height = container.clientHeight || 580;

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(0.12, 0.95, 3.25);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0.85, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    let isMounted = true;

    // Clear any previous canvas/children in container (avoids duplicate canvases in StrictMode)
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 2. Soft Studio Lighting Environment
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(ambientLight);

    // Key Light: soft, generous white light
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(2.8, 4.8, 3.5);
    scene.add(keyLight);

    // Fill Light: soft pale blue-gray fill
    const fillLight = new THREE.DirectionalLight(0xdbeafe, 1.15);
    fillLight.position.set(-2.8, 2.2, -1.5);
    scene.add(fillLight);

    // Rim Light: separates character silhouettes from background
    const rimLight = new THREE.DirectionalLight(0xe0f2fe, 1.3);
    rimLight.position.set(0, 3.2, -3.2);
    scene.add(rimLight);

    // Inspection scanning spotlight (pulses during inspection sequence)
    const scanLight = new THREE.PointLight(0x356ae6, 0, 4);
    scanLight.position.set(0.35, 0.95, 1.0);
    scene.add(scanLight);

    // 3. Soft Ground Contact Shadow Plane
    const createShadowTexture = () => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 110);
      grad.addColorStop(0, 'rgba(20, 36, 58, 0.32)');
      grad.addColorStop(0.35, 'rgba(20, 36, 58, 0.14)');
      grad.addColorStop(0.7, 'rgba(53, 106, 230, 0.04)');
      grad.addColorStop(1, 'rgba(20, 36, 58, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    };

    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 2.5),
      new THREE.MeshBasicMaterial({
        map: createShadowTexture(),
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.01;
    scene.add(shadowPlane);

    // Helper to safely draw rounded rectangles in all browsers
    const drawRoundRect = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) => {
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, r);
      } else {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      }
    };

    // 4. Floating Evidence Card Textures
    const createCardTexture = (
      title: string,
      subtitle: string,
      badge: string,
      iconType: 'photo' | 'video' | 'document' | 'web' | 'shield'
    ) => {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 220;
      const ctx = c.getContext('2d')!;

      // Rounded background with fine border
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      drawRoundRect(ctx, 8, 8, 496, 204, 22);
      ctx.fill();

      // Border (#DFE6EF)
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#DFE6EF';
      ctx.stroke();

      // Top badge background (#EEF3F8)
      ctx.fillStyle = '#EEF3F8';
      ctx.beginPath();
      drawRoundRect(ctx, 24, 24, 185, 40, 10);
      ctx.fill();

      // Badge text (#356AE6)
      ctx.fillStyle = '#356AE6';
      ctx.font = 'bold 20px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(badge, 38, 51);

      // Title (#14243A)
      ctx.fillStyle = '#14243A';
      ctx.font = 'bold 30px ui-sans-serif, system-ui, -apple-system, sans-serif';
      ctx.fillText(title, 24, 116);

      // Subtitle (#64748B)
      ctx.fillStyle = '#64748B';
      ctx.font = '500 21px ui-monospace, SFMono-Regular, monospace';
      ctx.fillText(subtitle, 24, 160);

      // Circular Icon Badge on right side
      ctx.fillStyle = '#356AE6';
      ctx.beginPath();
      ctx.arc(430, 110, 40, 0, Math.PI * 2);
      ctx.fill();

      // Icon symbol
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const iconSymbol =
        iconType === 'photo'
          ? '🖼️'
          : iconType === 'video'
          ? '🎬'
          : iconType === 'document'
          ? '📄'
          : iconType === 'web'
          ? '🌐'
          : '🛡️';
      ctx.fillText(iconSymbol, 430, 110);

      const tex = new THREE.CanvasTexture(c);
      tex.needsUpdate = true;
      return tex;
    };

    // 5. Five Floating Evidence Items (Section 7)
    const evidenceConfigs: EvidenceCardConfig[] = [
      {
        id: 'photo',
        title: 'Image Match Found',
        subtitle: 'pHash 98.4% • Google Lens',
        badge: 'IMAGE MATCH',
        iconType: 'photo',
        basePos: new THREE.Vector3(-1.12, 1.42, 0.22),
        baseRot: new THREE.Euler(0, 0.24, -0.04),
        scale: 0.36
      },
      {
        id: 'video',
        title: 'Video Keyframe 00:14',
        subtitle: 'Invariant Keyframe Match',
        badge: 'VIDEO FRAME',
        iconType: 'video',
        basePos: new THREE.Vector3(1.10, 1.38, -0.12),
        baseRot: new THREE.Euler(0, -0.28, 0.04),
        scale: 0.36
      },
      {
        id: 'c2pa',
        title: 'C2PA Content Credentials',
        subtitle: 'JUMBF Manifest Verified',
        badge: 'PROVENANCE SIGNED',
        iconType: 'shield',
        basePos: new THREE.Vector3(1.02, 0.68, 0.42),
        baseRot: new THREE.Euler(0, -0.32, 0.03),
        scale: 0.35
      },
      {
        id: 'document',
        title: 'Hardware EXIF Record',
        subtitle: 'Leica M11 • Shutter 1/500s',
        badge: 'METADATA SHEET',
        iconType: 'document',
        basePos: new THREE.Vector3(-1.06, 0.72, 0.34),
        baseRot: new THREE.Euler(0, 0.28, -0.03),
        scale: 0.35
      },
      {
        id: 'web',
        title: 'Wayback CDX Capture',
        subtitle: '2021-04-12 • Public Web',
        badge: 'WEB SOURCE',
        iconType: 'web',
        basePos: new THREE.Vector3(0.08, 1.76, -0.22),
        baseRot: new THREE.Euler(0.08, 0.05, -0.02),
        scale: 0.32
      }
    ];

    interface CardState {
      mesh: THREE.Mesh;
      basePos: THREE.Vector3;
      baseRot: THREE.Euler;
      currentPos: THREE.Vector3;
      speed: number;
      phase: number;
      id: string;
      scale: number;
    }

    const cardStates: CardState[] = [];
    const cardGroup = new THREE.Group();
    scene.add(cardGroup);

    evidenceConfigs.forEach((cfg, index) => {
      const tex = createCardTexture(cfg.title, cfg.subtitle, cfg.badge, cfg.iconType);
      const geo = new THREE.PlaneGeometry(2.3, 1.0);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(cfg.basePos);
      mesh.rotation.copy(cfg.baseRot);
      mesh.scale.set(cfg.scale, cfg.scale, cfg.scale);
      mesh.userData = { id: cfg.id, index };
      cardGroup.add(mesh);

      cardStates.push({
        mesh,
        basePos: cfg.basePos.clone(),
        baseRot: cfg.baseRot.clone(),
        currentPos: cfg.basePos.clone(),
        speed: 1.1 + index * 0.22,
        phase: index * 1.4,
        id: cfg.id,
        scale: cfg.scale
      });
    });

    // 6. Inspection State Machine (Section 8: Animation B)
    interface InspectionCycle {
      active: boolean;
      targetIndex: number;
      elapsed: number;
      duration: number; // total sequence length (~3.5s)
    }

    const inspection: InspectionCycle = {
      active: false,
      targetIndex: 0,
      elapsed: 0,
      duration: 3.6
    };

    const triggerInspection = (cardIndex = 0) => {
      if (inspection.active) return;
      inspection.active = true;
      inspection.targetIndex = cardIndex % cardStates.length;
      inspection.elapsed = 0;
      setInspectedCardId(cardStates[inspection.targetIndex].id);
      if (onInspectEvidence) {
        onInspectEvidence(cardStates[inspection.targetIndex].id);
      }
    };
    triggerInspectionRef.current = triggerInspection;

    // 7. Detective Character Loading (`oll.glb`)
    let characterModel: THREE.Group | null = null;
    const loader = new GLTFLoader();

    loader.load(
      '/models/oll.glb',
      (gltf) => {
        if (!isMounted) return;
        const model = gltf.scene;
        characterModel = model;

        // Bounding box calculation for upright scaling and ground alignment
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Target height ~1.95 units so the detective stands tall and recognizable
        const targetHeight = 1.95;
        const scale = targetHeight / (size.y || 1.2);
        model.scale.set(scale, scale, scale);

        // Ground the detective strictly at Y = 0 (feet down)
        model.position.y = -box.min.y * scale;
        model.position.x = -center.x * scale;
        model.position.z = -center.z * scale;

        // Upright rotation: ensure X=0 and Z=0 (strictly right-side-up, head at top)
        // Gentle initial angle (0.28 rad) facing forward-left toward evidence cards
        model.rotation.set(0, 0.28, 0);

        // Shadows & material finish
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (mesh.material) {
              const mat = mesh.material as THREE.MeshStandardMaterial;
              mat.roughness = Math.max(0.25, mat.roughness ?? 0.5);
              mat.needsUpdate = true;
            }
          }
        });

        scene.add(model);

        // Skeletal Animations
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;

          const actions: Record<string, THREE.AnimationAction> = {};
          const actionNames: string[] = [];

          gltf.animations.forEach((clip) => {
            const action = mixer.clipAction(clip);
            actions[clip.name] = action;
            actionNames.push(clip.name);
          });

          actionsRef.current = actions;
          setAvailableActions(actionNames);

          // Default idle animation loop
          if (actions['idle']) {
            actions['idle'].setEffectiveTimeScale(0.85);
            actions['idle'].play();
            setActiveActionName('idle');
          } else if (actionNames.length > 0) {
            actions[actionNames[0]].play();
            setActiveActionName(actionNames[0]);
          }
        }

        setLoading(false);
      },
      undefined,
      (err) => {
        console.error('Error loading detective model oll.glb:', err);
        setHasError(true);
        setLoading(false);
      }
    );

    // 8. Desktop Mouse Tracking & Parallax
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseRef.current.targetX = nx * 0.4;
      mouseRef.current.targetY = ny * 0.2;
    };

    // Raycast click on 3D evidence cards
    const raycaster = new THREE.Raycaster();
    const mouseCoord = new THREE.Vector2();

    const handleCanvasClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseCoord.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseCoord.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(mouseCoord, camera);

      const intersects = raycaster.intersectObjects(cardGroup.children, true);
      if (intersects.length > 0) {
        const top = intersects[0].object;
        if (top.userData && typeof top.userData.index === 'number') {
          triggerInspection(top.userData.index);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleCanvasClick);

    // 9. Main Render Loop
    let lastTime = performance.now();
    const startTime = performance.now();
    let reqId: number;
    let autoInspectTimer = 0;

    const inspectTargetPos = new THREE.Vector3(0.32, 0.98, 0.85);

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      const elapsedTime = (now - startTime) / 1000;
      lastTime = now;

      // Smooth mouse lerping
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      // Update animation mixer
      if (mixerRef.current) {
        mixerRef.current.update(delta);
      }

      // Auto-inspect timer (subtle periodic inspection every ~14s)
      if (!inspection.active && !prefersReducedMotion) {
        autoInspectTimer += delta;
        if (autoInspectTimer > 14) {
          autoInspectTimer = 0;
          triggerInspection(0);
        }
      }

      // Progress Inspection Sequence
      let inspectionT = 0; // 0 (idle) -> 1 (focused inspection) -> 0 (return)
      if (inspection.active) {
        inspection.elapsed += delta;
        const half = inspection.duration * 0.5;
        if (inspection.elapsed < half) {
          inspectionT = Math.sin((inspection.elapsed / half) * (Math.PI / 2));
        } else if (inspection.elapsed < inspection.duration) {
          const outT = (inspection.elapsed - half) / half;
          inspectionT = Math.cos(outT * (Math.PI / 2));
        } else {
          inspection.active = false;
          inspectionT = 0;
          setInspectedCardId(null);
        }
        // Pulse scan light during peak inspection
        scanLight.intensity = inspectionT * 2.8;
      } else {
        scanLight.intensity = THREE.MathUtils.lerp(scanLight.intensity, 0, 0.1);
      }

      // Character gentle gaze & inspection turn
      if (characterModel && !prefersReducedMotion) {
        const baseAngle = 0.28;
        const targetTurnAngle = inspection.active ? -0.05 : baseAngle;
        const currentTurn = THREE.MathUtils.lerp(
          baseAngle + mouseRef.current.x * 0.32,
          targetTurnAngle,
          inspectionT
        );
        characterModel.rotation.y = currentTurn;
        characterModel.rotation.x = -mouseRef.current.y * 0.06;
      }

      // Animate Floating Evidence Cards
      if (!prefersReducedMotion) {
        cardStates.forEach((item, idx) => {
          const t = elapsedTime * item.speed + item.phase;
          const isTarget = inspection.active && idx === inspection.targetIndex;

          if (isTarget) {
            // Lerp smoothly toward detective magnifying glass
            item.mesh.position.lerpVectors(
              item.basePos,
              inspectTargetPos,
              inspectionT
            );
            item.mesh.scale.setScalar(
              THREE.MathUtils.lerp(item.scale, item.scale * 1.15, inspectionT)
            );
            item.mesh.rotation.y = THREE.MathUtils.lerp(
              item.baseRot.y,
              -0.12,
              inspectionT
            );
          } else {
            // Idle floating bobbing and sway
            const bobY = item.basePos.y + Math.sin(t) * 0.045;
            item.mesh.position.y = bobY;
            item.mesh.rotation.y = item.baseRot.y + Math.sin(t * 0.7) * 0.035;
            item.mesh.rotation.z = item.baseRot.z + Math.cos(t * 0.6) * 0.02;
            item.mesh.scale.setScalar(item.scale);
          }
        });

        // Subtle group parallax reaction to mouse
        cardGroup.position.x = mouseRef.current.x * 0.1;
        cardGroup.position.y = mouseRef.current.y * 0.06;
      }

      renderer.render(scene, camera);
    };

    animate();

    // 10. Handle Viewport Resize
    const handleResize = () => {
      if (!container) return;
      const nw = container.clientWidth || 520;
      const nh = container.clientHeight || 580;
      camera.aspect = nw / nh;
      if (nw < 640) {
        camera.position.z = 3.65;
      } else {
        camera.position.z = 3.25;
      }
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };

    window.addEventListener('resize', handleResize);

    // 11. Cleanup
    return () => {
      isMounted = false;
      window.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleCanvasClick);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(reqId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [onInspectEvidence]);

  return (
    <div className="relative w-full h-[390px] sm:h-[480px] lg:h-[560px] flex items-center justify-center select-none overflow-hidden">
      {/* Soft circular aura background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[320px] sm:w-[440px] h-[320px] sm:h-[440px] rounded-full bg-gradient-to-tr from-blue-100/60 via-slate-100/50 to-sky-100/50 blur-3xl -z-10" />
      </div>

      {/* Loading Spinner Placeholder */}
      {loading && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500 font-mono text-xs">
          <Loader2 className="w-8 h-8 text-[#356AE6] animate-spin" />
          <span className="font-semibold text-[#14243A]">Loading 3D Forensic Detective...</span>
          <span className="text-[11px] text-slate-400">Rendering scene & Content Credentials cards</span>
        </div>
      )}

      {/* Graceful Fallback Card when WebGL is unavailable */}
      {hasError && (
        <div className="relative w-full max-w-md p-8 rounded-2xl bg-white border border-[#DFE6EF] shadow-lg shadow-slate-900/5 space-y-5 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-[#356AE6]">
            <Shield className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-100 text-[#356AE6]">
              ORIGINTRACE DETECTIVE
            </span>
            <h3 className="text-xl font-bold text-[#14243A] pt-1">Forensic Intelligence</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Automated image origin tracing, C2PA Content Credentials verification, and Wayback timeline reconstruction.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-left text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-[#DFE6EF] flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#356AE6] shrink-0" />
              <span className="text-[#14243A]">Hardware EXIF</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-[#DFE6EF] flex items-center gap-2">
              <Archive className="w-4 h-4 text-[#356AE6] shrink-0" />
              <span className="text-[#14243A]">Wayback CDX</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-[#DFE6EF] flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#356AE6] shrink-0" />
              <span className="text-[#14243A]">Perceptual Hash</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-[#DFE6EF] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#356AE6] shrink-0" />
              <span className="text-[#14243A]">C2PA Manifest</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Three.js Container */}
      <div
        ref={containerRef}
        className={`w-full h-full cursor-pointer transition-opacity duration-700 ${
          loading || hasError ? 'opacity-0' : 'opacity-100'
        }`}
        title="Click an evidence card to inspect"
      />

      {/* Interactive Controller Pill Bar (Subtle & Polished) */}
      {!loading && !hasError && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-[#DFE6EF] shadow-md shadow-slate-900/5 text-xs font-mono text-[#14243A]">
          <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mr-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#356AE6]" />
            Detective:
          </span>
          <button
            type="button"
            onClick={() => triggerAnimation('idle')}
            className={`px-2.5 py-0.5 rounded-full text-[11px] transition font-medium ${
              activeActionName === 'idle'
                ? 'bg-[#356AE6] text-white font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Idle Pose
          </button>
          <button
            type="button"
            onClick={handleInspectClick}
            className={`px-2.5 py-0.5 rounded-full text-[11px] transition font-medium ${
              inspectedCardId
                ? 'bg-[#356AE6] text-white font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Inspect Evidence 🔍
          </button>
          {availableActions.includes('wave') && (
            <button
              type="button"
              onClick={() => triggerAnimation('wave')}
              className={`px-2.5 py-0.5 rounded-full text-[11px] transition font-medium ${
                activeActionName === 'wave'
                  ? 'bg-[#356AE6] text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Wave 👋
            </button>
          )}
        </div>
      )}
    </div>
  );
};
