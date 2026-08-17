// dsh-pet 拖拽日志分析器
// 用法：node analyze-drag-log.mjs [drag-log.csv]
// CSV 列：t_ms, wx, wy, tx, ty, mx, my, rx, ry, cx, cy, kx, ky, sz_w, sz_h, bnd_w, bnd_h
//   wx/wy   = 窗口实际位置（getPosition，主进程坐标）
//   tx/ty   = 我们 setPosition 的目标
//   mx/my   = 主进程鼠标位置（screen.getCursorScreenPoint，与 wx 同坐标系）
//   rx/ry   = 渲染端上报的 screenX/Y
//   cx/cy   = 渲染端 clientX/Y
//   kx/ky   = 当前自校准换算比
//   sz_*    = getSize()  读数
//   bnd_*   = getBounds() 宽高
import fs from "fs";

const file = process.argv[2] || "drag-log.csv";
if (!fs.existsSync(file)) { console.error("找不到日志文件: " + file); process.exit(1); }

const raw = fs.readFileSync(file, "utf8").split("\n");
const rows = [];
let session = 0;
for (const l of raw) {
  const t = l.trim();
  if (!t) continue;
  if (t.startsWith("#")) { if (t.includes("session start")) session++; continue; }
  const p = t.split(",").map(Number);
  if (p.length < 17 || p.some(isNaN)) continue;
  rows.push({
    s: session, t: p[0], wx: p[1], wy: p[2], tx: p[3], ty: p[4],
    mx: p[5], my: p[6], rx: p[7], ry: p[8], cx: p[9], cy: p[10],
    kx: p[11], ky: p[12], sz_w: p[13], sz_h: p[14], bnd_w: p[15], bnd_h: p[16],
  });
}

if (rows.length === 0) { console.error("没有有效数据行（请先拖动桌宠）"); process.exit(1); }

const sessions = [...new Set(rows.map(r => r.s))];
console.log(`总行数: ${rows.length}，会话数: ${sessions.length}\n`);

const fmt = (v, d = 1) => (typeof v === "number" ? v.toFixed(d) : v);
const rng = (arr) => arr.length ? `min=${fmt(Math.min(...arr))} max=${fmt(Math.max(...arr))}` : "无";

for (const s of sessions) {
  const R = rows.filter(r => r.s === s);
  const n = R.length;
  const first = R[0], last = R[n - 1];
  const dur = ((last.t - first.t) / 1000).toFixed(2);

  console.log(`========== 会话 ${s}：${n} 行，约 ${dur} 秒 ==========`);

  // 1) 鼠标总位移 vs 窗口总位移（同一坐标系，主进程）→ 漂移
  const dmx = last.mx - first.mx, dmy = last.my - first.my;
  const dwx = last.wx - first.wx, dwy = last.wy - first.wy;
  console.log(`\n[1] 鼠标位移 (主进程坐标): (${fmt(dmx)} , ${fmt(dmy)})`);
  console.log(`    窗口位移 (getPosition): (${fmt(dwx)} , ${fmt(dwy)})`);
  console.log(`    净漂移 (窗口-鼠标)     : (${fmt(dwx - dmx)} , ${fmt(dwy - dmy)})   ← 0 表示 1:1 跟手`);

  // 2) 逐事件比值 winDx/cursorDx（真实 k）
  const ratiosX = [], ratiosY = [];
  for (let i = 1; i < n; i++) {
    const cdx = R[i].mx - R[i - 1].mx, cdy = R[i].my - R[i - 1].my;
    const wdx = R[i].wx - R[i - 1].wx, wdy = R[i].wy - R[i - 1].wy;
    if (Math.abs(cdx) >= 2) ratiosX.push(wdx / cdx);
    if (Math.abs(cdy) >= 2) ratiosY.push(wdy / cdy);
  }
  console.log(`\n[2] 实际换算比 窗口位移/鼠标位移（应≈1）：`);
  console.log(`    X: ${rng(ratiosX)}`);
  console.log(`    Y: ${rng(ratiosY)}`);

  // 3) setPosition 目标 vs 实际位置
  const dtX = [], dtY = [];
  for (const r of R) { dtX.push(r.wx - r.tx); dtY.push(r.wy - r.ty); }
  console.log(`\n[3] 实际位置 - 目标位置（0 = setPosition 精确落地）：`);
  console.log(`    X: ${rng(dtX)}  Y: ${rng(dtY)}`);

  // 4) 渲染端坐标 vs 主进程坐标（偏移是否恒定 → 是否同一空间）
  const offX = [], offY = [];
  for (const r of R) { if (r.mx >= 0) { offX.push(r.mx - r.rx); offY.push(r.my - r.ry); } }
  console.log(`\n[4] 主进程鼠标 - 渲染端screenX（恒定=同空间平移；随位置变化=空间不一致）：`);
  console.log(`    X: ${rng(offX)}  Y: ${rng(offY)}`);
  if (offX.length > 1) {
    const spanX = Math.max(...offX) - Math.min(...offX);
    const spanY = Math.max(...offY) - Math.min(...offY);
    console.log(`    极差 X=${fmt(spanX)} Y=${fmt(spanY)}  （<2 视为同空间；>>0 说明坐标系不一致）`);
  }

  // 5) 窗口尺寸：getSize vs getBounds，是否在变
  const szW = new Set(R.map(r => r.sz_w)), szH = new Set(R.map(r => r.sz_h));
  const bndW = new Set(R.map(r => r.bnd_w)), bndH = new Set(R.map(r => r.bnd_h));
  console.log(`\n[5] 窗口尺寸读数：`);
  console.log(`    getSize  width: ${[...szW].slice(0, 6).join(" → ") || "-"}${szW.size > 6 ? " …" : ""}  (共${szW.size}个不同值)`);
  console.log(`    getSize  height: ${[...szH].slice(0, 6).join(" → ") || "-"}${szH.size > 6 ? " …" : ""}  (共${szH.size}个不同值)`);
  console.log(`    getBounds width: ${[...bndW].slice(0, 6).join(" → ") || "-"}${bndW.size > 6 ? " …" : ""}  (共${bndW.size}个不同值)`);
  console.log(`    getBounds height: ${[...bndH].slice(0, 6).join(" → ") || "-"}${bndH.size > 6 ? " …" : ""}  (共${bndH.size}个不同值)`);
  if (szW.size > 1 || szH.size > 1 || bndW.size > 1 || bndH.size > 1) {
    console.log(`    ⚠️ 尺寸在读数是变化的！窗口可能真的在被拉伸，或 API 读数异常`);
  }

  // 6) 自校准 k 的收敛轨迹
  console.log(`\n[6] 自校准 k 轨迹（前8/后8）：`);
  console.log(`    kx: ${R.slice(0, 8).map(r => r.kx.toFixed(2)).join(", ")} ... ${R.slice(-8).map(r => r.kx.toFixed(2)).join(", ")}`);
  console.log(`    ky: ${R.slice(0, 8).map(r => r.ky.toFixed(2)).join(", ")} ... ${R.slice(-8).map(r => r.ky.toFixed(2)).join(", ")}`);

  // 7) 窗口尺寸变化率（若 bnd 变化，算趋势）
  if (bndW.size > 1) {
    const trend = (last.bnd_w - first.bnd_w) / (dur > 0 ? dur : 1);
    console.log(`\n[7] getBounds 宽度变化率: ${fmt(trend, 2)} px/秒`);
  }

  console.log(`\n首行: ${JSON.stringify(first)}`);
  console.log(`末行: ${JSON.stringify(last)}\n`);
}
