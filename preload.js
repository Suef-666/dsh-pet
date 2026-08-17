// dsh-pet 主窗口 preload：桌面宠物窗口的创建与窗口控制（参考 uTools「挂件」插件机制）。
//  - utools.createBrowserWindow：uTools 官方 API，创建无边框透明置顶悬浮窗
//  - 主页面把 dsh 注意力事件（postMessage 从内嵌 iframe 收到）转发给所有桌宠窗口
const { ipcRenderer } = require("electron");

window.ipcRenderer = ipcRenderer;

// ── 拖拽日志（调试用）：记录同一时刻的窗口位置与鼠标位置，供离线分析 ──
// 日志文件：插件目录下 drag-log.csv（不可写时退回系统临时目录）
let logPath = "";
let logBuf = "";
let logTimer = null;
function initLog() {
  try {
    const fs = require("fs");
    const path = require("path");
    logPath = path.join(__dirname, "drag-log.csv");
    fs.writeFileSync(logPath, "# t_ms, wx, wy, tx, ty, mx, my, rx, ry, cx, cy, kx, ky, sz_w, sz_h, bnd_w, bnd_h, sb_ms\n");
  } catch {
    try {
      const fs = require("fs");
      const path = require("path");
      const os = require("os");
      logPath = path.join(os.tmpdir(), "dsh-pet-drag-log.csv");
      fs.writeFileSync(logPath, "# t_ms, wx, wy, tx, ty, mx, my, rx, ry, cx, cy, kx, ky, sz_w, sz_h, bnd_w, bnd_h, sb_ms\n");
    } catch { logPath = ""; }
  }
}
function logWrite(line) {
  if (!logPath) return;
  logBuf += line + "\n";
  if (logTimer) return;
  logTimer = setTimeout(() => {
    logTimer = null;
    if (!logBuf) return;
    const chunk = logBuf;
    logBuf = "";
    try { require("fs").appendFile(logPath, chunk, () => {}); } catch {}
  }, 300);
}
function logFlushNow() {
  if (logTimer) { clearTimeout(logTimer); logTimer = null; }
  if (!logBuf || !logPath) return;
  const chunk = logBuf;
  logBuf = "";
  try { require("fs").appendFile(logPath, chunk, () => {}); } catch {}
}
initLog();

// 尺寸看门狗：uTools 内容适配会在任意窗口交互（含非拖拽的鼠标悬停）时拉伸窗口，
// 每 500ms 检查一次，偏离创建尺寸即拉回
setInterval(() => {
  for (const win of wins) {
    const ew = (win.__petSize && win.__petSize[0]) || 220;
    const eh = (win.__petSize && win.__petSize[1]) || 480;
    try {
      const s = win.getSize();
      if (Math.abs(s[0] - ew) > 2 || Math.abs(s[1] - eh) > 2) {
        win.setSize(ew, eh);
        logWrite("# watchdog resize -> " + ew + "x" + eh);
      }
    } catch {}
  }
}, 500);

// 主进程权威光标（仅日志用；与 win.getPosition() 同坐标系）
const screenApi = (() => {
  try {
    const s = require("electron").screen;
    return s && typeof s.getCursorScreenPoint === "function" ? s : null;
  } catch { return null; }
})();

let wins = [];
/** 是否已有桌宠窗口（避免重复创建）。 */
window.hasPetWindow = () => wins.length > 0;
/** 关闭全部桌宠窗口（创建前调用，保证桌宠始终运行最新代码）。 */
window.closeAllPets = () => {
  for (const win of wins) {
    try { win.destroy(); } catch {}
  }
  wins = [];
};

