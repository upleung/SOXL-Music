/**
 * SOXL Music Core Engine - Refactored
 * 脱离 Serverless 依赖的纯前端核心版本
 */

// === 1. 核心 API 配置 (强制接驳 GD Music 直连) ===
const API = {
    baseUrl: "https://music.gdstudio.xyz/api.php",
    generateSignature: () => Math.random().toString(36).substring(2, 15),
    
    fetchJson: async (url) => {
        try {
            const res = await fetch(url, { headers: { "Accept": "application/json" } });
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            const text = await res.text();
            try { return JSON.parse(text); } catch(e) { return text; }
        } catch (error) {
            console.error(error);
            return null;
        }
    },
    
    search: async (keyword, source = "netease", page = 1) => {
        const url = `${API.baseUrl}?types=search&source=${source}&name=${encodeURIComponent(keyword)}&count=30&pages=${page}`;
        const data = await API.fetchJson(url);
        if(!Array.isArray(data)) return [];
        return data.map(song => ({
            id: song.id,
            name: song.name,
            artist: Array.isArray(song.artist) ? song.artist.join('/') : song.artist,
            pic_id: song.pic_id,
            lyric_id: song.lyric_id,
            source: song.source || source
        }));
    },
    
    getSongUrl: async (song, quality = "320") => {
        // 请求真实 URL 绕过 302 防止跨域断流
        const url = `${API.baseUrl}?types=url&id=${song.id}&source=${song.source}&br=${quality}`;
        const res = await API.fetchJson(url);
        return (res && res.url) ? res.url : url;
    },

    getPicUrl: (song) => `${API.baseUrl}?types=pic&id=${song.pic_id || song.id}&source=${song.source}&size=300`,
    getLyricUrl: (song) => `${API.baseUrl}?types=lyric&id=${song.lyric_id || song.id}&source=${song.source}`,
    getPlaylist: async (id) => await API.fetchJson(`${API.baseUrl}?types=playlist&id=${id}`)
};

// === 2. 状态中心 ===
window.state = {
    searchSource: localStorage.getItem('searchSource') || 'netease',
    playbackQuality: localStorage.getItem('playbackQuality') || '320',
    playlistSongs: JSON.parse(localStorage.getItem('playlistSongs') || '[]'),
    currentSong: null,
    playMode: 'list', // list | shuffle | one
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
    lyrics: document.getElementById('lyricsContent'),
    radarBtn: document.getElementById('radarBtn')
};

// === 3. 播放器引擎 ===
async function playSong(song) {
    if(!song) return;
    window.state.currentSong = song;
    
    // 更新 UI
    document.getElementById('currentSongTitle').innerText = song.name;
    document.getElementById('currentSongArtist').innerText = song.artist;
    const coverUrl = API.getPicUrl(song);
    document.getElementById('barCoverImg').src = coverUrl;
    document.getElementById('bigCoverImg').src = coverUrl;
    
    // 获取播放地址并开始播放
    const actualUrl = await API.getSongUrl(song, window.state.playbackQuality);
    if(actualUrl) {
        dom.audio.src = actualUrl;
        dom.audio.play();
        dom.playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    }

    // 填充歌词
    const lyricData = await API.fetchJson(API.getLyricUrl(song));
    renderLyrics(lyricData && lyricData.lyric ? lyricData.lyric : "[00:00.00] 暂无歌词");
    renderPlaylist(); // 高亮
}

// 播放控制
dom.playBtn.addEventListener('click', () => {
    if(!dom.audio.src) return;
    if(dom.audio.paused) { dom.audio.play(); dom.playBtn.innerHTML = '<i class="fas fa-pause"></i>'; }
    else { dom.audio.pause(); dom.playBtn.innerHTML = '<i class="fas fa-play"></i>'; }
});

window.playNext = () => playAdjacent(1);
window.playPrevious = () => playAdjacent(-1);
document.getElementById('nextBtn').addEventListener('click', window.playNext);
document.getElementById('prevBtn').addEventListener('click', window.playPrevious);

