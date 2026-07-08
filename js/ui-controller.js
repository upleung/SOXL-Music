/**
 * SOXL Music Pro - UI Interactivity Controller
 */
document.addEventListener("DOMContentLoaded", () => {
    
    // === 屏蔽所有多余的左下角提示框 ===
    window.showNotification = function() { return false; };

    // === 主题色强效注入 ===
    function applyCustomColor(color) {
        document.documentElement.style.setProperty('--primary-color', color, 'important');
        localStorage.setItem('soxl-custom-color', color);
        document.querySelectorAll('.current .playlist-item-title, .active').forEach(el => el.style.color = color);
    }
    const savedColor = localStorage.getItem('soxl-custom-color') || '#007AFF';
    applyCustomColor(savedColor);

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

    // === 日夜模式切换 ===
    const themeBtn = document.getElementById('customThemeToggleBtn');
    if(themeBtn) {
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

    // === 音源与音质下拉框防遮挡与数据挂载 ===
    const qMenu = document.getElementById('playerQualityMenu');
    const qLabel = document.getElementById('qualityLabel');
    document.getElementById('qualityToggle').addEventListener('click', (e) => {
        e.stopPropagation();
        qMenu.classList.toggle('show');
    });
    qMenu.addEventListener('click', (e) => {
        if(e.target.dataset.val) {
            qLabel.innerText = e.target.innerText;
            if(window.state) window.state.playbackQuality = e.target.dataset.val;
            localStorage.setItem('playbackQuality', e.target.dataset.val);
            qMenu.classList.remove('show');
        }
    });

    const sMenu = document.getElementById('sourceMenu');
    const sLabel = document.getElementById('sourceSelectLabel');
    document.getElementById('sourceSelectButton').addEventListener('click', (e) => {
        e.stopPropagation();
        sMenu.classList.toggle('show');
    });
    sMenu.addEventListener('click', (e) => {
        if(e.target.dataset.val) {
            sLabel.innerText = e.target.innerText;
            if(window.state) window.state.searchSource = e.target.dataset.val;
            localStorage.setItem('searchSource', e.target.dataset.val);
            sMenu.classList.remove('show');
        }
    });
    
    document.addEventListener('click', () => {
        qMenu.classList.remove('show');
        sMenu.classList.remove('show');
    });

    // === 搜索结果与播放队列独立平面切换 ===
    const searchInput = document.getElementById('searchInput');
    const playlistSection = document.getElementById('playlistSectionWrapper');
    const searchResults = document.getElementById('searchResults');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    searchInput.addEventListener('input', (e) => {
        if(e.target.value.trim().length > 0) {
            playlistSection.style.display = 'none'; // 隐藏播放列表
            searchResults.style.display = 'block';  // 展开搜索页
            clearSearchBtn.style.display = 'block'; 
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
    });

    // === 歌词阻尼防抢夺滑动算法 ===
    const lyricsScroll = document.getElementById('lyricsScroll');
    const lyricsContent = document.getElementById('lyricsContent');
    let isUserDragging = false;
    let dragTimer = null;

    if(lyricsScroll && lyricsContent) {
        lyricsScroll.addEventListener('scroll', () => {
            isUserDragging = true;
            clearTimeout(dragTimer);
            dragTimer = setTimeout(() => { isUserDragging = false; }, 3000); 
        });

        const lyricObserver = new MutationObserver(() => {
            if (isUserDragging) return; // 用户干预时，静默
            const activeLine = lyricsContent.querySelector('.current, .active');
            if (activeLine) {
                const targetTop = activeLine.offsetTop - (lyricsScroll.clientHeight / 2) + (activeLine.clientHeight / 2);
                lyricsScroll.scrollTo({ top: targetTop, behavior: 'smooth' });
            }
        });
        lyricObserver.observe(lyricsContent, { attributes: true, subtree: true, attributeFilter: ['class'] });
    }

    // === 沉浸式页面控制 ===
    const lyricScreen = document.getElementById("lyricScreen");
    const lyricBlurBg = document.getElementById("lyricBlurBg");
    const audio = document.getElementById("audioPlayer");
    const barCoverImg = document.getElementById("barCoverImg");

    document.getElementById("openLyricBtn").addEventListener("click", (e) => {
        if(e.target.closest('.favorite-toggle') || e.target.closest('.ctrl-btn')) return; 
        lyricScreen.classList.remove("hidden");
        document.body.style.overflow = 'hidden'; 
        lyricBlurBg.style.backgroundImage = `url(${barCoverImg.src})`;
    });
    document.getElementById("closeLyricBtn").addEventListener("click", () => {
        lyricScreen.classList.add("hidden");
        document.body.style.overflow = '';
    });

    audio.addEventListener("play", () => barCoverImg.classList.add("spinning"));
    audio.addEventListener("pause", () => barCoverImg.classList.remove("spinning"));
});
