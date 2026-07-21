// Bakes the award GLB models into looping sprite-sheet WebPs so the app can
// show "3D" trophies and the cursor ball with zero runtime 3D: no three.js in
// the bundle, no WebGL contexts, no model downloads. Output:
//   public/awards/<key>.webp   — square frame grid, transparent background
//   data/award-sprites.json    — per-asset { frames, cols, size, fps } metadata
//
// Usage:  npx tsx scripts/bake-award-sprites.ts
// Needs the source GLBs in public/3D-Models/ (they are deleted from the app
// once baked — restore them from the feature branch to re-bake) and the
// repo's playwright + sharp devDependencies. Takes ~1 min headless.
//
// Rotation is baked to CLOSE the loop: trophies spin one full Y turn; the ball
// tumbles X+Y at a 1:2 rate ratio (1 and 2 full turns per loop), the nearest
// closed loop to the live version's 1.5:2 endless tumble.
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

interface Asset {
  key: string;
  model: string; // path under public/
  frames: number;
  fps: number;
  size: number; // square frame edge, px
  mode: "spin" | "tumble";
  lights: "trophy" | "ball";
}

// Frame counts trade smoothness against file size; fps sets playback pace to
// sit near the live version's 0.6-0.8 rad/s trophy spin and 2 rad/s ball.
const ASSETS: Asset[] = [
  { key: "world_cup", model: "3D-Models/world_cup_trophy.glb", frames: 96, fps: 12, size: 320, mode: "spin", lights: "trophy" },
  { key: "golden_boot", model: "3D-Models/golden_boot.glb", frames: 96, fps: 12, size: 320, mode: "spin", lights: "trophy" },
  { key: "golden_glove", model: "3D-Models/golden_glove.glb", frames: 96, fps: 12, size: 320, mode: "spin", lights: "trophy" },
  { key: "ball", model: "3D-Models/fifa_trionda_ball_world_cup_2026.glb", frames: 126, fps: 20, size: 160, mode: "tumble", lights: "ball" },
];

const MIME: Record<string, string> = {
  ".js": "text/javascript",
  ".html": "text/html",
  ".glb": "model/gltf-binary",
  ".json": "application/json",
};

// The bake page: three.js from node_modules via import map, one model at a
// time, deterministic rotation per frame, frames handed back as PNG data URLs.
const PAGE = `<!doctype html><html><head><script type="importmap">
{ "imports": { "three": "/node_modules/three/build/three.module.js",
               "three/addons/": "/node_modules/three/examples/jsm/" } }
</script></head><body><script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// The exact HDR behind drei's <Environment preset="city"> — the original's
// lighting. Fetched at bake time only; RoomEnvironment is the offline fallback.
const CITY_HDR = "https://raw.githack.com/pmndrs/drei-assets/456060a26bbeb8fdf79326f224b6d99b8bcce736/hdri/potsdamer_platz_1k.hdr";

window.bake = async ({ model, frames, size, mode, lights }) => {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // An environment map is required: metallic golds and the ball's gloss render
  // black without one. The ball gets the original's city HDR for faithful
  // color; trophies keep the dimmed studio look already approved.
  const pmrem = new THREE.PMREMGenerator(renderer);
  if (lights === "ball") {
    try {
      const hdr = await new RGBELoader().loadAsync(CITY_HDR);
      scene.environment = pmrem.fromEquirectangular(hdr).texture;
    } catch {
      scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
    }
    scene.environmentIntensity = 1.0;
  } else {
    scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
    scene.environmentIntensity = 0.55;
  }

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 5);

  if (lights === "trophy") {
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const d1 = new THREE.DirectionalLight(0xffffff, 2.5); d1.position.set(10, 10, 5); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xd4af37, 1.5); d2.position.set(-10, 10, 5); scene.add(d2);
  } else {
    scene.add(new THREE.AmbientLight(0xffffff, 1));
    const d1 = new THREE.DirectionalLight(0x39d353, 2.5); d1.position.set(5, 5, 5); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 1.5); d2.position.set(-5, -5, -5); scene.add(d2);
  }

  const { scene: gltf } = await new GLTFLoader().loadAsync("/public/" + model);
  // Center on the origin and normalize so the model fills ~82% of the frame at
  // z=5 — display size is a CSS concern, the sprite is always full-bleed.
  const box = new THREE.Box3().setFromObject(gltf);
  const center = box.getCenter(new THREE.Vector3());
  gltf.position.sub(center);
  const maxDim = Math.max(...box.getSize(new THREE.Vector3()).toArray());
  const target = 2 * Math.tan((45 * Math.PI) / 360) * 5 * 0.82; // world units spanning 82% of view
  const group = new THREE.Group();
  group.add(gltf);
  group.scale.setScalar(target / maxDim);
  scene.add(group);

  // Deterministic warm-up: the first renders after load race texture upload +
  // shader compile, and the heaviest model (12 textures) bakes black or blank
  // without this. Force-upload every texture, compile shaders, then render
  // until the visible luminance stabilizes.
  scene.traverse((o) => {
    const mats = o.material ? [].concat(o.material) : [];
    for (const m of mats)
      for (const v of Object.values(m))
        if (v && v.isTexture) renderer.initTexture(v);
  });
  await renderer.compileAsync(scene, camera);
  const luminance = () => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    ctx.drawImage(renderer.domElement, 0, 0);
    const d = ctx.getImageData(0, 0, size, size).data;
    let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4)
      if (d[i + 3] > 8) { sum += d[i] + d[i + 1] + d[i + 2]; n++; }
    return n ? sum / n : 0;
  };
  renderer.render(scene, camera);
  let prev = luminance();
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    renderer.render(scene, camera);
    const cur = luminance();
    if (cur > 4 && Math.abs(cur - prev) < 0.5) break;
    prev = cur;
  }

  const out = [];
  for (let i = 0; i < frames; i++) {
    const p = i / frames; // progress through one closed loop
    if (mode === "spin") group.rotation.set(0, 2 * Math.PI * p, 0);
    else group.rotation.set(2 * Math.PI * p, 4 * Math.PI * p, 0); // 1:2 tumble
    renderer.render(scene, camera);
    out.push(renderer.domElement.toDataURL("image/png"));
  }
  renderer.dispose();
  renderer.domElement.remove();
  return out;
};
</script></body></html>`;

