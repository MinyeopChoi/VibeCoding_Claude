const RSSParser = require('rss-parser');
const https = require('https');
const http = require('http');

const parser = new RSSParser({
  timeout: 10000,
  headers: { 'User-Agent': 'AI-News-Feed/1.0' }
});

// ===== Threads 계정 설정 =====
const THREADS_ACCOUNTS = [
  { username: 'choi.openai', displayName: 'choi.openai' },
  { username: 'unclejobs.ai', displayName: 'unclejobs.ai' }
];

// Threads API 설정 (환경변수로 토큰 제공 시 활성화)
const THREADS_ACCESS_TOKEN = process.env.THREADS_ACCESS_TOKEN || '';

// ===== Google News RSS 피드 생성 헬퍼 =====
function gnews(query, category) {
  return {
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`,
    source: 'web',
    category
  };
}

// ===== AI 관련 RSS 피드 소스 =====
const RSS_FEEDS = [
  // --- LLM / 챗봇 ---
  gnews('OpenAI OR ChatGPT OR GPT-5 OR GPT-4o', 'llm'),
  gnews('Anthropic OR "Claude AI" OR "Claude 4"', 'llm'),
  gnews('xAI OR "Grok AI" OR "Grok 3"', 'llm'),
  gnews('Google Gemini OR "Gemini 2" OR "Gemini Ultra"', 'llm'),

  // --- 이미지 생성 ---
  gnews('Midjourney OR "Midjourney V7"', 'image-gen'),
  gnews('"Nano Banana" AI', 'image-gen'),
  gnews('"Grok Imagine" OR "xAI image" OR "Aurora AI"', 'image-gen'),
  gnews('Seedream OR "ByteDance image" OR "Seed image"', 'image-gen'),
  gnews('Flux AI OR "Black Forest Labs" OR ComfyUI', 'image-gen'),

  // --- 영상 생성 ---
  gnews('Sora OR "OpenAI video" OR "Sora AI"', 'video-gen'),
  gnews('Kling AI OR "Kuaishou AI" OR "Kling video"', 'video-gen'),
  gnews('Seedance OR "ByteDance video" OR "Seed video"', 'video-gen'),
  gnews('Veo OR "Google Veo" OR "Veo 2"', 'video-gen'),
  gnews('"Luma Ray" OR "Luma Dream Machine" OR "Luma AI"', 'video-gen'),
  gnews('Runway AI OR "Runway Gen" OR "Runway ML"', 'video-gen'),
  gnews('"Wan AI" OR "Wan video" OR "Alibaba video AI"', 'video-gen'),
  gnews('Vidu AI OR "Vidu video"', 'video-gen'),

  // --- 코드 AI ---
  gnews('AI coding OR "GitHub Copilot" OR "Claude Code" OR Cursor', 'code-ai'),

  // --- 음악 AI ---
  gnews('Suno AI OR "AI music generation"', 'music-ai'),

  // --- 로보틱스 ---
  gnews('AI robot OR humanoid robot OR "Figure AI"', 'robotics'),

  // --- AI 정책 ---
  gnews('AI regulation OR AI policy OR "AI법"', 'ai-policy'),

  // --- ByteDance 종합 ---
  gnews('ByteDance AI OR "바이트댄스 AI"', 'ai-tools'),

  // --- 일반 AI 뉴스 ---
  gnews('artificial intelligence 2026', 'llm'),
];

// Threads 관련 Google News RSS (계정 이름으로 검색)
const THREADS_RSS_FEEDS = THREADS_ACCOUNTS.map(account => ({
  url: `https://news.google.com/rss/search?q=%22${account.username}%22+threads+AI&hl=ko&gl=KR&ceid=KR:ko`,
  source: 'threads',
  sourceHandle: `@${account.username}`,
  category: 'llm'
}));