/** 创建一个桌宠悬浮窗。option: { url, width, height, x, y, alwaysOnTop } */
window.createPetWin = (option = {}) => {
  return new Promise((resolve, reject) => {
    const petWindow = utools.createBrowserWindow(
      option.url + "index.html",
      {
        title: "dsh-pet",
        frame: false,
        backgroundColor: "rgba(0,0,0,0)",
        transparent: true,
        titleBarStyle: "hidden",
        resizable: false,
        width: option.width || 220,
        height: option.height || 480,
        x: option.x || 300,
        y: option.y || 300,
        webPreferences: {
          preload: option.url + "preload.js",
          spellcheck: false,
        },
      },
      () => {
        petWindow.setBackgroundColor("rgba(0,0,0,0)");
        petWindow.show();
        petWindow.setSkipTaskbar(true); // 桌面挂件不进任务栏
        petWindow.setAlwaysOnTop(option.alwaysOnTop !== false, "pop-up-menu");
        ipcRenderer.sendTo(petWindow.webContents.id, "senderId");
        // 记录创建尺寸：拖拽期间发现窗口被外部拉伸时用它拉回
        petWindow.__petSize = [option.width || 220, option.height || 480];
        wins.push(petWindow);
        resolve(petWindow);
      },
    );
  });
};

const winItem = (event) => wins.find((w) => w.webContents.id === event.senderId);

// 每个桌宠窗口的拖拽状态（仅拖拽期间存在）
//  - P0: 拖拽开始时的窗口位置（主进程坐标，锚点）
//  - S0: 按下时光标的屏幕位置（渲染进程坐标）
//  - kx/ky: 渲染进程 CSS px → 主进程坐标单位的换算。
//           ⚠️ 不依赖 getSize()/innerWidth（该 API 在本环境实测返回不可靠值，
//           会随窗口位置变化——见 661x915 遥测），初始为 1，完全由
//           “窗口位置在两种坐标系下的增量之比”自校准。
const dragState = new WeakMap();

// 桌宠窗口的控制指令（来自 pet 页面经 pet/preload.js 转发）
ipcRenderer.on("pet", (event, type, data) => {
  const win = winItem(event);
  if (!win) return;
  switch (type) {
    case "close": {
      wins = wins.filter((w) => w !== win);
      dragState.delete(win);
      win.destroy();
      break;
    }
    case "alwaysOnTop": {
      win.setAlwaysOnTop(!win.isAlwaysOnTop(), "pop-up-menu");
      event.sender.sendTo(event.senderId, "isAlwaysOnTop", win.isAlwaysOnTop());
      break;
    }
    case "dragStart": {
      // 锚点式：窗口位置 = P0 + (光标屏幕移动) × k，拖拽期间绝不回读 getPosition 定位
      // → 无“读回-修正”复合，任何坐标系误差都只是常数偏移，不累积 → 不会稳定下沉
      const p0 = win.getPosition();
      // 拖拽开始时也把尺寸回正（此前可能已被悬停交互拉伸）
      const ew = (win.__petSize && win.__petSize[0]) || 220;
      const eh = (win.__petSize && win.__petSize[1]) || 480;
      try {
        const s = win.getSize();
        if (Math.abs(s[0] - ew) > 2 || Math.abs(s[1] - eh) > 2) win.setSize(ew, eh);
      } catch {}
      dragState.set(win, {
        P0: p0,
        S0: { x: data.sx, y: data.sy },
        kx: 1, ky: 1,             // 初始 1，随后自校准（收紧：慢速微调，防抖动）
        prevR: null, prevM: null, // 自校准采样（渲染端窗口屏幕位置 / 主进程位置）
        last: null,               // 上次应用的窗口位置（防重复）
        pending: null,            // 最新待应用目标（最新优先）
        flushTimer: null,         // flush 定时器
        lastEvent: null,          // 最近一次事件的渲染端坐标（供日志）
      });
      logWrite("# session start @" + Date.now());
      break;
    }
    case "dragMove": {
      const st = dragState.get(win);
      if (!st) return;
      // 自校准换算比：渲染端视角的窗口屏幕位置 R = screenX - clientX，
      // 主进程视角 getPosition()；两者增量之比 = 真实换算 k。
      // 收紧：|dR|>=8 才更新、学习率 0.05、限幅 [0.6, 1.67] —— k 保持稳定，避免跟手忽快忽慢。
      const Rnow = { x: data.sx - data.cx, y: data.sy - data.cy };
      const Mnow = win.getPosition();
      if (st.prevR !== null && (Rnow.x !== st.prevR.x || Rnow.y !== st.prevR.y)) {
        const dRx = Rnow.x - st.prevR.x, dRy = Rnow.y - st.prevR.y;
        const dMx = Mnow[0] - st.prevM[0], dMy = Mnow[1] - st.prevM[1];
        if (Math.abs(dRx) >= 8) { const o = dMx / dRx; if (o > 0.6 && o < 1.67) st.kx = st.kx * 0.95 + o * 0.05; }
        if (Math.abs(dRy) >= 8) { const o = dMy / dRy; if (o > 0.6 && o < 1.67) st.ky = st.ky * 0.95 + o * 0.05; }
      }
      st.prevR = Rnow;
      st.prevM = Mnow;
      // 锚点式定位：target = P0 + (光标屏幕移动) × k（纯函数，无累积误差）。
      // 最新优先：只记录目标，由 flushDrag 统一应用——高频事件合并，队列不积压，
      // 窗口永远追最新光标位置（最小化拖尾延迟）。
      st.lastEvent = { sx: data.sx, sy: data.sy, cx: data.cx, cy: data.cy };
      st.pending = [
        st.P0[0] + Math.round((data.sx - st.S0.x) * st.kx),
        st.P0[1] + Math.round((data.sy - st.S0.y) * st.ky),
      ];
      if (!st.flushTimer) st.flushTimer = setTimeout(() => flushDrag(win, st), 1);
      break;
    }
    case "dragEnd": {
      const st = dragState.get(win);
      if (st) {
        if (st.flushTimer) { clearTimeout(st.flushTimer); st.flushTimer = null; }
        flushDrag(win, st); // 应用最后一次目标
      }
      dragState.delete(win);
      logWrite("# session end @" + Date.now());
      logFlushNow();
      break;
    }
  }
});

