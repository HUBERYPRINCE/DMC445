# DMC 445 · 循轨光学选钻工坊 (Optical Atelier)

高定黑曜石丝绒与香槟金视觉体系打造的 **DMC 445 全色系 3D 光学配钻与循轨选钻工作台**，融合 Inspira UI 风格 SVG 路径跑马灯与 60fps 实时 3D 切面渲染引擎。

- **在线访问（GitHub Pages）**：https://huberyprince.github.io/DMC445/
- **单文件离线版**：[dmc445-optical-atelier.html](./dmc445-optical-atelier.html)（零外部依赖，双击即开）

## 核心特性

- **Inspira UI 风格 SVG 路径跑马灯选钻舞台（`path-marquee.js`）**：支持 `经典回环 / 丝带波浪 / 无限光环` 三条雕塑路径、悬停弹簧阻尼减速（`slowdownOnHover`）、指针拖拽循轨与惯性滑行（`draggable`）、单击锁定检视与双击快捷加购。
- **60fps 3D 光学放大镜 & 全屏光学工作室（`diamond3d.js`）**：26 切面圆钻 / 25 切面方钻、6 种光学镀膜（普通 / AB / 仙尘 / 水晶 / 炫彩 / 夜光）、4 种光效、`单钻 / 方圆同台 / 双色 ΔE 对比 / 5×5 阵盘` 视图与 `1200×800` 高清 PNG 色卡生成。
- **专业配钻工具箱**：自定义 Hex / 吸管 `ΔE` 取色配钻、纯本地画稿图片像素量化配钻（Top-8 DMC）、智能 BOM 剪切板清单导入、自定义画布算钻器（快捷键 `G`）、`⌘K` 命令面板、本地方案存档与支持按号排序/逐项勾核/导出 Markdown & CSV / 打印的工厂拣货单。

## 本地预览与单文件打包

```bash
# 本地启动静态预览
python3 -m http.server 8080

# 重新构建 100% 离线单文件 HTML
python3 build_standalone.py
```
