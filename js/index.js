/**
 * SOXL Music Pro - Core Engine (Zero-Server Architecture)
 * 纯前端驱动核心，直接调用 music-api.gdstudio.xyz
 */

const API_BASE = "https://music-api.gdstudio.xyz/api.php";

// ==========================================
// 1. API 接口封装 (全面支持 Netease, Kuwo, Bilibili, Joox)
// ==========================================
const API = {
    // 基础请求处理
    async fetchJson(url) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const text = await response.text();
            try { return JSON.parse(text); } catch (e) { return text; }
        } catch (error) {
            console.error("API 请求中断:", error);
            return null;
        }
    },

    // 搜索音乐
    async search(keyword, source = "netease", page = 1) {
        const url = `${API_BASE}?types=search&source=${source}&name=${encodeURIComponent(keyword)}&count=30&pages=${page}`;
        const data = await this.fetchJson(url);
        if (!Array.isArray(data)) return [];
        return data.map(song => ({
            id: song.id,
            name: song.name,
            artist: Array.isArray(song.artist) ? song.artist.join(' / ') : song.artist,
            pic_id: song.pic_id || song.id,
            lyric_id: song.lyric_id || song.id,
            source: song.source || source
        }));
    },

    // 获取真实播放直链
    async getSongUrl(song, quality = "320") {
        const url = `${API_BASE}?types=url&id=${song.id}&source=${song.source}&br=${quality}`;
        const res = await this.fetchJson(url);
        // 兼容不同的 API 响应体格式，兜底返回原链接由浏览器自动处理 302
        if (res && res.url) return res.url;
        if (res && res.data && res.data.url) return res.data.url;
        return url; 
    },

    // 获取拼接地址
    getPicUrl: (song) => `${API_BASE}?types=pic&id=${song.pic_id}&source=${song.source}&size=500`,
    getLyricUrl: (song) => `${API_BASE}?types=lyric&id=${song.lyric_id}&source=${song.source}`,
    
    // 获取网易云榜单 (雷达专用)
    getPlaylist: async (id) => await API.fetchJson(`${API_BASE}?types=playlist&id=${id}`)
};

// ==========================================
// 2. 全局状态机与 DOM 映射
// ==========================================
window.state = {
    searchSource: localStorage.getItem('searchSource') || 'netease',
    playbackQuality: localStorage.getItem('playbackQuality') || '320',
    playMode: 'list', // list, loop-one, shuffle
    playlistSongs: JSON.parse(localStorage.getItem('playlistSongs') || '[]'),
    favoriteSongs: JSON.parse(localStorage.getItem('favoriteSongs') || '[]'),
    currentSong: null,
};

const dom = {
    audio: document.getElementById('audioPlayer'),
    playBtn: document.getElementById('playPauseBtn'),
    progress: document.getElementById('progressBar'),
    curTime: document.getElementById('currentTimeDisplay'),
    durTime: document.getElementById('durationDisplay'),
    
    searchBtn: document.getElementById('searchBtn'),
    searchInput: document.getElementById('searchInput'),
    searchList: document.getElementById('searchResultsList'),
    
    playlist: document.getElementById('playlistItems'),
    favorites: document.getElementById('favoriteItems'),
    lyrics: document.getElementById('lyricsContent'),
    radarBtn: document.getElementById('radarBtn'),
    favToggle: document.getElementById('currentFavoriteToggle'),
};

// ==========================================
// 3. 核心播放系统
// ==========================================
async function playSong(song) {
    if (!song) return;
    window.state.currentSong = song;
    
    // 更新 UI 信息
    document.getElementById('currentSongTitle').innerText = song.name;
    document.getElementById('currentSongArtist').innerText = song.artist;
    
    const coverUrl = API.getPicUrl(song);
    document.getElementById('barCoverImg').src = coverUrl;
    document.getElementById('bigCoverImg').src = coverUrl;
    
    updateFavoriteIcon(song);
    
    // 拉取真实音源并播放
    const actualUrl = await API.getSongUrl(song, window.state.playbackQuality);
    if (actualUrl) {
        dom.audio.src = actualUrl;
        dom.audio.play().catch(e => console.warn("自动播放拦截", e));
        dom.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    }

    // 拉取歌词
    const lyricData = await API.fetchJson(API.getLyricUrl(song));
    renderLyrics(lyricData && lyricData.lyric ? lyricData.lyric : "[00:00.00] 暂无歌词 / 纯音乐");
    
    renderPlaylist();
    renderFavorites();
}

dom.playBtn.addEventListener('click', () => {
    if (!dom.audio.src) {
        if (window.state.playlistSongs.length > 0) playSong(window.state.playlistSongs[0]);
        return;
    }
    if (dom.audio.paused) { 
        dom.audio.play(); dom.playBtn.innerHTML = '<i class="fas fa-pause"></i>'; 
    } else { 
        dom.audio.pause(); dom.playBtn.innerHTML = '<i class="fas fa-play"></i>'; 
    }
});

window.playNext = () => playAdjacent(1);
window.playPrevious = () => playAdjacent(-1);
document.getElementById('nextBtn')?.addEventListener('click', window.playNext);
document.getElementById('prevBtn')?.addEventListener('click', window.playPrevious);

