# SOXL Music Player (半导体音乐播放器)

> **项目简介**：
> SOXL Music 是一款致力于提供极致视觉体验的纯静态 Web 音乐播放器。它彻底摒弃了臃肿的 Node.js 或 Serverless 后端依赖，完全依靠前端引擎直接调用公开 API。
> 它拥有极度丝滑的阻尼歌词滚动、无缝音质切换、高级的“空气感”卡片排版，以及完全自定义的莫兰迪色系主题。只需部署到任何静态页面托管服务（如 Cloudflare Pages, GitHub Pages），即可随时随地享受沉浸式的音乐体验。（原名Semiconductor Music Player）

<br>![截图](https://github.com/upleung/SOXL-Music/blob/main/img/WebScr1.png)<br>
<br>![截图](https://github.com/upleung/SOXL-Music/blob/main/img/WebScr2.png)<br>
<br>![截图](https://github.com/upleung/SOXL-Music/blob/main/img/WebScr3.png)<br>
<br>![截图](https://github.com/upleung/SOXL-Music/blob/main/img/WebScr4.png)<br>
<br>![截图](https://github.com/upleung/SOXL-Music/blob/main/img/WebScr5.png)<br>
<br>![截图](https://github.com/upleung/SOXL-Music/blob/main/img/WebScr6.png)<br>


## 🌟 核心特性

- 🍎 **极致视觉 (Apple Liquid Glass UI)**：深度还原 iOS 液态毛玻璃与全局亚克力面板，拥有完美的景深防穿透设计和极具呼吸感的卡片排版。
- ⚡ **零服务器依赖 (Serverless-Free)**：完全纯前端架构，无需部署后端，告别跨域 404 和复杂的容器配置。
- 🎵 **多音源直连**：聚合网易云、QQ音乐、酷我、JOOX、Bilibili 等多平台音源，支持 24Bit 高解析度无损音质无缝切换。
- 🎤 **KTV级沉浸歌词**：独创防冲突状态锁算法，支持高精度毫秒级逐行滚动，并允许用户随时滑动预览歌词而不被强行回弹卡死。
- 📡 **音乐雷达 (Radar)**：一键从云端拉取优质榜单与私人推荐，瞬间注满播放队列。
- 🎨 **动态主题引擎**：内置 6 款高级莫兰迪色系（iOS蓝、薄荷绿、树莓红、丁香紫等），配合智能日夜模式，支持实时全局渲染。
- 💾 **本地化数据持久**：播放队列与我的收藏利用纯净的 localStorage 进行持久化，支持配置的一键导出导入 (JSON 格式)，数据掌握在自己手中。
- ⬇️ **原画级下载**：内置高解析音频嗅探，一键获取无损音频直链并启动浏览器原生下载。

---

## 📸 界面预览

### 1. 现代化主页与空气感排版

深度优化的搜索框与播放队列，列表/搜索结果采用分离平面切换，互不干扰。

### 2. 沉浸式全屏歌词页

超大圆角独立封面，搭配强力高斯模糊底层，防透视且极具景深感。

### 3. 多音源搜索与多音质切换

支持跨平台搜索与最高 24Bit 无损解析，极致 UI 绝不遮挡。

### 4. 音乐雷达与个性化主题

一键拉取热门榜单，随心切换莫兰迪高级色系。

---

## 🚀 部署与使用

由于 SOXL Music 采用了**纯前端架构**，使用起来极其简单：

### 方法一：极简静态托管 (推荐)

直接将本仓库代码上传至任何提供静态网页托管的服务即可，例如：

* [Cloudflare Pages](https://pages.cloudflare.com/) (推荐，速度极快)
* [GitHub Pages](https://pages.github.com/)
* [Vercel](https://vercel.com/)
* [Netlify](https://netlify.com/)

**构建配置参考：**

* **构建命令 (Build command)**: 留空 (不需要构建)
* **输出目录 (Build output directory)**: `/` (根目录即可)

---

## 📂 项目文件结构

```text
SOXL-Music/
├── index.html                 # 主界面 UI 骨架 (核心入口)
├── css/
│   └── style.css              # 全局样式 (iOS 26 亚克力质感/动画/排版)
├── js/
│   ├── index.js               # 核心引擎 (API 请求/播放器逻辑/localStorage 持久化)
│   ├── ui-controller.js       # 视觉中枢 (事件拦截/主题切换/歌词防抖滚动)
│   └── i18n.js                # 国际化语言支持 (如有)
├── img/                       # README 说明截图资源
├── favicon.png                # 网站图标
└── README.md                  # 项目说明文档

```

---

## 🤝 参与贡献与致谢

* 💖 **特别感谢**：[GD音乐台 (music.gdstudio.xyz)](https://music.gdstudio.xyz) 提供的极其稳定且强大的全网音乐聚合 API 解析支持。
* 💡 **灵感来源**：感谢来自 **akudamatata/Solara** [https://github.com/akudamatata/Solara](https://github.com/akudamatata/Solara) 提供的前期灵感与优秀的 UI 设计思路。

---

## ⚠️ 免责声明

1. 本项目 API 完全开源，数据来源于 [GD音乐台 (music.gdstudio.xyz)](https://music.gdstudio.xyz)。
2. 本项目**仅供前端代码学习、UI/UX 设计交流及个人研究使用**，未进行任何商业化运营。
3. **请尊重版权，支持正版音乐噢！**

---
