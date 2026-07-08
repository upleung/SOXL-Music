/**
 * SOXL Music Pro - Core Engine (Strict API Compliance)
 * 已修复：Pic JSON 解析、下载功能、音质生效同步
 */

const API_BASE = "https://music-api.gdstudio.xyz/api.php";

// 全局 Toast 提示函数
window.showToast = function(msg) {
    const toast = document.getElementById('toastNotification');
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
};

// ==========================================
// 1. 严格对应官方 API 的网络引擎
// ==========================================
const API = {
    async fetchJson(url) {
        try {
            const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!response.ok) throw new Error(response.status);
            return await response.json();
        } catch (error) {
            console.error("API Call Failed:", error);
            return null;
        }
    },

    async search(keyword, source = "netease", page = 1) {
        const url = `${API_BASE}?types=search&source=${source}&name=${encodeURIComponent(keyword)}&count=30&pages=${page}`;
        const data = await this.fetchJson(url);
        // API 有时返回数组，有时返回 { data: [...] }
        const list = Array.isArray(data) ? data : (data && data.data ? data.data : []);
        return list.map(song => ({
            id: song.id,
            name: song.name,
            artist: Array.isArray(song.artist) ? song.artist.join(' / ') : song.artist,
            pic_id: song.pic_id || song.id,
            lyric_id: song.lyric_id || song.id,
            source: song.source || source
        }));
    },

    // 修复 5：动态接受音质参数
    async getSongUrl(song, quality = "999") {
        const url = `${API_BASE}?types=url&source=${song.source}&id=${song.id}&br=${quality}`;
        const res = await this.fetchJson(url);
        return res && res.url ? res.url : null;
    },

    // 修复 1：API 返回的是 JSON，而不是直接的图片流！
    async getPicUrl(song) {
        const url = `${API_BASE}?types=pic&source=${song.source}&id=${song.pic_id}&size=500`;
        const res = await this.fetchJson(url);
        return res && res.url ? res.url : 'favicon.png';
    },
    
    // 获取歌词
    async getLyric(song) {
        const url = `${API_BASE}?types=lyric&source=${song.source}&id=${song.lyric_id}`;
        return await this.fetchJson(url);
    },
    
    // 随机雷达用的榜单 API
    getPlaylist: async (id) => await API.fetchJson(`${API_BASE}?types=playlist&id=${id}`)
};

// ==========================================
// 2. 状态机
// ==========================================
window.state = {
    searchSource: localStorage.getItem('searchSource') || 'netease',
    playbackQuality: localStorage.getItem('playbackQuality') || '999',
    playMode: 'list', 
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
    downloadBtn: document.getElementById('downloadBtn'),
    favToggle: document.getElementById('currentFavoriteToggle'),
};

// ==========================================
// 3. 核心播放与音质应用
// ==========================================
async function playSong(song, keepTime = 0) {
    if (!song) return;
    window.state.currentSong = song;
    
    document.getElementById('currentSongTitle').innerText = song.name;
    document.getElementById('currentSongArtist').innerText = song.artist;
    updateFavoriteIcon(song);

    // 异步加载并解析专辑图片
    const coverUrl = await API.getPicUrl(song);
    document.getElementById('barCoverImg').src = coverUrl;
    document.getElementById('bigCoverImg').src = coverUrl;
    
    // 应用当前选择的音质
    const actualUrl = await API.getSongUrl(song, window.state.playbackQuality);
    if (actualUrl) {
        dom.audio.src = actualUrl;
        if (keepTime > 0) dom.audio.currentTime = keepTime;
        dom.audio.play().catch(e => console.warn(e));
        dom.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        window.showToast("该音质无法获取音频，请尝试切换音质或音源");
    }

    // 只有非切换音质时，才重新渲染歌词
    if (keepTime === 0) {
        const lyricData = await API.getLyric(song);
        renderLyrics(lyricData && lyricData.lyric ? lyricData.lyric : "[00:00.00] 暂无歌词 / 纯音乐");
    }
    
    renderPlaylist(); renderFavorites();
}

