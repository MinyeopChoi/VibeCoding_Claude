// AI News Feed — Network Graph Visualization
(async function () {
  const res = await fetch('/api/news');
  const data = await res.json();
  const today = new Date('2026-03-07');

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

  // Calculate age factor: 0 = oldest, 1 = newest
  function getAgeFactor(dateStr) {
    const d = new Date(dateStr);
    const diffDays = (today - d) / (1000 * 60 * 60 * 24);
    // 0 days = 1.0, 7+ days = 0.1
    return Math.max(0.1, 1.0 - (diffDays / 8));
  }

  function getNodeColor(news) {
    const base = d3.color(categoryColors[news.category] || '#79c0ff');
    const age = getAgeFactor(news.date);
    // Interpolate between very dark and base color
    const dark = d3.color('#1a1e24');
    return d3.interpolate(dark, base)(age);
  }

  function getNodeGlow(news) {
    const age = getAgeFactor(news.date);
    return age;
  }

  function getNodeRadius(news) {
    const age = getAgeFactor(news.date);
    return 6 + age * 10;
  }

  // Build graph data
  const nodes = [];
  const links = [];
  const nodeMap = new Map();

  // Add category nodes as larger central hubs
  data.categories.forEach(cat => {
    const catNode = {
      id: cat.id,
      label: cat.label,
      type: 'category',
      radius: 14,
      color: categoryColors[cat.id] || '#79c0ff',
      fx: null,
      fy: null
    };
    nodes.push(catNode);
    nodeMap.set(cat.id, catNode);
  });

  // Add news nodes
  data.news.forEach(n => {
    const newsNode = {
      id: n.id,
      label: n.title,
      type: 'news',
      data: n,
      radius: getNodeRadius(n),
      color: getNodeColor(n),
      glow: getNodeGlow(n)
    };
    nodes.push(newsNode);
    nodeMap.set(n.id, newsNode);

    // Link news to its category
    links.push({
      source: n.id,
      target: n.category,
      strength: 0.6
    });

    // Link related news
    if (n.relatedIds) {
      n.relatedIds.forEach(relId => {
        // Avoid duplicate links
        const existingLink = links.find(l =>
          (l.source === n.id && l.target === relId) ||
          (l.source === relId && l.target === n.id)
        );
        if (!existingLink) {
          links.push({
            source: n.id,
            target: relId,
            strength: 0.2
          });
        }
      });
    }
  });

  // Canvas setup
  const canvas = document.getElementById('graph-canvas');
  const ctx = canvas.getContext('2d');
  let width, height, dpr;

  function resize() {
    dpr = window.devicePixelRatio || 1;
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

  // Adjust forces for screen size
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
    .alphaDecay(0.015)
    .velocityDecay(0.4)
    .on('tick', draw);

  // Transform state for zoom/pan
  let transform = d3.zoomIdentity;

  const zoom = d3.zoom()
    .scaleExtent([0.3, 4])
    .on('zoom', (event) => {
      transform = event.transform;
      draw();
    });

  d3.select(canvas).call(zoom);

  // Animation
  let animTime = 0;

  function draw() {
    animTime += 0.02;
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // Draw links
    links.forEach(link => {
      const source = link.source;
      const target = link.target;
      if (!source.x || !target.x) return;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      const alpha = link.strength > 0.4 ? 0.15 : 0.06;
      ctx.strokeStyle = `rgba(136, 192, 255, ${alpha})`;
      ctx.lineWidth = link.strength > 0.4 ? 0.8 : 0.4;
      ctx.stroke();
    });

    // Draw nodes
    nodes.forEach(node => {
      if (!node.x || !node.y) return;

      if (!node.visible) return;

      ctx.save();

      if (node.type === 'category') {
        // Category hub node
        const pulse = 1 + Math.sin(animTime * 2) * 0.05;

        // Outer glow
        const gradient = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, node.radius * 2.5 * pulse
        );
        gradient.addColorStop(0, node.color + '40');
        gradient.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 2.5 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // Label
        ctx.font = '500 11px "Noto Sans KR", sans-serif';
        ctx.fillStyle = '#e6edf3';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(node.label, node.x, node.y + node.radius + 8);
      } else {
        // News node
        const glow = node.glow || 0.1;
        const pulse = 1 + Math.sin(animTime * 3 + node.x * 0.01) * 0.03 * glow;

        // Glow effect for newer news
        if (glow > 0.4) {
          const gradient = ctx.createRadialGradient(
            node.x, node.y, 0,
            node.x, node.y, node.radius * 3 * pulse
          );
          const glowAlpha = Math.floor(glow * 60).toString(16).padStart(2, '0');
          gradient.addColorStop(0, node.color + glowAlpha);
          gradient.addColorStop(1, 'transparent');
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius * 3 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        // Core circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // Bright center for new news
        if (glow > 0.6) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff' + Math.floor(glow * 80).toString(16).padStart(2, '0');
          ctx.fill();
        }
      }

      ctx.restore();
    });

    ctx.restore();

    requestAnimationFrame(draw);
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

  // Set all visible initially
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

  // Mobile detection
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

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
    // Transform screen coords to graph coords
    const x = (px - transform.x) / transform.k;
    const y = (py - transform.y) / transform.k;

    // Larger hit area on mobile
    const hitPadding = isMobile ? 12 : 5;

    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (!node.visible || !node.x || !node.y) continue;
      const dx = x - node.x;
      const dy = y - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < node.radius + hitPadding) return node;
    }
    return null;
  }

  // Desktop: mousemove for tooltip
  canvas.addEventListener('mousemove', (e) => {
    if (isMobile) return;
    const node = getNodeAtPoint(e.clientX, e.clientY);

    if (node && node.type === 'news' && node.visible) {
      hoveredNode = node;
      canvas.style.cursor = 'pointer';

      const d = node.data;
      tooltip.querySelector('.tooltip-source').textContent =
        d.source === 'x.com' ? `𝕏 ${d.sourceHandle}` : `Threads ${d.sourceHandle}`;
      tooltip.querySelector('.tooltip-date').textContent = d.date;
      tooltip.querySelector('.tooltip-title').textContent = d.title;
      tooltip.querySelector('.tooltip-summary').textContent = d.summary;

      const tagsEl = tooltip.querySelector('.tooltip-tags');
      tagsEl.innerHTML = d.tags.map(t => `<span class="tag">#${t}</span>`).join('');

      // Position tooltip
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

  // Desktop: click
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

    // Tap detection: short duration, no drag
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
      d.source === 'x.com' ? `𝕏 ${d.sourceHandle}` : `Threads ${d.sourceHandle}`;
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
