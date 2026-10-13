import { createRequire } from "node:module";
import { execFile, spawn } from "node:child_process";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = path.join(root, "artifacts");
const work = path.join(artifacts, ".video-v2-work");
const validation = path.join(artifacts, "validation-v2-final");
const require = createRequire(import.meta.url);
const webRequire = createRequire(path.join(root, "apps", "web", "package.json"));
const ffmpeg = require("ffmpeg-static");
const ffprobe = require("ffprobe-static").path;
const { chromium } = webRequire("@playwright/test");
const host = "127.0.0.1";
const port = 3201;
const baseUrl = `http://${host}:${port}`;
const masterPath = path.join(artifacts, "synapse-city-linkedin-v2.mp4");
const coverPath = path.join(artifacts, "synapse-city-cover-v2.png");
const previewPath = path.join(artifacts, "synapse-city-preview.mp4");

const SHOTS = [
  { name: "opening", duration: 3 },
  { name: "world-a", duration: 2.5 },
  { name: "world-b", duration: 2.5 },
  { name: "decision", duration: 5 },
  { name: "learning", duration: 4 },
  { name: "benchmark", duration: 6 },
  { name: "closing", duration: 4 },
];

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, { cwd: root, windowsHide: true, maxBuffer: 30 * 1024 * 1024, ...options });
  return result.stdout;
}

async function runNpm(args) {
  if (process.platform === "win32") return run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `npm ${args.join(" ")}`]);
  return run("npm", args);
}

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${baseUrl}/capture?shot=opening`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Capture server did not start at ${baseUrl}`);
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return;
  if (process.platform === "win32") await execFileAsync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { windowsHide: true }).catch(() => {});
  else server.kill("SIGTERM");
}

async function captureShots() {
  await runNpm(["run", "build"]);
  const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", `npm --prefix apps/web run start -- --hostname ${host} --port ${port}`]
    : ["--prefix", "apps/web", "run", "start", "--", "--hostname", host, "--port", String(port)];
  const server = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", (chunk) => process.stdout.write(`[web] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[web] ${chunk}`));
  let browser;
  const captured = [];
  try {
    await waitForServer();
    browser = await chromium.launch({ headless: true });
    for (const shot of SHOTS) {
      console.log(`Capturing ${shot.name} (${shot.duration}s)…`);
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1800 },
        deviceScaleFactor: 1,
        colorScheme: "dark",
        recordVideo: { dir: work, size: { width: 1440, height: 1800 } },
      });
      const page = await context.newPage();
      const video = page.video();
      const consoleErrors = [];
      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
      await page.goto(`${baseUrl}/capture?shot=${shot.name}`, { waitUntil: "domcontentloaded" });
      await page.locator("canvas").waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForFunction(() => window.__SYNAPSE_CAPTURE_READY__ === true, undefined, { timeout: 30_000 });
      await page.waitForTimeout(2_500);
      const startedAt = Date.now();
      await page.evaluate(() => window.__SYNAPSE_CAPTURE_START__?.());
      const waitTo = async (seconds) => {
        const remaining = startedAt + seconds * 1000 - Date.now();
        if (remaining > 0) await page.waitForTimeout(remaining);
      };
      if (shot.name === "opening") {
        await waitTo(1.35);
        await page.screenshot({ path: path.join(work, "cover-source.png") });
      }
      await waitTo(shot.duration + .18);
      const contextLost = await page.locator("canvas").evaluate((canvas) => {
        const gl = canvas.getContext("webgl2");
        return !gl || gl.isContextLost();
      });
      if (contextLost) throw new Error(`WebGL context lost in ${shot.name}`);
      if (consoleErrors.length) throw new Error(`Browser errors in ${shot.name}: ${consoleErrors.join(" | ")}`);
      const usableWallDuration = (Date.now() - startedAt) / 1000;
      await page.close();
      await context.close();
      const temporaryPath = await video.path();
      const rawPath = path.join(work, `${shot.name}-raw.webm`);
      await rename(temporaryPath, rawPath);
      const probe = JSON.parse(await run(ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "json", rawPath]));
      const rawDuration = Number(probe.format.duration);
      captured.push({ ...shot, rawPath, trimStart: Math.max(0, rawDuration - usableWallDuration) });
    }
    return captured;
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopServer(server);
  }
}

async function normalizeShots(shots) {
  for (const shot of shots) {
    const output = path.join(work, `${shot.name}.mp4`);
    await run(ffmpeg, [
      "-y", "-ss", shot.trimStart.toFixed(3), "-i", shot.rawPath, "-t", String(shot.duration),
      "-vf", "scale=1080:1350:flags=lanczos,fps=30,setsar=1,format=yuv420p",
      "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", output,
    ]);
    shot.normalizedPath = output;
  }
}