// 카테고리 자동 분류 키워드
const CATEGORY_KEYWORDS = {
  'llm': [
    'GPT', 'ChatGPT', 'GPT-4o', 'GPT-5', 'OpenAI',
    'Claude', 'Anthropic',
    'Grok', 'xAI',
    'Gemini', 'Google AI',
    'LLM', 'Llama', '언어모델', '대규모', 'AI 모델', '챗봇'
  ],
  'image-gen': [
    'Midjourney', 'Stable Diffusion', 'DALL-E',
    'Nano Banana', '나노바나나',
    'Grok Imagine', 'Aurora',
    'Seedream', 'Flux', 'ComfyUI', 'Black Forest Labs',
    '이미지 생성', '이미지생성', 'AI 그림', 'AI아트', 'AI 이미지'
  ],
  'video-gen': [
    'Sora', 'Kling', 'Seedance', 'Veo',
    'Luma Ray', 'Luma Dream Machine', 'Luma AI',
    'Runway', 'Runway Gen', 'Runway ML',
    'Wan AI', 'Wan video', 'Vidu',
    '영상 생성', '영상생성', 'AI 영상', 'AI영상', '동영상 생성', 'AI 비디오'
  ],
  'code-ai': ['Copilot', 'Claude Code', 'Cursor', '코딩 AI', '코딩AI', 'AI 코딩', '코드 생성'],
  'music-ai': ['Suno', 'AI 음악', 'AI음악', '작곡 AI', '음악 생성'],
  'robotics': ['로봇', 'robot', '휴머노이드', 'humanoid', 'Figure', 'Optimus', '로보틱스'],
  'ai-policy': ['규제', 'regulation', '정책', 'policy', 'AI법', 'AI Act', '윤리'],
  'ai-tools': ['AI 도구', 'AI도구', 'Perplexity', 'AI 서비스', 'AI서비스', 'AI 앱', 'ByteDance', '바이트댄스'],
  'research': ['연구', 'research', '논문', 'paper', '벤치마크', 'benchmark', 'AI 트렌드']
};

// 캐시: 5분마다 갱신
let cachedNews = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

function classifyCategory(title, content, feedCategory) {
  const text = `${title} ${content}`.toLowerCase();
  let bestCategory = feedCategory;
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }
  return bestCategory;
}

function extractTags(title, content) {
  const text = `${title} ${content}`;
  const tagKeywords = [
    // LLM
    'GPT', 'ChatGPT', 'OpenAI', 'Claude', 'Anthropic',
    'Grok', 'xAI', 'Gemini', 'Google',
    // 이미지 생성
    'Midjourney', 'Stable Diffusion', 'DALL-E',
    'Nano Banana', 'Flux', 'ComfyUI', 'Seedream', 'Grok Imagine',
    // 영상 생성
    'Sora', 'Kling', 'Seedance', 'Veo', 'Luma Ray', 'Luma',
    'Runway', 'Wan', 'Vidu',
    // 기타
    'Copilot', 'GitHub', 'Cursor', 'Suno', 'Meta', 'Llama',
    'ByteDance', '바이트댄스', 'Tesla', 'Figure', 'NVIDIA',
    'Apple', 'Microsoft', 'Samsung',
    'Perplexity', 'Hugging Face', 'EU', 'AI규제'
  ];
  const found = tagKeywords.filter(kw => text.includes(kw));
  return found.length > 0 ? found.slice(0, 4) : ['AI'];
}

function cleanTitle(title) {
  return title.replace(/\s*-\s*[^-]+$/, '').trim();
}

function extractSourceName(title, feedSource) {
  const match = title.match(/\s*-\s*([^-]+)$/);
  return match ? match[1].trim() : feedSource;
}

// ===== Threads 공식 API로 게시물 가져오기 =====
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchThreadsAPIPosts() {
  if (!THREADS_ACCESS_TOKEN) return [];

  const items = [];
  for (const account of THREADS_ACCOUNTS) {
    try {
      // Threads API: 사용자의 게시물 목록 가져오기
      const url = `https://graph.threads.net/v1.0/me/threads?fields=id,text,timestamp,permalink&access_token=${THREADS_ACCESS_TOKEN}`;
      const data = await fetchJSON(url);

      if (data.data) {
        for (const post of data.data) {
          const text = post.text || '';
          const pubDate = new Date(post.timestamp);

          items.push({
            id: `threads-${post.id}`,
            title: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            summary: text.substring(0, 300),
            category: classifyCategory(text, '', 'llm'),
            source: 'threads',
            sourceHandle: `@${account.username}`,
            date: pubDate.toISOString().split('T')[0],
            tags: extractTags(text, ''),
            url: post.permalink || `https://www.threads.net/@${account.username}`,
            relatedIds: []
          });
        }
      }
      console.log(`[Threads API] Fetched ${data.data?.length || 0} posts from @${account.username}`);
    } catch (err) {
      console.error(`[Threads API] Error for @${account.username}:`, err.message);
    }
  }
  return items;
}

