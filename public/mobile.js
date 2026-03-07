// AI News Feed — Mobile Card View
(async function () {
  const res = await fetch('/api/news');
  const rawData = await res.json();
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const data = {
    ...rawData,
    news: rawData.news.filter(n => new Date(n.date) >= thirtyDaysAgo)
  };

  const categoryColors = {
    'llm': '#79c0ff',
    'image-gen': '#d2a8ff',
    'video-gen': '#ff7b72',
    'code-ai': '#7ee787',
    'music-ai': '#ffa657',
    'robotics': '#f778ba',
    'ai-policy': '#ffd700',
    'ai-tools': '#58a6ff',
    'research': '#bc8cff'
  };

  const categoryMap = {};
  data.categories.forEach(c => { categoryMap[c.id] = c.label; });

  function getAgeFactor(dateStr) {
    const d = new Date(dateStr);
    const diffDays = (today - d) / (1000 * 60 * 60 * 24);
    return Math.max(0.1, 1.0 - (diffDays / 8));
  }

  function getFreshnessClass(dateStr) {
    const age = getAgeFactor(dateStr);
    if (age > 0.7) return '';
    if (age > 0.3) return 'medium';
    return 'old';
  }

  function formatRelativeDate(dateStr) {
    const d = new Date(dateStr);
    const diffMs = today - d;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    return dateStr;
  }

  // State
  let activeCategory = 'all';
  let activeSource = 'all';

  // Build category chips
  const categoryBar = document.getElementById('category-bar');
  data.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-chip';
    btn.textContent = cat.label;
    btn.dataset.cat = cat.id;
    categoryBar.appendChild(btn);
  });

  // Category filter click
  categoryBar.addEventListener('click', e => {
    const btn = e.target.closest('.cat-chip');
    if (!btn) return;
    categoryBar.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCategory = btn.dataset.cat;
    renderFeed();
  });

  // Source filter click
  const sourceBar = document.getElementById('source-bar');
  sourceBar.addEventListener('click', e => {
    const btn = e.target.closest('.src-chip');
    if (!btn) return;
    sourceBar.querySelectorAll('.src-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeSource = btn.dataset.source;
    renderFeed();
  });

  // Render feed
  const feed = document.getElementById('feed');

  function renderFeed() {
    const filtered = data.news.filter(n => {
      const catMatch = activeCategory === 'all' || n.category === activeCategory;
      const srcMatch = activeSource === 'all' || n.source === activeSource;
      return catMatch && srcMatch;
    });

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filtered.length === 0) {
      feed.innerHTML = '<div class="empty-state">해당 조건의 뉴스가 없습니다</div>';
      return;
    }

    feed.innerHTML = filtered.map(n => {
      const color = categoryColors[n.category] || '#79c0ff';
      const freshClass = getFreshnessClass(n.date);
      const sourceLabel = n.source === 'x.com' ? `𝕏 ${n.sourceHandle}`
        : n.source === 'threads' ? `Threads ${n.sourceHandle}`
        : `📰 ${n.sourceHandle}`;

      return `
        <article class="news-card" data-id="${n.id}">
          <div class="card-accent" style="background:${color}"></div>
          <div class="card-fresh ${freshClass}"></div>
          <div class="card-top">
            <span class="card-source">${sourceLabel}</span>
            <span class="card-date">${formatRelativeDate(n.date)}</span>
          </div>
          <h3 class="card-title">${n.title}</h3>
          <p class="card-summary">${n.summary}</p>
          <div class="card-tags">
            ${n.tags.map(t => `<span class="tag">#${t}</span>`).join('')}
            <span class="card-category">${categoryMap[n.category] || n.category}</span>
          </div>
        </article>
      `;
    }).join('');
  }

  // Card tap → detail
  feed.addEventListener('click', e => {
    const card = e.target.closest('.news-card');
    if (!card) return;
    const newsItem = data.news.find(n => n.id === card.dataset.id);
    if (newsItem) showDetail(newsItem);
  });

  // Detail overlay
  const overlay = document.getElementById('detail-overlay');
  const sheet = document.getElementById('detail-sheet');

  function showDetail(n) {
    overlay.querySelector('.detail-source').textContent =
      n.source === 'x.com' ? `𝕏 ${n.sourceHandle}`
      : n.source === 'threads' ? `Threads ${n.sourceHandle}`
      : `📰 ${n.sourceHandle}`;
    overlay.querySelector('.detail-title').textContent = n.title;
    overlay.querySelector('.detail-summary').textContent = n.summary;
    overlay.querySelector('.detail-tags').innerHTML =
      n.tags.map(t => `<span class="tag">#${t}</span>`).join('');
    overlay.querySelector('.detail-meta').innerHTML =
      `날짜: ${n.date}<br>카테고리: ${categoryMap[n.category] || n.category}`;
    overlay.querySelector('.detail-link').href = n.url;
    overlay.classList.remove('hidden');
  }

  function hideDetail() {
    overlay.classList.add('hidden');
  }

  document.getElementById('detail-close').addEventListener('click', e => {
    e.stopPropagation();
    hideDetail();
  });

  // Tap overlay background to close
  overlay.addEventListener('click', e => {
    if (e.target === overlay) hideDetail();
  });

  // Swipe down to close detail sheet
  let sheetTouchStart = 0;
  let sheetTouchY = 0;

  sheet.addEventListener('touchstart', e => {
    if (sheet.scrollTop <= 0) {
      sheetTouchStart = e.touches[0].clientY;
      sheetTouchY = 0;
    }
  }, { passive: true });

  sheet.addEventListener('touchmove', e => {
    if (sheetTouchStart) {
      sheetTouchY = e.touches[0].clientY - sheetTouchStart;
      if (sheetTouchY > 0) {
        sheet.style.transform = `translateY(${sheetTouchY}px)`;
      }
    }
  }, { passive: true });

  sheet.addEventListener('touchend', () => {
    if (sheetTouchY > 100) {
      hideDetail();
    }
    sheet.style.transform = '';
    sheetTouchStart = 0;
    sheetTouchY = 0;
  }, { passive: true });

  // Initial render
  renderFeed();
})();
