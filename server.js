const express = require('express');
const path = require('path');
const { fetchAllNews } = require('./lib/newsFetcher');

const app = express();
const PORT = process.env.PORT || 3000;

// Auto-redirect mobile users to /mobile
app.get('/', (req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  if (isMobile) {
    return res.redirect('/mobile');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 샘플 데이터 (실시간 피드 실패 시 폴백)
const fallbackData = require('./data/news.json');

// 실시간 AI 뉴스 API
app.get('/api/news', async (req, res) => {
  try {
    const liveNews = await fetchAllNews();
    if (liveNews && liveNews.news.length > 0) {
      res.json(liveNews);
    } else {
      // 실시간 뉴스가 없으면 샘플 데이터 폴백
      res.json(fallbackData);
    }
  } catch (err) {
    console.error('[API] News fetch error:', err.message);
    res.json(fallbackData);
  }
});

// Auto-redirect mobile users to mobile page
app.get('/mobile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

// Vercel serverless export
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`AI News Feed running at http://localhost:${PORT}`);
  });
}
