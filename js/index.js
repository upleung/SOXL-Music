/**
 * SOXL Music Core Engine - Pro 完整旗舰版
 * 纯前端无服务器驱动 / 数据持久化 / 完整播放与收藏逻辑
 */

// ==========================================
// 1. API 核心驱动引擎 (GD Studio 直连)
// ==========================================
const API = {
    baseUrl: "https://music.gdstudio.xyz/api.php",
    
    // 统一的请求拦截与 JSON 解析
    fetchJson: async (url) => {
        try {
            const res = await fetch(url, { headers: { "Accept": "application/json" } });
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            const text = await res.text();
            try { return JSON.parse(text); } catch(e) { return text; }
        } catch (error) {
            console.error("API 请求失败:", error);
            return null;
        }
    },
    
    // 搜索歌曲
    search: async (keyword, source = "netease", page = 1) => {
        const url = `${API.baseUrl}?types=search&source=${source}&name=${encodeURIComponent(keyword)}&count=30&pages=${page}`;
        const data = await API.fetchJson(url);
        if(!Array.isArray(data)) return [];
        return data.map(song => ({
            id: song.id,
            name: song.name,
            artist: Array.isArray(song.artist) ? song.artist.join(' / ') : song.artist,
            pic_id: song.pic_id,
            lyric_id: song.lyric_id,
            source: song.source || source
        }));
    },
    
    // 获取真实播放地址
    getSongUrl: async (song, quality = "320") => {
        const url = `${API.baseUrl}?types=url&id=${song.id}&source=${song.source}&br=${quality}`;
        const res = await API.fetchJson(url);
        return (res && res.url) ? res.url : url;
    },

    // 获取封面与歌词地址
    getPicUrl: (song) => `${API.baseUrl}?types=pic&id=${song.pic_id || song.id}&source=${song.source}&size=500`,
    getLyricUrl: (song) => `${API.baseUrl}?types=lyric&id=${song.lyric_id || song.id}&source=${song.source}`,
    
    // 获取榜单/歌单 (用于雷达)
    getPlaylist: async (id) => await API.fetchJson(`${API.baseUrl}?types=playlist&id=${id}`)
};


// ==========================================
// 2. 全局状态与 DOM 映射中心
// ==========================================
window.state = {
    searchSource: localStorage.getItem('searchSource') || 'netease',
    playbackQuality: localStorage.getItem('playbackQuality') || '320',
    playMode: 'list', // list, loop-one, shuffle (由 ui-controller 接管切换)
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
    
    // 导入导出按钮
    importPlaylistBtn: document.getElementById('importPlaylistBtn'),
    exportPlaylistBtn: document.getElementById('exportPlaylistBtn'),
    importPlaylistInput: document.getElementById('importPlaylistInput'),
    clearPlaylistBtn: document.getElementById('clearPlaylistBtn'),
    
    importFavoritesBtn: document.getElementById('importFavoritesBtn'),
    exportFavoritesBtn: document.getElementById('exportFavoritesBtn'),
    importFavoritesInput: document.getElementById('importFavoritesInput'),
    clearFavoritesBtn: document.getElementById('clearFavoritesBtn'),
};


// ==========================================
// 3. 核心播放控制系统
// ==========================================
async function playSong(song) {
    if(!song) return;
    window.state.currentSong = song;
    
    // 更新基础 UI
    document.getElementById('currentSongTitle').innerText = song.name;
    document.getElementById('currentSongArtist').innerText = song.artist;
    
    // 更新封面
    const coverUrl = API.getPicUrl(song);
    document.getElementById('barCoverImg').src = coverUrl;
    document.getElementById('bigCoverImg').src = coverUrl;
    
    // 检查收藏状态
    updateFavoriteIcon(song);
    
    // 获取播放地址并开始播放
    const actualUrl = await API.getSongUrl(song, window.state.playbackQuality);
    if(actualUrl) {
        dom.audio.src = actualUrl;
        dom.audio.play().catch(e => console.warn("自动播放被拦截等待交互", e));
        dom.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    }

    // 获取并渲染歌词
    const lyricData = await API.fetchJson(API.getLyricUrl(song));
    renderLyrics(lyricData && lyricData.lyric ? lyricData.lyric : "[00:00.00] 暂无歌词 / 纯音乐");
    
    // 重新渲染列表以更新高亮状态
    renderPlaylist();
    renderFavorites();
}

