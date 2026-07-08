/**
 * SOXL Music Pro - UI Interactivity Controller
 * 专门处理视觉、交互、选项卡与模态框
 */
document.addEventListener("DOMContentLoaded", () => {
    
    // 1. 莫兰迪主题色系统
    function applyCustomColor(color) {
        document.documentElement.style.setProperty('--primary-color', color, 'important');
        localStorage.setItem('soxl-custom-color', color);
        document.querySelectorAll('.current .playlist-item-title, .active').forEach(el => el.style.color = color);
    }
    
    const savedColor = localStorage.getItem('soxl-custom-color') || '#007AFF';
    applyCustomColor(savedColor);

    const paletteModal = document.getElementById('paletteModal');
    document.getElementById('openPaletteBtn')?.addEventListener('click', () => paletteModal.removeAttribute('aria-hidden'));
    document.getElementById('closePaletteBtn')?.addEventListener('click', () => paletteModal.setAttribute('aria-hidden', 'true'));
    
    document.querySelectorAll('.theme-color-item').forEach(item => {
        if(item.dataset.color === savedColor) item.classList.add('active');
        item.addEventListener('click', (e) => {
            applyCustomColor(e.target.dataset.color);
            document.querySelectorAll('.theme-color-item').forEach(i => i.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // 2. 昼夜模式
    const themeBtn = document.getElementById('customThemeToggleBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isDark = document.body.classList.contains('dark-mode');
            if (isDark) {
                document.body.classList.remove('dark-mode'); document.body.removeAttribute('data-theme');
            } else {
                document.body.classList.add('dark-mode'); document.body.setAttribute('data-theme', 'dark');
            }
        });
    }

    // 3. 修复 3：偏好设置模态框打开逻辑
    const settingsModal = document.getElementById('settingsModal');
    document.getElementById('openSettingsBtn')?.addEventListener('click', () => {
        settingsModal.removeAttribute('aria-hidden');
    });
    document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
        settingsModal.setAttribute('aria-hidden', 'true');
    });

    // 4. 音质与音源下拉控制 (完美触发引擎重载)
    const qMenu = document.getElementById('playerQualityMenu');
    const qLabel = document.getElementById('qualityLabel');
    document.getElementById('qualityToggle')?.addEventListener('click', (e) => { e.stopPropagation(); qMenu.classList.toggle('show'); });
    
    qMenu?.addEventListener('click', (e) => {
        if(e.target.dataset.val) {
            qLabel.innerText = e.target.innerText;
            if(window.changeQuality) window.changeQuality(e.target.dataset.val); // 调用 index.js 中的无缝切换
            qMenu.classList.remove('show');
        }
    });

    const sMenu = document.getElementById('sourceMenu');
    const sLabel = document.getElementById('sourceSelectLabel');
    document.getElementById('sourceSelectButton')?.addEventListener('click', (e) => { e.stopPropagation(); sMenu.classList.toggle('show'); });
    
    sMenu?.addEventListener('click', (e) => {
        if(e.target.dataset.val) {
            sLabel.innerText = e.target.innerText;
            if (window.state) window.state.searchSource = e.target.dataset.val;
            localStorage.setItem('searchSource', e.target.dataset.val);
            sMenu.classList.remove('show');
        }
    });
    
    document.addEventListener('click', () => { qMenu?.classList.remove('show'); sMenu?.classList.remove('show'); });

    // 5. 搜索卡片切换逻辑
    const searchInput = document.getElementById('searchInput');
    const playlistSection = document.getElementById('playlistSectionWrapper');
    const searchResults = document.getElementById('searchResults');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    searchInput?.addEventListener('input', (e) => {
        if (e.target.value.trim().length > 0) {
            playlistSection.style.display = 'none'; searchResults.style.display = 'block'; clearSearchBtn.style.display = 'block'; 
        } else {
            playlistSection.style.display = 'block'; searchResults.style.display = 'none'; clearSearchBtn.style.display = 'none';
        }
    });

    clearSearchBtn?.addEventListener('click', () => {
        searchInput.value = ''; playlistSection.style.display = 'block'; searchResults.style.display = 'none'; clearSearchBtn.style.display = 'none';
    });

    // 6. 修复 2：歌词拖动不卡死绝对解法
    const lyricsScroll = document.getElementById('lyricsScroll');
    const lyricsContent = document.getElementById('lyricsContent');
    let isUserDragging = false;
    let dragTimer = null;

    if (lyricsScroll && lyricsContent) {
        lyricsScroll.addEventListener('scroll', () => {
            isUserDragging = true;
            clearTimeout(dragTimer);
            // 停手后 3 秒放开滚动锁
            dragTimer = setTimeout(() => { isUserDragging = false; }, 3000); 
        });

        const lyricObserver = new MutationObserver(() => {
            if (isUserDragging) return; // 核心：用户看歌词时不打断
            const activeLine = lyricsContent.querySelector('.current, .active');
            if (activeLine) {
                // 确保在 lyrics-content 为 relative 定位时能获取精确偏移
                const targetTop = activeLine.offsetTop - (lyricsScroll.clientHeight / 2) + (activeLine.clientHeight / 2);
                lyricsScroll.scrollTo({ top: targetTop, behavior: 'smooth' });
            }
        });
        lyricObserver.observe(lyricsContent, { attributes: true, subtree: true, attributeFilter: ['class'] });
    }

    // 7. 播放模式切换
    let isShuffle = false;
    let loopMode = 'all';

    document.getElementById('shuffleToggleBtn')?.addEventListener('click', function() {
        isShuffle = !isShuffle;
        this.style.color = isShuffle ? 'var(--primary-color)' : 'var(--text-primary)';
        if (window.state) window.state.playMode = isShuffle ? 'shuffle' : (loopMode === 'one' ? 'loop-one' : 'list');
    });

    document.getElementById('playModeBtn')?.addEventListener('click', function() {
        loopMode = loopMode === 'all' ? 'one' : 'all';
        this.innerHTML = loopMode === 'one' ? '<i class="fas fa-repeat-1"></i>' : '<i class="fas fa-repeat"></i>';
        this.style.color = 'var(--primary-color)';
        if (window.state && !isShuffle) window.state.playMode = loopMode === 'one' ? 'loop-one' : 'list';
    });

    // 8. 歌词沉浸面板
    const lyricScreen = document.getElementById("lyricScreen");
    const lyricBlurBg = document.getElementById("lyricBlurBg");
    const audio = document.getElementById("audioPlayer");
    const barCoverImg = document.getElementById("barCoverImg");

    document.getElementById("openLyricBtn")?.addEventListener("click", (e) => {
        if(e.target.closest('.favorite-toggle') || e.target.closest('.ctrl-btn')) return; 
        lyricScreen.classList.remove("hidden");
        document.body.style.overflow = 'hidden'; 
        lyricBlurBg.style.backgroundImage = `url(${barCoverImg.src})`;
    });
    document.getElementById("closeLyricBtn")?.addEventListener("click", () => {
        lyricScreen.classList.add("hidden"); document.body.style.overflow = '';
    });

    audio?.addEventListener("play", () => barCoverImg.classList.add("spinning"));
    audio?.addEventListener("pause", () => barCoverImg.classList.remove("spinning"));

    // 9. 修复 4：播放列表 / 我的收藏 Tabs 切换逻辑重构
    const ptBtn = document.getElementById('playlistTab');
    const ftBtn = document.getElementById('favoritesTab');
    const playlistNode = document.getElementById('playlistItems');
    const favoritesNode = document.getElementById('favoriteItems');

    if (ptBtn && ftBtn) {
        ptBtn.addEventListener('click', () => {
            ptBtn.classList.add('active'); ftBtn.classList.remove('active');
            playlistNode.style.display = 'flex'; // grid/flex 显示
            favoritesNode.style.display = 'none';
        });
        ftBtn.addEventListener('click', () => {
            ftBtn.classList.add('active'); ptBtn.classList.remove('active');
            favoritesNode.style.display = 'flex'; 
            playlistNode.style.display = 'none';
        });
    }
});