function playAdjacent(dir) {
    const list = window.state.playlistSongs;
    if (list.length === 0) return;
    let idx = list.findIndex(s => s.id === window.state.currentSong?.id);
    
    if (window.state.playMode === 'shuffle') {
        idx = Math.floor(Math.random() * list.length);
    } else {
        idx = (idx + dir + list.length) % list.length;
    }
    playSong(list[idx]);
}

dom.audio.addEventListener('ended', () => {
    if (window.state.playMode === 'loop-one') {
        dom.audio.currentTime = 0; dom.audio.play();
    } else {
        window.playNext();
    }
});

dom.audio.addEventListener('timeupdate', () => {
    if (!dom.audio.duration) return;
    dom.progress.value = (dom.audio.currentTime / dom.audio.duration) * 100;
    dom.curTime.innerText = formatTime(dom.audio.currentTime);
    dom.durTime.innerText = formatTime(dom.audio.duration);
    syncLyrics(dom.audio.currentTime);
});

dom.progress.addEventListener('input', (e) => {
    if (dom.audio.duration) dom.audio.currentTime = (e.target.value / 100) * dom.audio.duration;
});

const volSlider = document.getElementById('volumeSlider');
if (volSlider) volSlider.addEventListener('input', (e) => dom.audio.volume = e.target.value);

// ==========================================
// 4. 搜索与渲染引擎
// ==========================================
dom.searchBtn.addEventListener('click', async () => {
    const keyword = dom.searchInput.value.trim();
    if (!keyword) return;
    
    dom.searchList.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--text-secondary);"><i class="fas fa-circle-notch fa-spin"></i> 正在深潜搜索中...</div>';
    
    const results = await API.search(keyword, window.state.searchSource);
    dom.searchList.innerHTML = '';
    
    if (results.length === 0) {
        dom.searchList.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--text-secondary);">暂无结果，请尝试更换音源。</div>';
        return;
    }

    results.forEach(song => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `<span class="search-result-title">${song.name}</span><span class="search-result-artist">${song.artist}</span>`;
        div.onclick = () => {
            if (!window.state.playlistSongs.find(s => s.id === song.id)) {
                window.state.playlistSongs.unshift(song);
                localStorage.setItem('playlistSongs', JSON.stringify(window.state.playlistSongs));
            }
            playSong(song);
            document.getElementById('clearSearchBtn')?.click(); // 自动关闭搜索
        };
        dom.searchList.appendChild(div);
    });
});

dom.searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') dom.searchBtn.click(); });

function renderPlaylist() {
    dom.playlist.innerHTML = '';
    window.state.playlistSongs.forEach((song, idx) => {
        const div = document.createElement('div');
        div.className = `playlist-item ${window.state.currentSong?.id === song.id ? 'current' : ''}`;
        div.innerHTML = `
            <span class="playlist-item-title">${song.name}</span>
            <span class="playlist-item-artist">${song.artist}</span>
            <button class="icon-btn danger" onclick="removeSong(event, ${idx})"><i class="fas fa-trash"></i></button>
        `;
        div.onclick = () => playSong(song);
        dom.playlist.appendChild(div);
    });
}

window.removeSong = (e, index) => {
    e.stopPropagation();
    window.state.playlistSongs.splice(index, 1);
    localStorage.setItem('playlistSongs', JSON.stringify(window.state.playlistSongs));
    renderPlaylist();
};

window.clearPlaylist = () => {
    window.state.playlistSongs = [];
    localStorage.removeItem('playlistSongs');
    renderPlaylist();
}

// ==========================================
// 5. 收藏夹系统
// ==========================================
function updateFavoriteIcon(song) {
    if (!song || !dom.favToggle) return;
    const isFav = window.state.favoriteSongs.find(s => s.id === song.id);
    if (isFav) {
        dom.favToggle.classList.add('is-active');
        dom.favToggle.innerHTML = '<i class="fas fa-heart"></i>';
        dom.favToggle.style.color = '#ff4d67';
    } else {
        dom.favToggle.classList.remove('is-active');
        dom.favToggle.innerHTML = '<i class="far fa-heart"></i>';
        dom.favToggle.style.color = 'var(--text-secondary)';
    }
}

dom.favToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const current = window.state.currentSong;
    if (!current) return;
    
    const idx = window.state.favoriteSongs.findIndex(s => s.id === current.id);
    if (idx !== -1) window.state.favoriteSongs.splice(idx, 1);
    else window.state.favoriteSongs.unshift(current);
    
    localStorage.setItem('favoriteSongs', JSON.stringify(window.state.favoriteSongs));
    updateFavoriteIcon(current);
    renderFavorites();
});