// 播放/暂停联动
dom.playBtn.addEventListener('click', () => {
    if(!dom.audio.src) {
        // 如果没在播放，默认播放列表第一首
        if(window.state.playlistSongs.length > 0) playSong(window.state.playlistSongs[0]);
        return;
    }
    if(dom.audio.paused) { 
        dom.audio.play(); 
        dom.playBtn.innerHTML = '<i class="fas fa-pause"></i>'; 
    } else { 
        dom.audio.pause(); 
        dom.playBtn.innerHTML = '<i class="fas fa-play"></i>'; 
    }
});

// 上一首 / 下一首
window.playNext = () => playAdjacent(1);
window.playPrevious = () => playAdjacent(-1);
document.getElementById('nextBtn')?.addEventListener('click', window.playNext);
document.getElementById('prevBtn')?.addEventListener('click', window.playPrevious);

function playAdjacent(dir) {
    const list = window.state.playlistSongs;
    if(list.length === 0) return;
    let idx = list.findIndex(s => s.id === window.state.currentSong?.id);
    
    if(window.state.playMode === 'shuffle') {
        idx = Math.floor(Math.random() * list.length);
    } else {
        idx = (idx + dir + list.length) % list.length;
    }
    playSong(list[idx]);
}

// 音频事件监听
dom.audio.addEventListener('ended', () => {
    if(window.state.playMode === 'loop-one') {
        dom.audio.currentTime = 0;
        dom.audio.play();
    } else {
        window.playNext();
    }
});

dom.audio.addEventListener('timeupdate', () => {
    if(!dom.audio.duration) return;
    // 进度条更新
    dom.progress.value = (dom.audio.currentTime / dom.audio.duration) * 100;
    dom.curTime.innerText = formatTime(dom.audio.currentTime);
    dom.durTime.innerText = formatTime(dom.audio.duration);
    // 歌词同步
    syncLyrics(dom.audio.currentTime);
});

// 进度条拖动
dom.progress.addEventListener('input', (e) => {
    if(dom.audio.duration) {
        dom.audio.currentTime = (e.target.value / 100) * dom.audio.duration;
    }
});

// 音量控制
const volSlider = document.getElementById('volumeSlider');
if(volSlider) {
    volSlider.addEventListener('input', (e) => dom.audio.volume = e.target.value);
}


