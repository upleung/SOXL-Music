/**
 * SOXL Music Pro - UI & Logic Overhaul Controller
 * 针对问题1-10的终极拦截与修复脚本
 */
document.addEventListener("DOMContentLoaded", () => {
    
    // === 问题7: 终极屏蔽所有烦人的左下角提示语 ===
    // 拦截覆盖 index.js 中原有的 showNotification 函数
    window.showNotification = function(msg) { 
        console.log("拦截通知: " + msg); 
        return false; 
    };

    // === 问题1: 主题色强效注入机制 (解决不生效问题) ===
    function applyCustomColor(color) {
        // 利用 !important 强行覆盖最高权重
        document.documentElement.style.setProperty('--primary-color', color, 'important');
        const rgb = hexToRgb(color);
        if(rgb) document.documentElement.style.setProperty('--primary-color-rgb', rgb, 'important');
        localStorage.setItem('soxl-custom-color', color);

        // 强行刷一遍现有列表里被选中的字体颜色
        document.querySelectorAll('.current .playlist-item-title, .active').forEach(el => {
            el.style.color = color;
        });
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
    }

    // 初始化提取颜色
    const savedColor = localStorage.getItem('soxl-custom-color') || '#007AFF';
    applyCustomColor(savedColor);

    // 绑定调色板点击
    const paletteModal = document.getElementById('paletteModal');
    document.getElementById('openPaletteBtn').addEventListener('click', () => paletteModal.removeAttribute('aria-hidden'));
    document.getElementById('closePaletteBtn').addEventListener('click', () => paletteModal.setAttribute('aria-hidden', 'true'));
    
    document.querySelectorAll('.theme-color-item').forEach(item => {
        if(item.dataset.color === savedColor) item.classList.add('active');
        item.addEventListener('click', (e) => {
            applyCustomColor(e.target.dataset.color);
            document.querySelectorAll('.theme-color-item').forEach(i => i.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // === 问题2: 日夜模式彻底接管 ===
    const themeBtn = document.getElementById('customThemeToggleBtn');
    if(themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isDark = document.body.classList.contains('dark-mode');
            if (isDark) {
                document.body.classList.remove('dark-mode');
                document.body.removeAttribute('data-theme');
                localStorage.setItem('soxl-theme-mode', 'light');
            } else {
                document.body.classList.add('dark-mode');
                document.body.setAttribute('data-theme', 'dark');
                localStorage.setItem('soxl-theme-mode', 'dark');
            }
        });
    }

    // === 问题3: 音乐雷达联动修复 ===
    const radarBtn = document.getElementById('radarBtn');
    if(radarBtn) {
        radarBtn.addEventListener('click', () => {
            const checked = document.querySelectorAll('#radarGenreList input:checked');
            if(checked.length === 0) {
                // 如果没选偏好，强制弹窗要求配置
                document.getElementById('settingsModal').removeAttribute('aria-hidden');
            } else {
                // 如果有配置，通过代码触发底层原有的 loadOnlineMusic(true) 拉取推荐
                const loadBtn = document.getElementById('loadOnlineBtn');
                if(loadBtn) loadBtn.click(); 
                else if (typeof loadOnlineMusic === 'function') loadOnlineMusic(true);
            }
        });
    }

    // === 问题4: 音质与音源选项框绑定 ===
    const qMenu = document.getElementById('playerQualityMenu');
    const qLabel = document.getElementById('qualityLabel');
    if(qMenu && qLabel) {
        document.getElementById('qualityToggle').addEventListener('click', (e) => {
            e.stopPropagation();
            qMenu.classList.toggle('show');
        });
        qMenu.addEventListener('click', (e) => {
            if(e.target.dataset.val) {
                qLabel.innerText = e.target.innerText;
                if(window.state) window.state.currentQuality = e.target.dataset.val; // 接驳底层对象
                qMenu.classList.remove('show');
            }
        });
    }

    const sMenu = document.getElementById('sourceMenu');
    const sLabel = document.getElementById('sourceSelectLabel');
    if(sMenu && sLabel) {
        document.getElementById('sourceSelectButton').addEventListener('click', (e) => {
            e.stopPropagation();
            sMenu.classList.toggle('show');
        });
        sMenu.addEventListener('click', (e) => {
            if(e.target.dataset.val) {
                sLabel.innerText = e.target.innerText;
                if(window.state) window.state.currentSource = e.target.dataset.val; // 接驳底层对象
                sMenu.classList.remove('show');
            }
        });
    }
    document.addEventListener('click', () => {
        if(qMenu) qMenu.classList.remove('show');
        if(sMenu) sMenu.classList.remove('show');
    });

    // === 问题5: 搜索结果与播放列表的“隐藏/显示 切换关系” ===
    const searchInput = document.getElementById('searchInput');
    const playlistSection = document.getElementById('playlistSectionWrapper');
    const searchResults = document.getElementById('searchResults');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    if(searchInput && playlistSection && searchResults) {
        searchInput.addEventListener('input', (e) => {
            if(e.target.value.trim().length > 0) {
                playlistSection.style.display = 'none'; // 隐藏播放列表
                searchResults.style.display = 'block';  // 展开搜索页
                clearSearchBtn.style.display = 'block'; // 显示 X 按钮
            } else {
                playlistSection.style.display = 'block';
                searchResults.style.display = 'none';
                clearSearchBtn.style.display = 'none';
            }
        });

        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            playlistSection.style.display = 'block';
            searchResults.style.display = 'none';
            clearSearchBtn.style.display = 'none';
            document.getElementById('searchResultsList').innerHTML = ''; // 清空结果内容
        });
        
        // 兼容点击"搜索"按钮时的切换
        document.getElementById('searchBtn').addEventListener('click', () => {
            if(searchInput.value.trim().length > 0) {
                playlistSection.style.display = 'none';
                searchResults.style.display = 'block';
                clearSearchBtn.style.display = 'block';
            }
        });
    }

    // === 问题6: 歌词拖动自由化 (防自动回滚冲突) ===
    const lyricsScroll = document.getElementById('lyricsScroll');
    const lyricsContent = document.getElementById('lyricsContent');
    let isUserDragging = false;
    let dragTimer = null;

    if(lyricsScroll && lyricsContent) {
        // 1. 监听用户的手动滚动/触摸意图
        lyricsScroll.addEventListener('scroll', () => {
            isUserDragging = true;
            clearTimeout(dragTimer);
            // 滚动停止后 3 秒，恢复代码的自动跟踪
            dragTimer = setTimeout(() => { isUserDragging = false; }, 3000); 
        });

        // 2. 替代原来粗暴的 Observer，加入 isUserDragging 拦截
        const lyricObserver = new MutationObserver(() => {
            if (isUserDragging) return; // 【核心修复】用户正在看的时候，不准自动滚走！
            const activeLine = lyricsContent.querySelector('.current, .active');
            if (activeLine) {
                const containerHeight = lyricsScroll.clientHeight;
                const targetTop = activeLine.offsetTop - (containerHeight / 2) + (activeLine.clientHeight / 2);
                lyricsScroll.scrollTo({ top: targetTop, behavior: 'smooth' });
            }
        });
        lyricObserver.observe(lyricsContent, { attributes: true, subtree: true, attributeFilter: ['class'] });
    }

    // === 问题8: 左右分离的播放模式控制 (苹果双按钮式) ===
    let isShuffle = false;
    let loopMode = 'all'; // 'all' 或 'one'

    const shuffleBtn = document.getElementById('shuffleToggleBtn');
    const loopBtn = document.getElementById('playModeBtn');

    if(shuffleBtn && loopBtn) {
        // 右侧专门管：随机播放
        shuffleBtn.addEventListener('click', function() {
            isShuffle = !isShuffle;
            this.style.color = isShuffle ? 'var(--primary-color)' : 'var(--text-primary)';
            if(window.state) window.state.playMode = isShuffle ? 'shuffle' : (loopMode === 'one' ? 'loop-one' : 'loop');
        });

        // 左侧专门管：列表循环 / 单曲循环
        loopBtn.addEventListener('click', function() {
            loopMode = loopMode === 'all' ? 'one' : 'all';
            this.innerHTML = loopMode === 'one' ? '<i class="fas fa-repeat-1"></i>' : '<i class="fas fa-repeat"></i>';
            this.style.color = 'var(--primary-color)';
            if(window.state && !isShuffle) window.state.playMode = loopMode === 'one' ? 'loop-one' : 'loop';
        });
    }

    // --- 沉浸式歌词面板控制与封面同步 ---
    const lyricScreen = document.getElementById("lyricScreen");
    const lyricBlurBg = document.getElementById("lyricBlurBg");
    
    document.getElementById("openLyricBtn").addEventListener("click", (e) => {
        if(e.target.closest('.favorite-toggle') || e.target.closest('.ctrl-btn')) return; 
        lyricScreen.classList.remove("hidden");
        document.body.style.overflow = 'hidden'; 
        lyricBlurBg.style.backgroundImage = `url(${document.getElementById('barCoverImg').src})`;
    });
    document.getElementById("closeLyricBtn").addEventListener("click", () => {
        lyricScreen.classList.add("hidden");
        document.body.style.overflow = '';
    });

    const barCoverImg = document.getElementById("barCoverImg");
    const bigCoverImg = document.getElementById("bigCoverImg");
    const audio = document.getElementById("audioPlayer");

    const observer = new MutationObserver(() => {
        const hiddenImg = document.querySelector("#albumCover img");
        if (hiddenImg && hiddenImg.src) {
            barCoverImg.src = hiddenImg.src;
            bigCoverImg.src = hiddenImg.src;
            lyricBlurBg.style.backgroundImage = `url(${hiddenImg.src})`;
        }
    });
    const hiddenCoverContainer = document.getElementById("albumCover");
    if(hiddenCoverContainer) observer.observe(hiddenCoverContainer, { childList: true, subtree: true });

    const toggleSpin = () => {
        if(!audio.paused && !audio.ended && audio.src) barCoverImg.classList.add("spinning");
        else barCoverImg.classList.remove("spinning");
    };
    audio.addEventListener("play", toggleSpin);
    audio.addEventListener("pause", toggleSpin);
});