function renderFavorites() {
    if (!dom.favorites) return;
    dom.favorites.innerHTML = '';
    window.state.favoriteSongs.forEach((song, idx) => {
        const div = document.createElement('div');
        div.className = `playlist-item ${window.state.currentSong?.id === song.id ? 'current' : ''}`;
        div.innerHTML = `
            <span class="playlist-item-title">${song.name}</span>
            <span class="playlist-item-artist">${song.artist}</span>
            <button class="icon-btn danger" onclick="removeFavorite(event, ${idx})"><i class="fas fa-trash"></i></button>
        `;
        div.onclick = () => {
            if (!window.state.playlistSongs.find(s => s.id === song.id)) {
                window.state.playlistSongs.unshift(song);
                localStorage.setItem('playlistSongs', JSON.stringify(window.state.playlistSongs));
                renderPlaylist();
            }
            playSong(song);
        };
        dom.favorites.appendChild(div);
    });
}

window.removeFavorite = (e, index) => {
    e.stopPropagation();
    const song = window.state.favoriteSongs[index];
    window.state.favoriteSongs.splice(index, 1);
    localStorage.setItem('favoriteSongs', JSON.stringify(window.state.favoriteSongs));
    renderFavorites();
    if (window.state.currentSong?.id === song.id) updateFavoriteIcon(window.state.currentSong);
};

// ==========================================
// 6. 音乐雷达 (网易云榜单直连)
// ==========================================
if (dom.radarBtn) {
    dom.radarBtn.addEventListener('click', async () => {
        const playlistIds = ["3778678", "3779629", "2884035", "19723756", "11641012"]; // 热歌/新歌/原创/飙升
        const randomId = playlistIds[Math.floor(Math.random() * playlistIds.length)];
        
        dom.radarBtn.classList.add('spinning');
        const data = await API.getPlaylist(randomId);
        dom.radarBtn.classList.remove('spinning');

        if (data && data.playlist && data.playlist.tracks) {
            window.state.playlistSongs = data.playlist.tracks.map(t => ({
                id: t.id, 
                name: t.name, 
                artist: t.ar ? t.ar.map(a=>a.name).join(' / ') : 'Unknown Artist',
                pic_id: t.al ? (t.al.pic_str || t.al.picUrl) : '', 
                lyric_id: t.id, 
                source: 'netease'
            }));
            localStorage.setItem('playlistSongs', JSON.stringify(window.state.playlistSongs));
            renderPlaylist();
            playSong(window.state.playlistSongs[0]);
            document.getElementById('clearSearchBtn')?.click();
        }
    });
}

// ==========================================
// 7. 歌词高精度引擎
// ==========================================
let parsedLyrics = [];

function renderLyrics(lrcString) {
    dom.lyrics.innerHTML = ''; parsedLyrics = [];
    const lines = lrcString.split('\n');
    lines.forEach(line => {
        const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
        if (match && match[4].trim()) {
            const time = parseInt(match[1]) * 60 + parseInt(match[2]) + parseFloat(`0.${match[3]}`);
            const div = document.createElement('div');
            div.innerText = match[4].trim();
            dom.lyrics.appendChild(div);
            parsedLyrics.push({ time, element: div });
        }
    });
    if (parsedLyrics.length === 0) dom.lyrics.innerHTML = '<div>纯音乐，请欣赏</div>';
}

function syncLyrics(time) {
    if (parsedLyrics.length === 0) return;
    let activeIdx = -1;
    for (let i = 0; i < parsedLyrics.length; i++) { 
        if (time >= parsedLyrics[i].time) activeIdx = i; 
    }
    if (activeIdx !== -1) {
        const currentActive = dom.lyrics.querySelector('.current');
        const targetElement = parsedLyrics[activeIdx].element;
        if (currentActive !== targetElement) {
            if (currentActive) currentActive.classList.remove('current');
            targetElement.classList.add('current');
        }
    }
}

function formatTime(s) {
    if (isNaN(s)) return "00:00";
    const mins = Math.floor(s / 60); const secs = Math.floor(s % 60);
    return `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
}

// ==========================================
// 8. 导入 / 导出系统
// ==========================================
function downloadJson(data, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
function handleJsonImport(event, callback) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) callback(data);
        } catch(err) { alert('JSON 格式错误'); }
    };
    reader.readAsText(file);
    event.target.value = '';
}

document.getElementById('exportPlaylistBtn')?.addEventListener('click', () => downloadJson(window.state.playlistSongs, 'SOXL_Playlist.json'));
document.getElementById('importPlaylistBtn')?.addEventListener('click', () => document.getElementById('importPlaylistInput').click());
document.getElementById('importPlaylistInput')?.addEventListener('change', (e) => {
    handleJsonImport(e, (data) => {
        window.state.playlistSongs = data;
        localStorage.setItem('playlistSongs', JSON.stringify(data));
        renderPlaylist();
    });
});

document.getElementById('exportFavoritesBtn')?.addEventListener('click', () => downloadJson(window.state.favoriteSongs, 'SOXL_Favorites.json'));
document.getElementById('importFavoritesBtn')?.addEventListener('click', () => document.getElementById('importFavoritesInput').click());
document.getElementById('importFavoritesInput')?.addEventListener('change', (e) => {
    handleJsonImport(e, (data) => {
        window.state.favoriteSongs = data;
        localStorage.setItem('favoriteSongs', JSON.stringify(data));
        renderFavorites();
    });
});

// 初始化启动
renderPlaylist();
renderFavorites();
