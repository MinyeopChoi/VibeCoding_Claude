const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Sample AI news data (sourced from X.com and Threads trends)
const newsData = require('./data/news.json');

app.get('/api/news', (req, res) => {
  res.json(newsData);
});

app.listen(PORT, () => {
  console.log(`AI News Feed running at http://localhost:${PORT}`);
});
