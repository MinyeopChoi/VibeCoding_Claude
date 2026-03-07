// AI News Feed — Network Graph Visualization (Optimized)
(async function () {
  const res = await fetch('/api/news');
  const rawData = await res.json();
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const data = {
    ...rawData,
    news: rawData.news.filter(n => new Date(n.date) >= thirtyDaysAgo)
  };

  // Category colors
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

  // Pre-parse hex to rgb for fast rgba string building
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  const categoryRgb = {};
  for (const [k, v] of Object.entries(categoryColors)) {
    categoryRgb[k] = hexToRgb(v);
  }

  function getAgeFactor(dateStr) {
    const d = new Date(dateStr);
    const diffDays = (today - d) / (1000 * 60 * 60 * 24);
    return Math.max(0.1, 1.0 - (diffDays / 8));
  }

  function getNodeColor(news) {
    const age = getAgeFactor(news.date);
    const base = categoryRgb[news.category] || categoryRgb['llm'];
    const dr = 26, dg = 30, db = 36; // dark #1a1e24
    const r = Math.round(dr + (base.r - dr) * age);
    const g = Math.round(dg + (base.g - dg) * age);
    const b = Math.round(db + (base.b - db) * age);
    return `rgb(${r},${g},${b})`;
  }

  function getNodeGlow(news) {
    return getAgeFactor(news.date);
  }

  function getNodeRadius(news) {
    return 6 + getAgeFactor(news.date) * 10;
  }

  // Build graph data
  const nodes = [];
  const links = [];
  const nodeMap = new Map();

  data.categories.forEach(cat => {
    const rgb = categoryRgb[cat.id] || categoryRgb['llm'];
    const catNode = {
      id: cat.id,
      label: cat.label,
      type: 'category',
      radius: 14,
      color: categoryColors[cat.id] || '#79c0ff',
      rgb,
      fx: null,
      fy: null
    };
    nodes.push(catNode);
    nodeMap.set(cat.id, catNode);
  });

  data.news.forEach(n => {
    const rgb = categoryRgb[n.category] || categoryRgb['llm'];
    const newsNode = {
      id: n.id,
      label: n.title,
      type: 'news',
      data: n,
      radius: getNodeRadius(n),
      color: getNodeColor(n),
      rgb,
      glow: getNodeGlow(n)
    };
    nodes.push(newsNode);
    nodeMap.set(n.id, newsNode);

    links.push({ source: n.id, target: n.category, strength: 0.6 });

    if (n.relatedIds) {
      const linkSet = new Set(links.map(l =>
        `${typeof l.source === 'object' ? l.source.id : l.source}-${typeof l.target === 'object' ? l.target.id : l.target}`
      ));
      n.relatedIds.forEach(relId => {
        const key1 = `${n.id}-${relId}`;
        const key2 = `${relId}-${n.id}`;
        if (!linkSet.has(key1) && !linkSet.has(key2)) {
          links.push({ source: n.id, target: relId, strength: 0.2 });
          linkSet.add(key1);
        }
      });
    }
  });

  // Canvas setup
  const canvas = document.getElementById('graph-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  let width, height, dpr;

  // Mobile detection
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  // Cap DPR on mobile for perf
  const maxDpr = isMobile ? 1.5 : 2;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', () => {
    resize();
    simulation.alpha(0.3).restart();
  });

  const isSmallScreen = width < 768;
  const linkDistShort = isSmallScreen ? 50 : 80;
  const linkDistLong = isSmallScreen ? 90 : 140;
  const chargeCategory = isSmallScreen ? -200 : -400;
  const chargeNews = isSmallScreen ? -60 : -120;

  // Force simulation
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(d => {
      if (d.strength > 0.4) return linkDistShort;
      return linkDistLong;
    }).strength(d => d.strength))
    .force('charge', d3.forceManyBody()
      .strength(d => d.type === 'category' ? chargeCategory : chargeNews))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => d.radius + (isSmallScreen ? 4 : 8)))
    .force('x', d3.forceX(width / 2).strength(isSmallScreen ? 0.06 : 0.03))
    .force('y', d3.forceY(height / 2).strength(isSmallScreen ? 0.06 : 0.03))
    .alphaDecay(0.02)
    .velocityDecay(0.45);

  // Transform state for zoom/pan
  let transform = d3.zoomIdentity;

  const zoom = d3.zoom()
    .scaleExtent([0.3, 4])
    .on('zoom', (event) => {
      transform = event.transform;
      scheduleFrame();
    });

  d3.select(canvas).call(zoom);

  // ===== Optimized Render Loop =====
  let animFrameId = null;
  let needsRender = true;
  let animTime = 0;
  const TWO_PI = Math.PI * 2;
  const BG_COLOR = '#0d1117';

  function scheduleFrame() {
    needsRender = true;
    if (!animFrameId) {
      animFrameId = requestAnimationFrame(renderLoop);
    }
  }

  // Simulation drives rendering
  simulation.on('tick', scheduleFrame);

  function renderLoop() {
    animFrameId = null;
    if (!needsRender) return;
    needsRender = false;

    animTime += 0.02;
    draw();

    // Keep animating while simulation is warm or for subtle pulse
    if (simulation.alpha() > 0.01) {
      scheduleFrame();
    }
  }

  // Viewport culling bounds
  function getViewBounds() {
    const pad = 60; // padding for glow
    return {
      x1: (-transform.x / transform.k) - pad,
      y1: (-transform.y / transform.k) - pad,
      x2: ((width - transform.x) / transform.k) + pad,
      y2: ((height - transform.y) / transform.k) + pad
    };
  }

  function draw() {
    // Clear with background color (faster than clearRect + fill)
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    const vb = getViewBounds();

    // --- Batch draw links (single path per style) ---
    // Strong links
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(136,192,255,0.15)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const s = link.source, t = link.target;
      if (!s.x || !t.x) continue;
      if (link.strength <= 0.4) continue;
      // Quick bounds check
      if (s.x < vb.x1 && t.x < vb.x1) continue;
      if (s.x > vb.x2 && t.x > vb.x2) continue;
      if (s.y < vb.y1 && t.y < vb.y1) continue;
      if (s.y > vb.y2 && t.y > vb.y2) continue;
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
    }
    ctx.stroke();

    // Weak links
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(136,192,255,0.06)';
    ctx.lineWidth = 0.4;
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const s = link.source, t = link.target;
      if (!s.x || !t.x) continue;
      if (link.strength > 0.4) continue;
      if (s.x < vb.x1 && t.x < vb.x1) continue;
      if (s.x > vb.x2 && t.x > vb.x2) continue;
      if (s.y < vb.y1 && t.y < vb.y1) continue;
      if (s.y > vb.y2 && t.y > vb.y2) continue;
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
    }
    ctx.stroke();

    // --- Draw nodes ---
    const sinAnim2 = Math.sin(animTime * 2) * 0.05;
    const sinAnim3 = Math.sin(animTime * 3);

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node.visible || !node.x || !node.y) continue;

      // Viewport cull
      if (node.x < vb.x1 || node.x > vb.x2 || node.y < vb.y1 || node.y > vb.y2) continue;

      if (node.type === 'category') {
        const pulse = 1 + sinAnim2;
        const r = node.radius * pulse;
        const rgb = node.rgb;

        // Simplified glow: single semi-transparent circle instead of gradient
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 2.2, 0, TWO_PI);
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)`;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, TWO_PI);
        ctx.fillStyle = node.color;
        ctx.fill();

        // Label
        ctx.font = '500 11px "Noto Sans KR",sans-serif';
        ctx.fillStyle = '#e6edf3';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(node.label, node.x, node.y + node.radius + 8);
      } else {
        const glow = node.glow || 0.1;
        const pulse = 1 + sinAnim3 * 0.03 * glow;
        const r = node.radius * pulse;
        const rgb = node.rgb;

        // Simplified glow: single circle with alpha (no gradient)
        if (glow > 0.4) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * 2.2, 0, TWO_PI);
          ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${(glow * 0.18).toFixed(2)})`;
          ctx.fill();
        }

        // Core circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, TWO_PI);
        ctx.fillStyle = node.color;
        ctx.fill();

        // Bright center for new news
        if (glow > 0.6) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * 0.4, 0, TWO_PI);
          ctx.fillStyle = `rgba(255,255,255,${(glow * 0.3).toFixed(2)})`;
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  // Initialize visibility
  let activeCategory = 'all';
  let activeSource = 'all';

  function updateVisibility() {
    nodes.forEach(node => {
      if (node.type === 'category') {
        node.visible = activeCategory === 'all' || activeCategory === node.id;
      } else {
        const catMatch = activeCategory === 'all' || node.data.category === activeCategory;
        const srcMatch = activeSource === 'all' || node.data.source === activeSource;
        node.visible = catMatch && srcMatch;
      }
    });
    simulation.alpha(0.3).restart();
  }

  nodes.forEach(n => n.visible = true);

  // Build category filters
  const filterContainer = document.getElementById('category-filters');
  const allBtn = document.createElement('button');
  allBtn.className = 'cat-btn active';
  allBtn.textContent = '전체';
  allBtn.dataset.cat = 'all';
  filterContainer.appendChild(allBtn);

  data.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.textContent = cat.label;
    btn.dataset.cat = cat.id;
    filterContainer.appendChild(btn);
  });

  filterContainer.addEventListener('click', e => {
    const btn = e.target.closest('.cat-btn');
    if (!btn) return;
    filterContainer.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCategory = btn.dataset.cat;
    updateVisibility();
  });

  document.querySelectorAll('.source-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeSource = btn.dataset.source;
      updateVisibility();
    });
  });

  // Filter toggle for mobile
  const filterToggle = document.getElementById('filter-toggle');
  const filterPanel = document.getElementById('filter-panel');
  filterToggle.addEventListener('click', () => {
    filterPanel.classList.toggle('open');
    filterToggle.classList.toggle('active');
  });

  // Interaction: hover & click
  const tooltip = document.getElementById('tooltip');
  const detailPanel = document.getElementById('detail-panel');
  let hoveredNode = null;

  function getNodeAtPoint(px, py) {
    const x = (px - transform.x) / transform.k;
    const y = (py - transform.y) / transform.k;
    const hitPadding = isMobile ? 12 : 5;

    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (!node.visible || !node.x || !node.y) continue;
      const dx = x - node.x;
      const dy = y - node.y;
      // Compare squared distance (avoid sqrt)
      const distSq = dx * dx + dy * dy;
      const hitR = node.radius + hitPadding;
      if (distSq < hitR * hitR) return node;
    }
    return null;
  }

  // Desktop: mousemove for tooltip (throttled)
  let lastMouseMove = 0;
  canvas.addEventListener('mousemove', (e) => {
    if (isMobile) return;
    const now = performance.now();
    if (now - lastMouseMove < 32) return; // ~30fps throttle
    lastMouseMove = now;

    const node = getNodeAtPoint(e.clientX, e.clientY);

    if (node && node.type === 'news' && node.visible) {
      hoveredNode = node;
      canvas.style.cursor = 'pointer';

      const d = node.data;
      tooltip.querySelector('.tooltip-source').textContent =
        d.source === 'x.com' ? `𝕏 ${d.sourceHandle}` : d.source === 'threads' ? `Threads ${d.sourceHandle}` : `📰 ${d.sourceHandle}`;
      tooltip.querySelector('.tooltip-date').textContent = d.date;
      tooltip.querySelector('.tooltip-title').textContent = d.title;
      tooltip.querySelector('.tooltip-summary').textContent = d.summary;

      const tagsEl = tooltip.querySelector('.tooltip-tags');
      tagsEl.innerHTML = d.tags.map(t => `<span class="tag">#${t}</span>`).join('');

      let tx = e.clientX + 16;
      let ty = e.clientY + 16;
      if (tx + 320 > width) tx = e.clientX - 336;
      if (ty + 200 > height) ty = e.clientY - 200;
      tooltip.style.left = tx + 'px';
      tooltip.style.top = ty + 'px';
      tooltip.classList.remove('hidden');
    } else if (node && node.type === 'category') {
      canvas.style.cursor = 'pointer';
      tooltip.classList.add('hidden');
      hoveredNode = node;
    } else {
      hoveredNode = null;
      canvas.style.cursor = 'default';
      tooltip.classList.add('hidden');
    }
  });

  canvas.addEventListener('click', (e) => {
    if (isMobile) return;
    handleNodeInteraction(e.clientX, e.clientY);
  });

  // Mobile: touch handling
  let touchStartTime = 0;
  let touchStartPos = { x: 0, y: 0 };
  let touchDragNode = null;
  let isTouchDragging = false;

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartTime = Date.now();
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    isTouchDragging = false;

    const node = getNodeAtPoint(touch.clientX, touch.clientY);
    if (node) {
      touchDragNode = node;
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1 || !touchDragNode) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPos.x;
    const dy = touch.clientY - touchStartPos.y;

    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      isTouchDragging = true;
      const x = (touch.clientX - transform.x) / transform.k;
      const y = (touch.clientY - transform.y) / transform.k;
      touchDragNode.fx = x;
      touchDragNode.fy = y;
      simulation.alpha(0.3).restart();
    }
  }, { passive: true });

  canvas.addEventListener('touchend', (e) => {
    const elapsed = Date.now() - touchStartTime;

    if (touchDragNode) {
      touchDragNode.fx = null;
      touchDragNode.fy = null;
    }

    if (elapsed < 300 && !isTouchDragging) {
      handleNodeInteraction(touchStartPos.x, touchStartPos.y);
    }

    touchDragNode = null;
    isTouchDragging = false;
  }, { passive: true });

  function handleNodeInteraction(px, py) {
    const node = getNodeAtPoint(px, py);

    if (node && node.type === 'news' && node.visible) {
      showDetail(node.data);
    } else if (node && node.type === 'category') {
      activeCategory = node.id;
      filterContainer.querySelectorAll('.cat-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === node.id);
      });
      updateVisibility();
    } else {
      hideDetail();
    }
  }

  function showDetail(d) {
    detailPanel.querySelector('.detail-source').textContent =
      d.source === 'x.com' ? `𝕏 ${d.sourceHandle}` : d.source === 'threads' ? `Threads ${d.sourceHandle}` : `📰 ${d.sourceHandle}`;
    detailPanel.querySelector('.detail-title').textContent = d.title;
    detailPanel.querySelector('.detail-summary').textContent = d.summary;
    detailPanel.querySelector('.detail-tags').innerHTML =
      d.tags.map(t => `<span class="tag">#${t}</span>`).join('');
    detailPanel.querySelector('.detail-meta').innerHTML =
      `날짜: ${d.date}<br>카테고리: ${data.categories.find(c => c.id === d.category)?.label || d.category}`;
    detailPanel.querySelector('.detail-link').href = d.url;
    detailPanel.classList.remove('hidden');
  }

  function hideDetail() {
    detailPanel.classList.add('hidden');
  }

  document.getElementById('detail-close').addEventListener('click', (e) => {
    e.stopPropagation();
    hideDetail();
  });

  // Desktop drag behavior
  let dragNode = null;
  let isDragging = false;

  canvas.addEventListener('mousedown', (e) => {
    if (isMobile) return;
    const node = getNodeAtPoint(e.clientX, e.clientY);
    if (node) {
      dragNode = node;
      isDragging = false;
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isMobile || !dragNode) return;
    if (e.movementX !== 0 || e.movementY !== 0) {
      isDragging = true;
      const x = (e.clientX - transform.x) / transform.k;
      const y = (e.clientY - transform.y) / transform.k;
      dragNode.fx = x;
      dragNode.fy = y;
      simulation.alpha(0.3).restart();
    }
  });

  canvas.addEventListener('mouseup', () => {
    if (dragNode) {
      dragNode.fx = null;
      dragNode.fy = null;
      dragNode = null;
      isDragging = false;
    }
  });

})();