// ===== Threads 관련 RSS로 뉴스 가져오기 (API 없을 때 폴백) =====
async function fetchThreadsRSSPosts() {
  const items = [];

  for (const feedInfo of THREADS_RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedInfo.url);
      for (const item of (feed.items || [])) {
        const pubDate = new Date(item.pubDate || item.isoDate);
        if (isNaN(pubDate.getTime())) continue;

        const rawTitle = item.title || '';
        const content = item.contentSnippet || item.content || '';

        items.push({
          id: `threads-rss-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          title: cleanTitle(rawTitle),
          summary: content.substring(0, 200) || cleanTitle(rawTitle),
          category: classifyCategory(rawTitle, content, feedInfo.category),
          source: 'threads',
          sourceHandle: feedInfo.sourceHandle,
          date: pubDate.toISOString().split('T')[0],
          tags: extractTags(rawTitle, content),
          url: item.link || '#',
          relatedIds: []
        });
      }
    } catch (err) {
      console.error(`[Threads RSS] Fetch failed for ${feedInfo.sourceHandle}:`, err.message);
    }
  }

  console.log(`[Threads RSS] Fetched ${items.length} related articles`);
  return items;
}

// ===== 메인: 모든 소스에서 뉴스 수집 =====
async function fetchAllNews() {
  const now = Date.now();
  if (cachedNews && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedNews;
  }

  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const allItems = [];
  const seenTitles = new Set();

  // 1. RSS 뉴스 피드 가져오기
  const feedPromises = RSS_FEEDS.map(async (feedInfo) => {
    try {
      const feed = await parser.parseURL(feedInfo.url);
      return { feed, feedInfo };
    } catch (err) {
      console.error(`RSS fetch failed: ${feedInfo.url}`, err.message);
      return null;
    }
  });

  // 2. Threads 게시물 가져오기 (API 또는 RSS 폴백)
  const threadsPromise = THREADS_ACCESS_TOKEN
    ? fetchThreadsAPIPosts()
    : fetchThreadsRSSPosts();

  // 병렬 실행
  const [rssResults, threadsItems] = await Promise.all([
    Promise.allSettled(feedPromises),
    threadsPromise
  ]);

  // RSS 결과 처리
  for (const result of rssResults) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    const { feed, feedInfo } = result.value;

    for (const item of (feed.items || [])) {
      const pubDate = new Date(item.pubDate || item.isoDate);
      if (isNaN(pubDate.getTime()) || pubDate < thirtyDaysAgo) continue;

      const rawTitle = item.title || '';
      const cleanedTitle = cleanTitle(rawTitle);

      if (seenTitles.has(cleanedTitle.substring(0, 30))) continue;
      seenTitles.add(cleanedTitle.substring(0, 30));

      const content = item.contentSnippet || item.content || '';
      const sourceName = extractSourceName(rawTitle, feedInfo.source);

      allItems.push({
        id: `live-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        title: cleanedTitle,
        summary: content.substring(0, 200) || cleanedTitle,
        category: classifyCategory(cleanedTitle, content, feedInfo.category),
        source: 'web',
        sourceHandle: sourceName,
        date: pubDate.toISOString().split('T')[0],
        tags: extractTags(cleanedTitle, content),
        url: item.link || '#',
        relatedIds: []
      });
    }
  }

  // Threads 결과 추가 (중복 제거)
  for (const item of threadsItems) {
    if (seenTitles.has(item.title.substring(0, 30))) continue;
    seenTitles.add(item.title.substring(0, 30));

    const pubDate = new Date(item.date);
    if (pubDate < thirtyDaysAgo) continue;

    allItems.push(item);
  }

  // 최신순 정렬, 최대 100개
  allItems.sort((a, b) => new Date(b.date) - new Date(a.date));
  const newsItems = allItems.slice(0, 100);

  cachedNews = {
    categories: [
      { id: 'llm', label: '대규모 언어 모델', icon: 'brain' },
      { id: 'image-gen', label: '이미지 생성', icon: 'image' },
      { id: 'video-gen', label: '영상 생성', icon: 'video' },
      { id: 'code-ai', label: '코드 AI', icon: 'code' },
      { id: 'music-ai', label: '음악 AI', icon: 'music' },
      { id: 'robotics', label: '로보틱스', icon: 'robot' },
      { id: 'ai-policy', label: 'AI 정책/규제', icon: 'shield' },
      { id: 'ai-tools', label: 'AI 도구/서비스', icon: 'tool' },
      { id: 'research', label: 'AI 연구', icon: 'flask' }
    ],
    sources: [
      { id: 'all', label: '전체' },
      { id: 'threads', label: 'Threads' },
      { id: 'web', label: '웹 뉴스' }
    ],
    threadAccounts: THREADS_ACCOUNTS.map(a => ({
      username: a.username,
      url: `https://www.threads.net/@${a.username}`
    })),
    news: newsItems,
    lastUpdated: new Date().toISOString(),
    threadsApiActive: !!THREADS_ACCESS_TOKEN
  };
  cacheTimestamp = now;

  const threadCount = newsItems.filter(n => n.source === 'threads').length;
  const webCount = newsItems.filter(n => n.source === 'web').length;
  console.log(`[News] Total: ${newsItems.length} (Threads: ${threadCount}, Web: ${webCount})`);

  return cachedNews;
}

module.exports = { fetchAllNews };
