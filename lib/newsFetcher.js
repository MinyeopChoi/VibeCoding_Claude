const RSSParser = require('rss-parser');
const parser = new RSSParser({
  timeout: 10000,
  headers: { 'User-Agent': 'AI-News-Feed/1.0' }
});

// AI 관련 RSS 피드 소스
const RSS_FEEDS = [
  {
    url: 'https://news.google.com/rss/search?q=artificial+intelligence&hl=ko&gl=KR&ceid=KR:ko',
    source: 'Google News',
    category: 'llm'
  },
  {
    url: 'https://news.google.com/rss/search?q=ChatGPT+OR+GPT+OR+OpenAI&hl=ko&gl=KR&ceid=KR:ko',
    source: 'Google News',
    category: 'llm'
  },
  {
    url: 'https://news.google.com/rss/search?q=AI+image+generation+OR+Midjourney+OR+Stable+Diffusion&hl=ko&gl=KR&ceid=KR:ko',
    source: 'Google News',
    category: 'image-gen'
  },
  {
    url: 'https://news.google.com/rss/search?q=AI+coding+OR+GitHub+Copilot+OR+Claude+Code&hl=ko&gl=KR&ceid=KR:ko',
    source: 'Google News',
    category: 'code-ai'
  },
  {
    url: 'https://news.google.com/rss/search?q=AI+robot+OR+humanoid+robot&hl=ko&gl=KR&ceid=KR:ko',
    source: 'Google News',
    category: 'robotics'
  },
  {
    url: 'https://news.google.com/rss/search?q=AI+regulation+OR+AI+policy&hl=ko&gl=KR&ceid=KR:ko',
    source: 'Google News',
    category: 'ai-policy'
  },
  {
    url: 'https://news.google.com/rss/search?q=Anthropic+OR+Claude+AI&hl=ko&gl=KR&ceid=KR:ko',
    source: 'Google News',
    category: 'llm'
  },
  {
    url: 'https://news.google.com/rss/search?q=Gemini+AI+OR+Google+AI&hl=ko&gl=KR&ceid=KR:ko',
    source: 'Google News',
    category: 'llm'
  },
  {
    url: 'https://news.google.com/rss/search?q=AI+video+generation+OR+Sora+OR+Runway&hl=ko&gl=KR&ceid=KR:ko',
    source: 'Google News',
    category: 'video-gen'
  },
  {
    url: 'https://news.google.com/rss/search?q=AI+music+OR+Suno+AI&hl=ko&gl=KR&ceid=KR:ko',
    source: 'Google News',
    category: 'music-ai'
  }
];

// 카테고리 자동 분류 키워드
const CATEGORY_KEYWORDS = {
  'llm': ['GPT', 'ChatGPT', 'Claude', 'Gemini', 'LLM', 'Llama', '언어모델', 'OpenAI', 'Anthropic', '대규모', 'AI 모델'],
  'image-gen': ['Midjourney', 'Stable Diffusion', 'DALL-E', '이미지 생성', '이미지생성', 'AI 그림', 'AI아트'],
  'video-gen': ['Sora', 'Runway', '영상 생성', '영상생성', 'AI 영상', 'AI영상', '동영상 생성'],
  'code-ai': ['Copilot', 'Claude Code', 'Cursor', '코딩 AI', '코딩AI', 'AI 코딩', '코드 생성'],
  'music-ai': ['Suno', 'AI 음악', 'AI음악', '작곡 AI', '음악 생성'],
  'robotics': ['로봇', 'robot', '휴머노이드', 'humanoid', 'Figure', 'Optimus', '로보틱스'],
  'ai-policy': ['규제', 'regulation', '정책', 'policy', 'AI법', 'AI Act', '윤리'],
  'ai-tools': ['AI 도구', 'AI도구', 'Perplexity', 'AI 서비스', 'AI서비스', 'AI 앱'],
  'research': ['연구', 'research', '논문', 'paper', '벤치마크', 'benchmark', 'AI 트렌드']
};

// 캐시: 5분마다 갱신
let cachedNews = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5분

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
    'GPT', 'ChatGPT', 'OpenAI', 'Claude', 'Anthropic', 'Gemini', 'Google',
    'Midjourney', 'Stable Diffusion', 'DALL-E', 'Sora', 'Runway',
    'Copilot', 'GitHub', 'Cursor', 'Suno', 'Meta', 'Llama',
    'Tesla', 'Figure', 'NVIDIA', 'Apple', 'Microsoft', 'Samsung',
    'Perplexity', 'Hugging Face', 'EU', 'AI규제'
  ];
  const found = tagKeywords.filter(kw => text.includes(kw));
  return found.length > 0 ? found.slice(0, 4) : ['AI'];
}

function cleanTitle(title) {
  // Google News RSS에서 소스 이름 제거 (예: " - 조선일보")
  return title.replace(/\s*-\s*[^-]+$/, '').trim();
}

function extractSourceName(title, feedSource) {
  const match = title.match(/\s*-\s*([^-]+)$/);
  return match ? match[1].trim() : feedSource;
}

async function fetchAllNews() {
  const now = Date.now();
  if (cachedNews && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedNews;
  }

  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const allItems = [];
  const seenTitles = new Set();

  const feedPromises = RSS_FEEDS.map(async (feedInfo) => {
    try {
      const feed = await parser.parseURL(feedInfo.url);
      return { feed, feedInfo };
    } catch (err) {
      console.error(`RSS fetch failed: ${feedInfo.url}`, err.message);
      return null;
    }
  });

  const results = await Promise.allSettled(feedPromises);

  for (const result of results) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    const { feed, feedInfo } = result.value;

    for (const item of (feed.items || [])) {
      const pubDate = new Date(item.pubDate || item.isoDate);
      if (isNaN(pubDate.getTime()) || pubDate < thirtyDaysAgo) continue;

      const rawTitle = item.title || '';
      const cleanedTitle = cleanTitle(rawTitle);

      // 중복 제거
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

  // 최신순 정렬, 최대 50개
  allItems.sort((a, b) => new Date(b.date) - new Date(a.date));
  const newsItems = allItems.slice(0, 50);

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
    news: newsItems,
    lastUpdated: new Date().toISOString()
  };
  cacheTimestamp = now;

  console.log(`[News] Fetched ${newsItems.length} live articles`);
  return cachedNews;
}

module.exports = { fetchAllNews };