dom.playBtn.addEventListener('click', () => {
    if (!dom.audio.src) {
        if (window.state.playlistSongs.length > 0) playSong(window.state.playlistSongs[0]);
        return;
    }
    if (dom.audio.paused) { dom.audio.play(); dom.playBtn.innerHTML = '<i class="fas fa-pause"></i>'; } 
    else { dom.audio.pause(); dom.playBtn.innerHTML = '<i class="fas fa-play"></i>'; }
});

window.playNext = () => playAdjacent(1);
window.playPrevious = () => playAdjacent(-1);
document.getElementById('nextBtn')?.addEventListener('click', window.playNext);
document.getElementById('prevBtn')?.addEventListener('click', window.playPrevious);

function playAdjacent(dir) {
    const list = window.state.playlistSongs;
    if (list.length === 0) return;
    let idx = list.findIndex(s => s.id === window.state.currentSong?.id);
    if (window.state.playMode === 'shuffle') idx = Math.floor(Math.random() * list.length);
    else idx = (idx + dir + list.length) % list.length;
    playSong(list[idx]);
}

dom.audio.addEventListener('ended', () => {
    if (window.state.playMode === 'loop-one') { dom.audio.currentTime = 0; dom.audio.play(); } 
    else window.playNext();
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
document.getElementById('volumeSlider')?.addEventListener('input', (e) => dom.audio.volume = e.target.value);

// 修复 5：音质切换立即生效引擎
window.changeQuality = async function(newQuality) {
    window.state.playbackQuality = newQuality;
    localStorage.setItem('playbackQuality', newQuality);
    
    // 如果当前有歌在放，记住时间，重新拉取链接实现无缝切换
    if (window.state.currentSong && !dom.audio.paused) {
        window.showToast(`正在切换音质并重新缓冲...`);
        const currentTime = dom.audio.currentTime;
        await playSong(window.state.currentSong, currentTime);
    } else {
        window.showToast("默认音质已切换配置");
    }
}


// ==========================================
// 4. 搜索与渲染引擎
// ==========================================
dom.searchBtn.addEventListener('click', async () => {
    const keyword = dom.searchInput.value.trim();
    if (!keyword) return;
    
    dom.searchList.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--text-secondary);"><i class="fas fa-circle-notch fa-spin"></i> 正在搜索...</div>';
    
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
            document.getElementById('clearSearchBtn')?.click(); 
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
        div.innerHTML = `<span class="playlist-item-title">${song.name}</span><span class="playlist-item-artist">${song.artist}</span><button class="icon-btn danger" onclick="removeSong(event, ${idx})"><i class="fas fa-trash"></i></button>`;
        div.onclick = () => playSong(song);
        dom.playlist.appendChild(div);
    });
}
window.removeSong = (e, index) => { e.stopPropagation(); window.state.playlistSongs.splice(index, 1); localStorage.setItem('playlistSongs', JSON.stringify(window.state.playlistSongs)); renderPlaylist(); };
document.getElementById('clearPlaylistBtn')?.addEventListener('click', () => { window.state.playlistSongs = []; localStorage.removeItem('playlistSongs'); renderPlaylist(); });


// ==========================================
// 5. 收藏夹系统
// ==========================================
function updateFavoriteIcon(song) {
    if (!song || !dom.favToggle) return;
    const isFav = window.state.favoriteSongs.find(s => s.id === song.id);
    if (isFav) {
        dom.favToggle.classList.add('is-active'); dom.favToggle.innerHTML = '<i class="fas fa-heart"></i>'; dom.favToggle.style.color = '#ff4d67';
    } else {
        dom.favToggle.classList.remove('is-active'); dom.favToggle.innerHTML = '<i class="far fa-heart"></i>'; dom.favToggle.style.color = 'var(--text-secondary)';
    }
}