/** 应用最新拖拽目标：setBounds（位置+尺寸回正），并记录日志。 */
function flushDrag(win, st) {
  st.flushTimer = null;
  if (!st.pending) return;
  const [tx, ty] = st.pending;
  st.pending = null;
  if (st.last && tx === st.last[0] && ty === st.last[1]) return;
  st.last = [tx, ty];
  // uTools 内容适配会在每次交互把窗口撑大 ~1px（见 drag-log.csv：尺寸随拖拽事件
  // 线性增长 224x481→1016x1233），必须用 setBounds 同时回正位置与创建尺寸。
  const ew = (win.__petSize && win.__petSize[0]) || 220;
  const eh = (win.__petSize && win.__petSize[1]) || 480;
  const t0 = Date.now();
  try {
    win.setBounds({ x: tx, y: ty, width: ew, height: eh });
  } catch {
    try { win.setPosition(tx, ty); win.setSize(ew, eh); } catch {}
  }
  const sbMs = Date.now() - t0;
  // 日志：窗口位置 / 目标 / 主进程鼠标 / 渲染端鼠标 / clientX/Y / k / 尺寸 / setBounds耗时
  try {
    const pos = win.getPosition();
    let mx = -1, my = -1;
    if (screenApi) { const c = screenApi.getCursorScreenPoint(); mx = c.x; my = c.y; }
    const s = win.getSize();
    const b = win.getBounds();
    const ev = st.lastEvent || { sx: -1, sy: -1, cx: -1, cy: -1 };
    logWrite([
      Date.now(), pos[0], pos[1], tx, ty, mx, my, ev.sx, ev.sy, ev.cx, ev.cy,
      st.kx.toFixed(4), st.ky.toFixed(4), s[0], s[1],
      b ? b.width : -1, b ? b.height : -1, sbMs,
    ].join(","));
  } catch {}
}