function synthAudio(durationSeconds = 27, sampleRate = 48_000) {
  const frames = durationSeconds * sampleRate;
  const data = Buffer.alloc(frames * 4);
  let noiseState = 7319;
  const progression = [55, 65.406, 73.416, 49];
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    const beat = .6;
    const beatPhase = t % beat;
    const eighthPhase = t % (beat / 2);
    const root = progression[Math.floor(t / 4.8) % progression.length];
    const padEnv = Math.min(1, t / 1.5) * Math.min(1, (durationSeconds - t) / 1.5);
    const pad = (Math.sin(2 * Math.PI * root * 2 * t) + .55 * Math.sin(2 * Math.PI * root * 3 * t + .4) + .3 * Math.sin(2 * Math.PI * root * 4 * t + 1.1)) * .055 * padEnv;
    const bassEnv = Math.exp(-beatPhase * 5.5);
    const bass = Math.sin(2 * Math.PI * root * t) * bassEnv * .11;
    const kickEnv = Math.exp(-beatPhase * 22);
    const kick = Math.sin(2 * Math.PI * (48 + 42 * Math.exp(-beatPhase * 30)) * t) * kickEnv * .18;
    noiseState = (noiseState * 1664525 + 1013904223) >>> 0;
    const noise = noiseState / 0xffffffff * 2 - 1;
    const hat = noise * Math.exp(-eighthPhase * 58) * .025;
    const revealPhase = Math.min(Math.abs(t - 17), Math.abs(t - 23));
    const reveal = revealPhase < .5 ? Math.sin(2 * Math.PI * (92 + revealPhase * 130) * t) * Math.exp(-revealPhase * 8) * .12 : 0;
    const sample = Math.max(-1, Math.min(1, pad + bass + kick + hat + reveal));
    const left = Math.round(sample * 32767);
    const right = Math.round((sample + pad * .08 * Math.sin(t * .7)) * 32767);
    data.writeInt16LE(left, i * 4);
    data.writeInt16LE(Math.max(-32768, Math.min(32767, right)), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

async function compose(shots) {
  const audioPath = path.join(work, "original-score.wav");
  await writeFile(audioPath, synthAudio());
  const inputs = shots.flatMap((shot) => ["-i", shot.normalizedPath]);
  const videoPads = shots.map((_, index) => `[${index}:v]setpts=PTS-STARTPTS[v${index}]`).join(";");
  const concatPads = shots.map((_, index) => `[v${index}]`).join("");
  await run(ffmpeg, [
    "-y", ...inputs, "-i", audioPath,
    "-filter_complex", `${videoPads};${concatPads}concat=n=${shots.length}:v=1:a=0[v];[${shots.length}:a]afade=t=in:st=0:d=0.5,afade=t=out:st=25.8:d=1.2,volume=0.82[a]`,
    "-map", "[v]", "-map", "[a]", "-t", "27", "-r", "30",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    "-c:a", "aac", "-b:a", "192k", masterPath,
  ]);
  await run(ffmpeg, ["-y", "-i", path.join(work, "cover-source.png"), "-vf", "scale=1080:1350:flags=lanczos,eq=contrast=1.035:saturation=1.04", "-frames:v", "1", "-threads", "1", coverPath]);
  await run(ffmpeg, [
    "-y", "-i", masterPath, "-vf", "scale=432:540:flags=lanczos", "-r", "30",
    "-c:v", "libx264", "-preset", "medium", "-crf", "25", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", previewPath,
  ]);
}

async function validate() {
  const output = await run(ffprobe, [
    "-v", "error", "-show_entries", "stream=index,codec_type,codec_name,width,height,r_frame_rate,pix_fmt:format=duration,size", "-of", "json", masterPath,
  ]);
  const probe = JSON.parse(output);
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  const audio = probe.streams.find((stream) => stream.codec_type === "audio");
  const duration = Number(probe.format.duration);
  if (video?.codec_name !== "h264" || video.width !== 1080 || video.height !== 1350 || video.r_frame_rate !== "30/1" || !audio || duration < 26.95 || duration > 27.05) {
    throw new Error(`Unexpected master metadata: ${output}`);
  }
  await writeFile(path.join(artifacts, "video-v2-metadata.json"), JSON.stringify(probe, null, 2), "utf8");
  for (const second of [1, 4, 7, 10, 15, 19, 22, 25]) {
    await run(ffmpeg, ["-y", "-ss", String(second), "-i", masterPath, "-frames:v", "1", "-threads", "1", path.join(validation, `frame-${String(second).padStart(2, "0")}.png`)]);
  }
  return probe;
}

async function main() {
  if (!ffmpeg || !ffprobe) throw new Error("Static FFmpeg binaries unavailable. Run npm install.");
  if (!work.startsWith(artifacts + path.sep)) throw new Error("Unsafe work directory");
  const reuseCapture = process.argv.includes("--reuse-capture");
  if (!reuseCapture) await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true });
  await rm(validation, { recursive: true, force: true });
  await mkdir(validation, { recursive: true });
  const shots = reuseCapture
    ? SHOTS.map((shot) => ({ ...shot, normalizedPath: path.join(work, `${shot.name}.mp4`) }))
    : await captureShots();
  if (!reuseCapture) await normalizeShots(shots);
  await compose(shots);
  const metadata = await validate();
  console.log(`Created ${path.relative(root, masterPath)} (${metadata.format.size} bytes)`);
  console.log(`Created ${path.relative(root, coverPath)}`);
  console.log(`Created ${path.relative(root, previewPath)}`);
  await rm(work, { recursive: true, force: true });
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

