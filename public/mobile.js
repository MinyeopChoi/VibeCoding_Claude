// AI News Feed — Mobile Tree View
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
  let activeSource = 'all';
  const expandedCategories = new Set(data.categories.map(cat => cat.id));

  // Build category chips
  const categoryBar = document.getElementById('category-bar');
  data.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-chip';
    btn.textContent = cat.label;
    btn.dataset.cat = cat.id;
    categoryBar.appendChild(btn);
  });

  // Category quick focus
  categoryBar.addEventListener('click', e => {
    const btn = e.target.closest('.cat-chip');
    if (!btn) return;
    categoryBar.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const categoryId = btn.dataset.cat;
    if (categoryId === 'all') {
      data.categories.forEach(cat => expandedCategories.add(cat.id));
      renderFeed();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    expandedCategories.add(categoryId);
    renderFeed();

    requestAnimationFrame(() => {
      const section = document.querySelector(`.tree-group[data-category="${categoryId}"]`);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
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

  function getSourceLabel(item) {
    return item.source === 'x.com' ? `𝕏 ${item.sourceHandle}`
      : item.source === 'threads' ? `Threads ${item.sourceHandle}`
      : `📰 ${item.sourceHandle}`;
  }

  function renderFeed() {
    const filtered = data.news
      .filter(n => activeSource === 'all' || n.source === activeSource)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filtered.length === 0) {
      feed.innerHTML = '<div class="empty-state">해당 조건의 뉴스가 없습니다</div>';
      return;
    }

    const grouped = data.categories.map(cat => {
      const items = filtered.filter(item => item.category === cat.id);
      return { ...cat, items };
    }).filter(group => group.items.length > 0);

    feed.innerHTML = grouped.map(group => {
      const color = categoryColors[group.id] || '#79c0ff';
      const isExpanded = expandedCategories.has(group.id);
      const latest = group.items[0];

      return `
        <section class="tree-group ${isExpanded ? 'expanded' : 'collapsed'}" data-category="${group.id}">
          <button class="tree-toggle" type="button" data-category="${group.id}" aria-expanded="${isExpanded}">
            <span class="tree-rail" style="background:${color}"></span>
            <span class="tree-toggle-main">
              <span class="tree-label">${group.label}</span>
              <span class="tree-meta">${group.items.length}개 · 최신 ${formatRelativeDate(latest.date)}</span>
            </span>
            <span class="tree-chevron">${isExpanded ? '−' : '+'}</span>
          </button>
          <div class="tree-children">
            ${group.items.map(item => {
              const freshClass = getFreshnessClass(item.date);
              return `
                <button class="news-item" type="button" data-id="${item.id}">
                  <span class="news-item-line" style="background:${color}"></span>
                  <span class="news-item-main">
                    <span class="news-item-top">
                      <span class="news-item-source">${getSourceLabel(item)}</span>
                      <span class="news-item-date">${formatRelativeDate(item.date)}</span>
                    </span>
                    <strong class="news-item-title">${item.title}</strong>
                    <span class="news-item-summary">${item.summary}</span>
                    <span class="news-item-tags">
                      ${item.tags.slice(0, 3).map(t => `<span class="tag">#${t}</span>`).join('')}
                    </span>
                  </span>
                  <span class="news-item-fresh ${freshClass}"></span>
                </button>
              `;
            }).join('')}
          </div>
        </section>
      `;
    }).join('');
  }

  // Tree interaction
  feed.addEventListener('click', e => {
    const toggle = e.target.closest('.tree-toggle');
    if (toggle) {
      const categoryId = toggle.dataset.category;
      if (expandedCategories.has(categoryId)) {
        expandedCategories.delete(categoryId);
      } else {
        expandedCategories.add(categoryId);
      }
      renderFeed();
      return;
    }

    const item = e.target.closest('.news-item');
    if (!item) return;
    const newsItem = data.news.find(n => n.id === item.dataset.id);
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
