/**
 * SOXL Music Pro - UI Interactivity Controller
 * 独立管理视觉与交互的控制台
 */
document.addEventListener("DOMContentLoaded", () => {
    
    // 1. 彻底切断原版恶心的通知弹窗
    window.showNotification = function() { return false; };

    // 2. 莫兰迪主题色强力注入系统
    function applyCustomColor(color) {
        document.documentElement.style.setProperty('--primary-color', color, 'important');
        localStorage.setItem('soxl-custom-color', color);
        // 动态覆盖目前正在高亮的列表项
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

    // 3. 昼夜液态玻璃切换
    const themeBtn = document.getElementById('customThemeToggleBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isDark = document.body.classList.contains('dark-mode');
            if (isDark) {
                document.body.classList.remove('dark-mode');
                document.body.removeAttribute('data-theme');
            } else {
                document.body.classList.add('dark-mode');
                document.body.setAttribute('data-theme', 'dark');
            }
        });
    }

    // 4. 下拉菜单数据穿透与排版交互
    const qMenu = document.getElementById('playerQualityMenu');
    const qLabel = document.getElementById('qualityLabel');
    document.getElementById('qualityToggle')?.addEventListener('click', (e) => {
        e.stopPropagation(); qMenu.classList.toggle('show');
    });
    qMenu?.addEventListener('click', (e) => {
        if(e.target.dataset.val) {
            qLabel.innerText = e.target.innerText;
            if (window.state) window.state.playbackQuality = e.target.dataset.val;
            localStorage.setItem('playbackQuality', e.target.dataset.val);
            qMenu.classList.remove('show');
        }
    });

    const sMenu = document.getElementById('sourceMenu');
    const sLabel = document.getElementById('sourceSelectLabel');
    
    // 初始化同步音源标签
    if(window.state && sMenu) {
        const activeSource = sMenu.querySelector(`[data-val="${window.state.searchSource}"]`);
        if(activeSource) sLabel.innerText = activeSource.innerText;
    }

    document.getElementById('sourceSelectButton')?.addEventListener('click', (e) => {
        e.stopPropagation(); sMenu.classList.toggle('show');
    });
    sMenu?.addEventListener('click', (e) => {
        if(e.target.dataset.val) {
            sLabel.innerText = e.target.innerText;
            if (window.state) window.state.searchSource = e.target.dataset.val;
            localStorage.setItem('searchSource', e.target.dataset.val);
            sMenu.classList.remove('show');
        }
    });
    
    document.addEventListener('click', () => {
        qMenu?.classList.remove('show'); sMenu?.classList.remove('show');
    });

    // 5. 搜索与队列的 "沉浸式视图切换"
    const searchInput = document.getElementById('searchInput');
    const playlistSection = document.getElementById('playlistSectionWrapper');
    const searchResults = document.getElementById('searchResults');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    searchInput?.addEventListener('input', (e) => {
        if (e.target.value.trim().length > 0) {
            playlistSection.style.display = 'none'; // 隐藏播放队列
            searchResults.style.display = 'block';  // 展开搜索卡片
            clearSearchBtn.style.display = 'block'; 
        } else {
            playlistSection.style.display = 'block';
            searchResults.style.display = 'none';
            clearSearchBtn.style.display = 'none';
        }
    });

    clearSearchBtn?.addEventListener('click', () => {
        searchInput.value = '';
        playlistSection.style.display = 'block';
        searchResults.style.display = 'none';
        clearSearchBtn.style.display = 'none';
    });

    // 6. 歌词滚动 "防打架" 算法
    const lyricsScroll = document.getElementById('lyricsScroll');
    const lyricsContent = document.getElementById('lyricsContent');
    let isUserDragging = false;
    let dragTimer = null;

    if (lyricsScroll && lyricsContent) {
        // 用户滚动时锁定追踪器
        lyricsScroll.addEventListener('scroll', () => {
            isUserDragging = true;
            clearTimeout(dragTimer);
            // 停止滚动 2.5 秒后释放控制权
            dragTimer = setTimeout(() => { isUserDragging = false; }, 2500); 
        });

        const lyricObserver = new MutationObserver(() => {
            if (isUserDragging) return; // 核心：用户看歌词时不打断
            const activeLine = lyricsContent.querySelector('.current, .active');
            if (activeLine) {
                const targetTop = activeLine.offsetTop - (lyricsScroll.clientHeight / 2) + (activeLine.clientHeight / 2);
                lyricsScroll.scrollTo({ top: targetTop, behavior: 'smooth' });
            }
        });
        lyricObserver.observe(lyricsContent, { attributes: true, subtree: true, attributeFilter: ['class'] });
    }

    // 7. 播放模式切换 (左右分离)
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

    // 8. 歌词面板与毛玻璃全屏调度
    const lyricScreen = document.getElementById("lyricScreen");
    const lyricBlurBg = document.getElementById("lyricBlurBg");
    const audio = document.getElementById("audioPlayer");
    const barCoverImg = document.getElementById("barCoverImg");

    document.getElementById("openLyricBtn")?.addEventListener("click", (e) => {
        // 排除对收藏按钮和控制按钮的误触
        if(e.target.closest('.favorite-toggle') || e.target.closest('.ctrl-btn')) return; 
        lyricScreen.classList.remove("hidden");
        document.body.style.overflow = 'hidden'; 
        lyricBlurBg.style.backgroundImage = `url(${barCoverImg.src})`;
    });
    
    document.getElementById("closeLyricBtn")?.addEventListener("click", () => {
        lyricScreen.classList.add("hidden");
        document.body.style.overflow = '';
    });

    // 小封面同频自转
    audio?.addEventListener("play", () => barCoverImg.classList.add("spinning"));
    audio?.addEventListener("pause", () => barCoverImg.classList.remove("spinning"));

    // 9. Tabs 切换
    const ptBtn = document.getElementById('playlistTab');
    const ftBtn = document.getElementById('favoritesTab');
    const playlistNode = document.getElementById('playlist');
    const favoritesNode = document.getElementById('favorites');

    if(ptBtn && ftBtn) {
        ptBtn.addEventListener('click', () => {
            ptBtn.classList.add('active'); ftBtn.classList.remove('active');
            playlistNode.removeAttribute('hidden'); favoritesNode.setAttribute('hidden', 'true');
        });
        ftBtn.addEventListener('click', () => {
            ftBtn.classList.add('active'); ptBtn.classList.remove('active');
            favoritesNode.removeAttribute('hidden'); playlistNode.setAttribute('hidden', 'true');
        });
    }
});