async function main() {
  const root = process.cwd();
  // --only key,key re-bakes a subset; metadata for the others is preserved.
  const onlyArg = process.argv.indexOf("--only");
  const only = onlyArg >= 0 ? process.argv[onlyArg + 1].split(",") : null;
  const assets = only ? ASSETS.filter((a) => only.includes(a.key)) : ASSETS;
  const server = createServer(async (req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (path === "/__bake") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(PAGE);
    }
    try {
      const body = await readFile(join(root, decodeURIComponent(path)));
      res.writeHead(200, { "Content-Type": MIME[extname(path)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`http://127.0.0.1:${port}/__bake`);

  await mkdir(join(root, "public/awards"), { recursive: true });
  await mkdir(join(root, "data"), { recursive: true });
  const meta: Record<string, { frames: number; cols: number; size: number; fps: number }> = await readFile(
    join(root, "data/award-sprites.json"),
    "utf8",
  )
    .then(JSON.parse)
    .catch(() => ({}));

  for (const asset of assets) {
    console.error(`baking ${asset.key} (${asset.frames} frames @ ${asset.size}px)...`);
    const urls: string[] = await page.evaluate(
      // @ts-expect-error window.bake is defined by the bake page
      (a) => window.bake(a),
      { model: asset.model, frames: asset.frames, size: asset.size, mode: asset.mode, lights: asset.lights },
    );

    const cols = Math.ceil(Math.sqrt(asset.frames));
    const rows = Math.ceil(asset.frames / cols);
    const sheet = sharp({
      create: { width: cols * asset.size, height: rows * asset.size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite(
      urls.map((u, i) => ({
        input: Buffer.from(u.split(",")[1], "base64"),
        left: (i % cols) * asset.size,
        top: Math.floor(i / cols) * asset.size,
      })),
    );
    const file = join(root, "public/awards", `${asset.key}.webp`);
    // Write via tmp + rename: the dev server (or a preview) can hold a lock on
    // the live file on Windows; rename retries ride it out.
    const buf = await sheet.webp({ quality: 90, alphaQuality: 95, effort: 6 }).toBuffer();
    const { writeFileSync, renameSync, rmSync } = await import("node:fs").then((m) => m.default ?? m);
    writeFileSync(file + ".tmp", buf);
    let swapped = false;
    for (let i = 0; i < 10 && !swapped; i++) {
      try {
        rmSync(file, { force: true });
        renameSync(file + ".tmp", file);
        swapped = true;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (!swapped) console.error(`  !! ${file} is locked — new bake left at ${file}.tmp`);
    meta[asset.key] = { frames: asset.frames, cols, size: asset.size, fps: asset.fps };
    const { size: bytes } = await import("node:fs").then((fs) => fs.promises.stat(file));
    console.error(`  -> ${file} (${Math.round(bytes / 1024)}KB)`);
  }

  await writeFile(join(root, "data/award-sprites.json"), JSON.stringify(meta, null, 2) + "\n");
  await browser.close();
  server.close();
  console.error("done: data/award-sprites.json written");
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
