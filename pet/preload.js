// dsh-pet 桌宠窗口 preload：暴露 ipcRenderer 与窗口控制辅助
const { ipcRenderer } = require("electron");
window.ipcRenderer = ipcRenderer;

ipcRenderer.on("senderId", (event) => {
  window.senderId = event.senderId;
});

window.petAlwaysOnTop = () => ipcRenderer.sendTo(window.senderId, "pet", "alwaysOnTop");
window.petClose = () => ipcRenderer.sendTo(window.senderId, "pet", "close");
// 拖拽：上报生命周期与光标坐标，位置计算由主进程完成（锚点式，多屏/缩放免疫）
window.petDragStart = (p) => ipcRenderer.sendTo(window.senderId, "pet", "dragStart", p);
window.petDragMove = (p) => ipcRenderer.sendTo(window.senderId, "pet", "dragMove", p);
window.petDragEnd = () => ipcRenderer.sendTo(window.senderId, "pet", "dragEnd");
