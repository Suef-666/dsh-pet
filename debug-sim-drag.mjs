// 拖拽算法对比模拟（1D，x 轴）
// 环境建模：
//   - 渲染进程坐标系 R（CSS px），主进程坐标系 M，M = kTrue*R（kTrue 是真实换算）
//   - 主进程位置取整（setPosition 整数化）
//   - 用户光标沿 R 空间移动；窗口移动后 Windows 合成 mousemove（光标坐标不变）
// 算法：
//   oldClient     : clientX 增量 × ratio —— 反馈环（旧版 bug）
//   newErr        : 误差校正（拉回抓取点）+ 死区 —— 依赖回读位置，且 k 用错时振荡漂移
//   newAnchor     : 锚点式 —— target = P0 + (光标屏幕移动)*k，永不回读 → 无累积漂移
//   newAnchorCal  : 锚点式 + 用 (dM/dR) 自校准 k（kInit 用错也能自动修正）
function simulate(algorithm, { kTrue = 1, kInit = null, ratio = 1, steps = 60, mouseStart = 10, target = 110, windowStart = 0, holdIter = 0 } = {}) {
  let R = windowStart;              // 窗口位置（渲染进程坐标）
  let M = kTrue * R;                // 窗口位置（主进程坐标，真实）
  let g = mouseStart - R;           // 抓取点 clientX
  let dragging = false;
  let totalMoves = 0;
  const queue = [];
  // 锚点状态（真实代码在 mousedown 时设置：P0=窗口位置，S0=按下时光标屏幕位置）
  let A = M, S0 = mouseStart, lastT = null;
  let kUsed = kInit !== null ? kInit : kTrue; // 算法使用的换算（可能 ≠ kTrue）
  // 自校准状态
  let prevR = null, prevM = null;

  const moveTo = (targetM) => {
    if (lastT !== null && targetM === lastT) return;
    lastT = targetM;
    if (targetM === M) return;
    M = targetM;
    R = M / kTrue;                  // 真实窗口位置随之变化
    totalMoves++;
    queue.push(1);                  // 合成 mousemove（光标位置不变）
  };

  const onEvent = (P) => {
    P = Math.round(P);
    const clientX = Math.round(P - R);  // 渲染端报告的 clientX
    if (algorithm === "oldClient") {
      const dx = clientX - g;
      g = clientX;
      if (!dragging) { if (Math.abs(P - mouseStart) < 3) return; dragging = true; }
      if (dx !== 0) moveTo(Math.round(M + dx * ratio));
    } else if (algorithm === "newErr") {
      const d = clientX - g;
      if (!dragging) { if (Math.abs(P - mouseStart) < 3) return; dragging = true; }
      if (d !== 0) {
        const want = d * kUsed;
        if (Math.abs(want) < 1) return;
        moveTo(Math.round(M + want));
      }
    } else { // newAnchor / newAnchorCal
      if (!dragging) { if (Math.abs(P - mouseStart) < 3) return; dragging = true; }
      if (algorithm === "newAnchorCal") {
        // 自校准：窗口位置在两种坐标系下的增量之比 = 真实换算 k
        // 平滑 + 位移门槛：clientX 整数化带来量化噪声，|dR| 太小时不更新
        const Rnow = P - clientX;   // 渲染端视角的窗口屏幕位置
        const Mnow = M;             // 主进程视角（真实）
        if (prevR !== null && Rnow !== prevR) {
          const dR = Rnow - prevR, dM = Mnow - prevM;
          if (Math.abs(dR) >= 2) {
            const kObs = dM / dR;
            if (kObs > 0.1 && kObs < 10) kUsed = kUsed * 0.7 + kObs * 0.3;
          }
        }
        prevR = Rnow; prevM = Mnow;
      }
      moveTo(Math.round(A + (P - S0) * kUsed));
    }
  };

  for (let i = 1; i <= steps; i++) {
    const P = mouseStart + ((target - mouseStart) * i) / steps;
    onEvent(P);
    let guard = 0;
    while (queue.length && guard++ < 200000) { queue.shift(); onEvent(P); }
  }
  // 拖完后光标停住，验证不再有移动（反馈环免疫）
  if (holdIter > 0) {
    const P = Math.round(target);
    for (let i = 0; i < holdIter; i++) {
      let guard = 0;
      while (queue.length && guard++ < 2000) { queue.shift(); onEvent(P); }
      onEvent(P);
    }
  }
  return { R, M, totalMoves, kUsed };
}

const R = (o) => o.R.toFixed(3) + "（移动 " + o.totalMoves + " 次）";

console.log("=== 场景A：kTrue=1（常见），拖 10 → 110，期望 R=100 ===");
for (const a of ["oldClient", "newErr", "newAnchor"]) {
  console.log(a.padEnd(12), "→ R:", R(simulate(a, { kTrue: 1 })));
}

console.log("\n=== 场景B：kTrue=1.5（副屏 150%），期望 R=100（物理跟手）===");
for (const a of ["oldClient", "newErr", "newAnchor"]) {
  console.log(a.padEnd(12), "→ R:", R(simulate(a, { kTrue: 1.5, ratio: 1.5 })));
}

console.log("\n=== 场景F：kTrue=1 但 kInit=1.5（getSize 与 setPosition 不同坐标系导致测错）===");
console.log("     newErr      ：误差校正用错 k → 每轮振荡净漂移（“稳定下沉”机理）");
console.log("     newAnchorCal：锚点 + 自校准 → 修正 k，正确跟手");
{
  const e = simulate("newErr", { kTrue: 1, kInit: 1.5, steps: 60, target: 110 });
  const a = simulate("newAnchorCal", { kTrue: 1, kInit: 1.5, steps: 60, target: 110 });
  console.log("newErr      → R:", R(e), " k最终=", e.kUsed.toFixed(3));
  console.log("newAnchorCal→ R:", R(a), " k最终=", a.kUsed.toFixed(3), "（自校准收敛到 1）");
}

console.log("\n=== 场景G：kTrue=1.5 但 kInit=1（反向测错）===");
{
  const e = simulate("newErr", { kTrue: 1.5, kInit: 1, steps: 60, target: 110 });
  const a = simulate("newAnchorCal", { kTrue: 1.5, kInit: 1, steps: 60, target: 110 });
  console.log("newErr      → R:", R(e));
  console.log("newAnchorCal→ R:", R(a), " k最终=", a.kUsed.toFixed(3));
}

console.log("\n=== 场景D：拖完光标停住 3000 轮，锚点法是否稳定 ===");
{
  const o = simulate("newAnchor", { kTrue: 1.5, steps: 10, target: 40, holdIter: 3000 });
  console.log("newAnchor → R:", R(o), "（静止后不再移动 → 反馈环免疫）");
}