dom.favToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const current = window.state.currentSong;
    if (!current) return;
    const idx = window.state.favoriteSongs.findIndex(s => s.id === current.id);
    if (idx !== -1) window.state.favoriteSongs.splice(idx, 1); else window.state.favoriteSongs.unshift(current);
    localStorage.setItem('favoriteSongs', JSON.stringify(window.state.favoriteSongs));
    updateFavoriteIcon(current); renderFavorites();
});

function renderFavorites() {
    if (!dom.favorites) return;
    dom.favorites.innerHTML = '';
    window.state.favoriteSongs.forEach((song, idx) => {
        const div = document.createElement('div');
        div.className = `playlist-item ${window.state.currentSong?.id === song.id ? 'current' : ''}`;
        div.innerHTML = `<span class="playlist-item-title">${song.name}</span><span class="playlist-item-artist">${song.artist}</span><button class="icon-btn danger" onclick="removeFavorite(event, ${idx})"><i class="fas fa-trash"></i></button>`;
        div.onclick = () => {
            if (!window.state.playlistSongs.find(s => s.id === song.id)) { window.state.playlistSongs.unshift(song); localStorage.setItem('playlistSongs', JSON.stringify(window.state.playlistSongs)); renderPlaylist(); }
            playSong(song);
        };
        dom.favorites.appendChild(div);
    });
}
window.removeFavorite = (e, index) => { e.stopPropagation(); const song = window.state.favoriteSongs[index]; window.state.favoriteSongs.splice(index, 1); localStorage.setItem('favoriteSongs', JSON.stringify(window.state.favoriteSongs)); renderFavorites(); if (window.state.currentSong?.id === song.id) updateFavoriteIcon(window.state.currentSong); };


// ==========================================
// 6. 音乐雷达 与 下载功能 (新增)
// ==========================================
if (dom.radarBtn) {
    dom.radarBtn.addEventListener('click', async () => {
        window.showToast("雷达启动中，为您拉取优选榜单...");
        const playlistIds = ["3778678", "3779629", "2884035", "19723756"]; // 网易云优选榜单
        const randomId = playlistIds[Math.floor(Math.random() * playlistIds.length)];
        const data = await API.getPlaylist(randomId);
        if (data && data.playlist && data.playlist.tracks) {
            window.state.playlistSongs = data.playlist.tracks.map(t => ({
                id: t.id, name: t.name, artist: t.ar ? t.ar.map(a=>a.name).join(' / ') : 'Unknown Artist',
                pic_id: t.al ? (t.al.pic_str || t.al.picUrl) : '', lyric_id: t.id, source: 'netease'
            }));
            localStorage.setItem('playlistSongs', JSON.stringify(window.state.playlistSongs));
            renderPlaylist(); playSong(window.state.playlistSongs[0]);
            document.getElementById('clearSearchBtn')?.click();
            window.showToast("榜单已加载完毕！");
        }
    });
}

if (dom.downloadBtn) {
    dom.downloadBtn.addEventListener('click', async () => {
        const song = window.state.currentSong;
        if (!song) return window.showToast("没有正在播放的歌曲");
        window.showToast("正在解析高品质下载直链...");
        const url = await API.getSongUrl(song, window.state.playbackQuality);
        if (!url) return window.showToast("无法获取下载链接");
        
        window.showToast("开始下载...");
        const a = document.createElement('a');
        a.href = url;
        // 注意：受限于浏览器的跨域下载安全策略，此操作会自动新开标签页进行文件下载
        a.download = `${song.name} - ${song.artist}.mp3`;
        a.target = "_blank"; 
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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
    for (let i = 0; i < parsedLyrics.length; i++) { if (time >= parsedLyrics[i].time) activeIdx = i; }
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

// 启动渲染
renderPlaylist(); renderFavorites();