function playAdjacent(dir) {
    if(window.state.playlistSongs.length === 0) return;
    let idx = window.state.playlistSongs.findIndex(s => s.id === window.state.currentSong?.id);
    if(window.state.playMode === 'shuffle') {
        idx = Math.floor(Math.random() * window.state.playlistSongs.length);
    } else {
        idx = (idx + dir + window.state.playlistSongs.length) % window.state.playlistSongs.length;
    }
    playSong(window.state.playlistSongs[idx]);
}

dom.audio.addEventListener('ended', window.playNext);
dom.audio.addEventListener('timeupdate', () => {
    if(!dom.audio.duration) return;
    dom.progress.value = (dom.audio.currentTime / dom.audio.duration) * 100;
    dom.curTime.innerText = formatTime(dom.audio.currentTime);
    dom.durTime.innerText = formatTime(dom.audio.duration);
    syncLyrics(dom.audio.currentTime);
});
dom.progress.addEventListener('input', (e) => {
    dom.audio.currentTime = (e.target.value / 100) * dom.audio.duration;
});

// 音量控制
const volSlider = document.getElementById('volumeSlider');
volSlider.addEventListener('input', (e) => dom.audio.volume = e.target.value);

// === 4. 业务逻辑与 UI 渲染 ===
dom.searchBtn.addEventListener('click', async () => {
    const keyword = dom.searchInput.value.trim();
    if(!keyword) return;
    dom.searchList.innerHTML = '<div style="text-align:center; padding: 20px;">搜索中...</div>';
    
    const results = await API.search(keyword, window.state.searchSource);
    dom.searchList.innerHTML = '';
    
    results.forEach(song => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `<span class="search-result-title">${song.name}</span><span class="search-result-artist">${song.artist}</span>`;
        div.onclick = () => {
            // 加入播放队列并播放
            if(!window.state.playlistSongs.find(s => s.id === song.id)) {
                window.state.playlistSongs.unshift(song);
                localStorage.setItem('playlistSongs', JSON.stringify(window.state.playlistSongs));
            }
            playSong(song);
            document.getElementById('clearSearchBtn').click(); // 选中后关闭搜索
        };
        dom.searchList.appendChild(div);
    });
});

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

// === 雷达功能实现 ===
dom.radarBtn.addEventListener('click', async () => {
    const ids = ["3778678", "2884035", "19723756"]; // 常用网易云优质榜单库
    const randomId = ids[Math.floor(Math.random() * ids.length)];
    const data = await API.getPlaylist(randomId);
    if(data && data.playlist && data.playlist.tracks) {
        window.state.playlistSongs = data.playlist.tracks.map(t => ({
            id: t.id, name: t.name, artist: t.ar ? t.ar.map(a=>a.name).join('/') : 'Unknown',
            pic_id: t.al ? t.al.pic_str || t.al.picUrl : '', lyric_id: t.id, source: 'netease'
        }));
        localStorage.setItem('playlistSongs', JSON.stringify(window.state.playlistSongs));
        renderPlaylist();
        playSong(window.state.playlistSongs[0]);
    }
});

// === 歌词解析 ===
let parsedLyrics = [];
function renderLyrics(lrcString) {
    dom.lyrics.innerHTML = ''; parsedLyrics = [];
    const lines = lrcString.split('\n');
    lines.forEach(line => {
        const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
        if(match && match[4].trim()) {
            const time = parseInt(match[1])*60 + parseInt(match[2]) + parseFloat(`0.${match[3]}`);
            const div = document.createElement('div');
            div.innerText = match[4].trim();
            dom.lyrics.appendChild(div);
            parsedLyrics.push({ time, element: div });
        }
    });
}
function syncLyrics(time) {
    let activeIdx = -1;
    for(let i=0; i<parsedLyrics.length; i++) { if(time >= parsedLyrics[i].time) activeIdx = i; }
    if(activeIdx !== -1) {
        document.querySelectorAll('#lyricsContent div').forEach(el => el.className = '');
        parsedLyrics[activeIdx].element.className = 'current';
    }
}
function formatTime(s) {
    const mins = Math.floor(s / 60); const secs = Math.floor(s % 60);
    return `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
}

// 初始化渲染队列
renderPlaylist();
