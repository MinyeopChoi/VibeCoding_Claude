const express = require('express');
const path = require('path');

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

// Sample AI news data (sourced from X.com and Threads trends)
const newsData = require('./data/news.json');

app.get('/api/news', (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const filtered = {
    ...newsData,
    news: newsData.news.filter(n => new Date(n.date) >= thirtyDaysAgo)
  };
  res.json(filtered);
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