// ==========================================
// 4. 搜索与列表渲染业务
// ==========================================
dom.searchBtn.addEventListener('click', async () => {
    const keyword = dom.searchInput.value.trim();
    if(!keyword) return;
    
    dom.searchList.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--text-secondary);">正在极速搜索中...</div>';
    
    const results = await API.search(keyword, window.state.searchSource);
    dom.searchList.innerHTML = '';
    
    if(results.length === 0) {
        dom.searchList.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--text-secondary);">未找到相关歌曲，请换个词或音源重试。</div>';
        return;
    }

    results.forEach(song => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <span class="search-result-title">${song.name}</span>
            <span class="search-result-artist">${song.artist}</span>
        `;
        div.onclick = () => {
            // 加入播放队列并播放
            if(!window.state.playlistSongs.find(s => s.id === song.id)) {
                window.state.playlistSongs.unshift(song);
                localStorage.setItem('playlistSongs', JSON.stringify(window.state.playlistSongs));
            }
            playSong(song);
            
            // 触发 ui-controller 中的清空搜索，自动切回播放列表
            const clearBtn = document.getElementById('clearSearchBtn');
            if(clearBtn) clearBtn.click(); 
        };
        dom.searchList.appendChild(div);
    });
});

// 监听回车搜索
dom.searchInput.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') dom.searchBtn.click();
});

// 渲染播放队列
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

// 移除队列歌曲
window.removeSong = (e, index) => {
    e.stopPropagation();
    window.state.playlistSongs.splice(index, 1);
    localStorage.setItem('playlistSongs', JSON.stringify(window.state.playlistSongs));
    renderPlaylist();
};

// 清空队列
window.clearPlaylist = () => {
    window.state.playlistSongs = [];
    localStorage.removeItem('playlistSongs');
    renderPlaylist();
    // 如果想要清空后停止播放，可解开以下注释
    // dom.audio.pause(); dom.audio.src = ''; document.getElementById('currentSongTitle').innerText = '未在播放';
}


// ==========================================
// 5. 收藏夹核心系统 (Favorites)
// ==========================================
function updateFavoriteIcon(song) {
    if(!song || !dom.favToggle) return;
    const isFav = window.state.favoriteSongs.find(s => s.id === song.id);
    if(isFav) {
        dom.favToggle.classList.add('is-active');
        dom.favToggle.innerHTML = '<i class="fas fa-heart"></i>'; // 实心心
        dom.favToggle.style.color = '#ff4d67';
    } else {
        dom.favToggle.classList.remove('is-active');
        dom.favToggle.innerHTML = '<i class="far fa-heart"></i>'; // 空心心
        dom.favToggle.style.color = 'var(--text-secondary)';
    }
}

// 点击控制栏心心
dom.favToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const current = window.state.currentSong;
    if(!current) return;
    
    const idx = window.state.favoriteSongs.findIndex(s => s.id === current.id);
    if(idx !== -1) {
        window.state.favoriteSongs.splice(idx, 1); // 移除收藏
    } else {
        window.state.favoriteSongs.unshift(current); // 加入收藏
    }
    localStorage.setItem('favoriteSongs', JSON.stringify(window.state.favoriteSongs));
    updateFavoriteIcon(current);
    renderFavorites();
});

// 渲染收藏列表
function renderFavorites() {
    if(!dom.favorites) return;
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
            // 如果播放收藏歌曲，自动将其加入播放队列保证列表连贯
            if(!window.state.playlistSongs.find(s => s.id === song.id)) {
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
    if(window.state.currentSong?.id === song.id) updateFavoriteIcon(window.state.currentSong);
};

if(dom.clearFavoritesBtn) {
    dom.clearFavoritesBtn.addEventListener('click', () => {
        window.state.favoriteSongs = [];
        localStorage.removeItem('favoriteSongs');
        renderFavorites();
        updateFavoriteIcon(window.state.currentSong);
    });
}


// ==========================================
// 6. 导入与导出 JSON 配置
// ==========================================
function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function handleJsonImport(event, callback) {
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if(Array.isArray(data)) callback(data);
            else alert('JSON 格式错误，需要数组格式。');
        } catch(err) {
            alert('读取文件失败，请确保它是合法的 JSON 文件。');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // 重置 file input
}

// 绑定播放队列导入导出
if(dom.exportPlaylistBtn) dom.exportPlaylistBtn.addEventListener('click', () => downloadJson(window.state.playlistSongs, 'SOXL_Playlist.json'));
if(dom.importPlaylistBtn) dom.importPlaylistBtn.addEventListener('click', () => dom.importPlaylistInput.click());
if(dom.importPlaylistInput) {
    dom.importPlaylistInput.addEventListener('change', (e) => {
        handleJsonImport(e, (data) => {
            window.state.playlistSongs = data;
            localStorage.setItem('playlistSongs', JSON.stringify(data));
            renderPlaylist();
        });
    });
}

// 绑定收藏夹导入导出
if(dom.exportFavoritesBtn) dom.exportFavoritesBtn.addEventListener('click', () => downloadJson(window.state.favoriteSongs, 'SOXL_Favorites.json'));
if(dom.importFavoritesBtn) dom.importFavoritesBtn.addEventListener('click', () => dom.importFavoritesInput.click());
if(dom.importFavoritesInput) {
    dom.importFavoritesInput.addEventListener('change', (e) => {
        handleJsonImport(e, (data) => {
            window.state.favoriteSongs = data;
            localStorage.setItem('favoriteSongs', JSON.stringify(data));
            renderFavorites();
            updateFavoriteIcon(window.state.currentSong);
        });
    });
}


// ==========================================
// 7. 音乐雷达 (Radar)
// ==========================================
// 该功能会从网易云的一些知名榜单中随机抽取数据直接填充播放
if(dom.radarBtn) {
    dom.radarBtn.addEventListener('click', async () => {
        // 网易云热歌榜、新歌榜、原创榜、飙升榜 等常用榜单 ID
        const playlistIds = ["3778678", "3779629", "2884035", "19723756", "11641012"];
        const randomId = playlistIds[Math.floor(Math.random() * playlistIds.length)];
        
        dom.radarBtn.classList.add('spinning'); // 转动效果
        const data = await API.getPlaylist(randomId);
        dom.radarBtn.classList.remove('spinning');

        if(data && data.playlist && data.playlist.tracks) {
            // 过滤并映射数据
            const newSongs = data.playlist.tracks.map(t => ({
                id: t.id, 
                name: t.name, 
                artist: t.ar ? t.ar.map(a=>a.name).join(' / ') : 'Unknown Artist',
                pic_id: t.al ? (t.al.pic_str || t.al.picUrl) : '', 
                lyric_id: t.id, 
                source: 'netease' // 榜单默认来自网易云
            }));
            
            // 完全替换当前播放队列
            window.state.playlistSongs = newSongs;
            localStorage.setItem('playlistSongs', JSON.stringify(window.state.playlistSongs));
            renderPlaylist();
            
            // 自动播放第一首
            playSong(window.state.playlistSongs[0]);
            
            // 切回播放列表页 (配合 ui-controller 的逻辑)
            const clearBtn = document.getElementById('clearSearchBtn');
            if(clearBtn) clearBtn.click();
        } else {
            console.error("雷达获取数据失败", data);
        }
    });
}


// ==========================================
// 8. 沉浸式歌词引擎
// ==========================================
let parsedLyrics = [];

function renderLyrics(lrcString) {
    dom.lyrics.innerHTML = ''; 
    parsedLyrics = [];
    
    // 正则匹配标准 LRC 格式 [mm:ss.xx] 歌词内容
    const lines = lrcString.split('\n');
    lines.forEach(line => {
        const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
        if(match && match[4].trim()) {
            const time = parseInt(match[1]) * 60 + parseInt(match[2]) + parseFloat(`0.${match[3]}`);
            const text = match[4].trim();
            
            const div = document.createElement('div');
            div.innerText = text;
            dom.lyrics.appendChild(div);
            
            parsedLyrics.push({ time, element: div });
        }
    });
    
    if(parsedLyrics.length === 0) {
        dom.lyrics.innerHTML = '<div>纯音乐，请欣赏</div>';
    }
}

// 时间轴同步
function syncLyrics(time) {
    if(parsedLyrics.length === 0) return;
    
    let activeIdx = -1;
    // 找出当前时间对应的最后一句歌词
    for(let i = 0; i < parsedLyrics.length; i++) { 
        if(time >= parsedLyrics[i].time) activeIdx = i; 
    }
    
    if(activeIdx !== -1) {
        // 清除所有高亮
        const currentActive = dom.lyrics.querySelector('.current');
        const targetElement = parsedLyrics[activeIdx].element;
        
        // 只有发生变化时才更新 DOM，极大地节省性能
        if(currentActive !== targetElement) {
            if(currentActive) currentActive.classList.remove('current');
            targetElement.classList.add('current');
        }
    }
}

// 格式化时间工具 00:00
function formatTime(s) {
    if(isNaN(s)) return "00:00";
    const mins = Math.floor(s / 60); 
    const secs = Math.floor(s % 60);
    return `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
}


// ==========================================
// 9. 侧边栏/分类页 Tabs 切换渲染控制
// ==========================================
// 这个配合 ui-controller 中的显示隐藏，处理数据的渲染展示
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
        renderFavorites(); // 切换时顺便刷新一下
    });
}

// 同样处理备用节点的 Tabs (适应不同的 HTML 结构可能产生的复制节点)
const ptBtnSec = document.getElementById('playlistTabSecondary');
const ftBtnSec = document.getElementById('favoritesTabSecondary');
if(ptBtnSec && ftBtnSec) {
    ptBtnSec.addEventListener('click', () => { if(ptBtn) ptBtn.click(); });
    ftBtnSec.addEventListener('click', () => { if(ftBtn) ftBtn.click(); });
}

// ==========================================
// 初始化：渲染本地持久化的队列
// ==========================================
renderPlaylist();
renderFavorites();
