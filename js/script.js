/* =========================================================
   ZEROCLUB — INTERACTION LAYER
   Organized into independent modules. Each module is self
   contained and only touches its own DOM nodes, so sections
   can be edited/removed without breaking the others.
   ========================================================= */

(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined';
  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------------------------------------------------------
     MODULE: Navigation — scroll state + mobile menu
     --------------------------------------------------------- */
  const NavModule = (() => {
    const nav = document.getElementById('nav');
    const menuBtn = document.getElementById('menuBtn');
    const mobileMenu = document.getElementById('mobileMenu');

    function onScroll() {
      nav.classList.toggle('is-scrolled', window.scrollY > 12);
    }

    function toggleMenu(open) {
      const isOpen = open ?? !mobileMenu.classList.contains('is-open');
      mobileMenu.classList.toggle('is-open', isOpen);
      menuBtn.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    }

    function init() {
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
      menuBtn.addEventListener('click', () => toggleMenu());
      mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => toggleMenu(false)));
    }
    return { init };
  })();

  /* ---------------------------------------------------------
     MODULE: Custom cursor — respond on move, expand on hover
     Skipped entirely on touch/coarse pointers.
     --------------------------------------------------------- */
  const CursorModule = (() => {
    const cursor = document.getElementById('cursor');
    const label = cursor.querySelector('.cursor-label');
    let x = 0, y = 0, curX = 0, curY = 0;

    function loop() {
      // gentle follow so it feels alive without being laggy
      curX += (x - curX) * 0.35;
      curY += (y - curY) * 0.35;
      cursor.style.transform = `translate(${curX}px, ${curY}px)`;
      requestAnimationFrame(loop);
    }

    function init() {
      if (!isFinePointer) return;
      window.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; });
      requestAnimationFrame(loop);

      document.querySelectorAll('[data-cursor-hover], a, button').forEach(el => {
        el.addEventListener('mouseenter', () => cursor.classList.add('is-hover'));
        el.addEventListener('mouseleave', () => cursor.classList.remove('is-hover'));
      });
    }

    function setProjectMode(on, text) {
      cursor.classList.toggle('is-project', on);
      label.textContent = text || '';
    }

    return { init, setProjectMode };
  })();

  /* ---------------------------------------------------------
     MODULE: Scroll reveal — GSAP ScrollTrigger.batch driven.
     One subtle fade + small rise per element, batched so
     sections that enter together animate together rather
     than firing one-by-one. Falls back to a plain class
     toggle if GSAP isn't available, and skips motion
     entirely under prefers-reduced-motion.
     --------------------------------------------------------- */
  const RevealModule = (() => {
    function init() {
      const upTargets = document.querySelectorAll('.reveal-up');
      const lineTargets = document.querySelectorAll('.reveal-line span');

      if (!hasGsap || !window.ScrollTrigger) {
        upTargets.forEach(t => t.classList.add('is-visible'));
        lineTargets.forEach(t => { t.style.transform = 'none'; });
        return;
      }

      if (prefersReducedMotion) {
        gsap.set(upTargets, { autoAlpha: 1 });
        gsap.set(lineTargets, { y: 0 });
        return;
      }

      gsap.set(upTargets, { autoAlpha: 0, y: 18 });

      ScrollTrigger.batch(upTargets, {
        start: 'top 88%',
        once: true,
        onEnter: (batch) => gsap.to(batch, {
          autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out', stagger: 0.08
        })
      });
    }
    return { init };
  })();

  /* ---------------------------------------------------------
     MODULE: Hero entrance — one subtle orchestrated sequence
     --------------------------------------------------------- */
  const HeroTimelineModule = (() => {
    function play() {
      if (!hasGsap || prefersReducedMotion) {
        document.documentElement.classList.add('no-js-ready'); // reveal instantly, no animation
        return;
      }

      const lines = document.querySelectorAll('.reveal-line span');
      const eyebrow = document.querySelector('.hero-inner .hero-status-floating, .hero-inner .eyebrow-pill, .hero-inner .eyebrow');
      const rest = document.querySelectorAll('.hero-inner .hero-sub, .hero-inner .hero-actions, .hero-inner .hero-badges');

      gsap.set(lines, { y: '110%' });
      if (eyebrow) gsap.set(eyebrow, { autoAlpha: 0, y: 14 });
      gsap.set(rest, { autoAlpha: 0, y: 16 });

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      if (eyebrow) tl.to(eyebrow, { autoAlpha: 1, y: 0, duration: 0.6 });
      tl.to(lines, { y: '0%', duration: 0.85, stagger: 0.09 }, '-=0.35')
        .to(rest, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.1 }, '-=0.45');
    }

    function init() {
      // If loader is present, loader will call play() on explosion. Otherwise play immediately.
      if (!document.getElementById('siteLoader')) {
        play();
      }
    }
    return { init, play };
  })();

  /* ---------------------------------------------------------
     MODULE: Hero interactive grid — reactive to pointer
     Fades globally, darkens/intensifies near pointer, and
     stretches gravitationally towards the cursor.
     --------------------------------------------------------- */
  const HeroGridModule = (() => {
    function init() {
      const canvas = document.getElementById('heroGridCanvas');
      const section = document.getElementById('top');
      if (!canvas || !section) return;

      const ctx = canvas.getContext('2d');
      let w = 0, h = 0, dpr = 1;
      let mouse = { x: -9999, y: -9999, targetX: -9999, targetY: -9999, active: false };

      function resize() {
        const rect = section.getBoundingClientRect();
        w = Math.max(1, Math.round(rect.width));
        h = Math.max(1, Math.round(rect.height));
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      window.addEventListener('pointermove', (e) => {
        const rect = section.getBoundingClientRect();
        if (
          e.clientX >= rect.left - 80 &&
          e.clientX <= rect.right + 80 &&
          e.clientY >= rect.top - 80 &&
          e.clientY <= rect.bottom + 80
        ) {
          mouse.targetX = e.clientX - rect.left;
          mouse.targetY = e.clientY - rect.top;
          mouse.active = true;
        } else {
          mouse.active = false;
        }
      }, { passive: true });

      window.addEventListener('pointerleave', () => {
        mouse.active = false;
      });

      if ('ResizeObserver' in window) {
        new ResizeObserver(resize).observe(section);
      } else {
        window.addEventListener('resize', resize);
      }
      resize();

      const cellSize = 56;
      const gravityRadius = 240;
      const gravityStrength = 42; // pull in pixels directly towards pointer

      function getDisplacedPoint(gx, gy) {
        if (!mouse.active) return { x: gx, y: gy, dist: 9999, influence: 0 };
        const dx = mouse.x - gx;
        const dy = mouse.y - gy;
        const dist = Math.hypot(dx, dy);
        if (dist >= gravityRadius || dist < 0.001) {
          return { x: gx, y: gy, dist, influence: 0 };
        }
        // Smooth gravitational pull curve directly towards mouse pointer
        const factor = 1 - dist / gravityRadius;
        // Strong quadratic pull sticking towards cursor
        const pull = Math.min(dist * 0.7, factor * factor * gravityStrength);
        const nx = dx / dist;
        const ny = dy / dist;
        return {
          x: gx + nx * pull,
          y: gy + ny * pull,
          dist,
          influence: factor
        };
      }

      function draw() {
        ctx.clearRect(0, 0, w, h);

        // Smooth mouse follower
        if (mouse.active) {
          if (mouse.x < -1000) { mouse.x = mouse.targetX; mouse.y = mouse.targetY; }
          else {
            mouse.x += (mouse.targetX - mouse.x) * 0.18;
            mouse.y += (mouse.targetY - mouse.y) * 0.18;
          }
        } else {
          mouse.x += (-9999 - mouse.x) * 0.1;
          mouse.y += (-9999 - mouse.y) * 0.1;
        }

        const isLight = document.documentElement.getAttribute('data-theme') === 'light';

        const cols = Math.ceil(w / cellSize) + 2;
        const rows = Math.ceil(h / cellSize) + 2;
        const offsetX = (w % cellSize) / 2;
        const offsetY = (h % cellSize) / 2;

        // Precompute grid vertices with gravity displacement
        const grid = [];
        for (let r = 0; r <= rows; r++) {
          grid[r] = [];
          const gy = r * cellSize + offsetY - cellSize;
          for (let c = 0; c <= cols; c++) {
            const gx = c * cellSize + offsetX - cellSize;
            grid[r][c] = getDisplacedPoint(gx, gy);
          }
        }

        // 1. Draw horizontal grid lines segment by segment for localized darkening/depth
        for (let r = 0; r <= rows; r++) {
          for (let c = 0; c < cols; c++) {
            const p1 = grid[r][c];
            const p2 = grid[r][c + 1];
            const maxInf = Math.max(p1.influence, p2.influence);

            // Distance fade mask from hero center so grid fades gracefully at outer edges
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            const edgDist = Math.hypot((midX - w * 0.5) / (w * 0.52), (midY - h * 0.42) / (h * 0.52));
            const edgeFade = Math.max(0, 1 - edgDist * 0.75);

            if (edgeFade <= 0.01) continue;

            let alpha, lineWidth, strokeStyle;
            if (isLight) {
              // In light mode: darkens and gets sharper near pointer
              const baseAlpha = 0.08 * edgeFade;
              alpha = baseAlpha + maxInf * 0.45;
              lineWidth = 1 + maxInf * 1.2;
              strokeStyle = maxInf > 0.45 ? `rgba(255, 75, 34, ${alpha})` : `rgba(13, 17, 23, ${alpha})`;
            } else {
              // In dark mode: base grid is faint/faded, darkens into deep stark contrast and bright accent
              const baseAlpha = 0.09 * edgeFade;
              alpha = baseAlpha + maxInf * 0.55;
              lineWidth = 1 + maxInf * 1.4;
              strokeStyle = maxInf > 0.5 ? `rgba(255, 75, 34, ${alpha})` : `rgba(237, 238, 240, ${alpha})`;
            }

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
          }
        }

        // 2. Draw vertical grid lines segment by segment
        for (let c = 0; c <= cols; c++) {
          for (let r = 0; r < rows; r++) {
            const p1 = grid[r][c];
            const p2 = grid[r + 1][c];
            const maxInf = Math.max(p1.influence, p2.influence);

            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            const edgDist = Math.hypot((midX - w * 0.5) / (w * 0.52), (midY - h * 0.42) / (h * 0.52));
            const edgeFade = Math.max(0, 1 - edgDist * 0.75);

            if (edgeFade <= 0.01) continue;

            let alpha, lineWidth, strokeStyle;
            if (isLight) {
              const baseAlpha = 0.08 * edgeFade;
              alpha = baseAlpha + maxInf * 0.45;
              lineWidth = 1 + maxInf * 1.2;
              strokeStyle = maxInf > 0.45 ? `rgba(255, 75, 34, ${alpha})` : `rgba(13, 17, 23, ${alpha})`;
            } else {
              const baseAlpha = 0.09 * edgeFade;
              alpha = baseAlpha + maxInf * 0.55;
              lineWidth = 1 + maxInf * 1.4;
              strokeStyle = maxInf > 0.5 ? `rgba(255, 75, 34, ${alpha})` : `rgba(237, 238, 240, ${alpha})`;
            }

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
          }
        }

        // 3. Grid intersection crosshairs / gravitational gravity dots
        for (let r = 0; r <= rows; r++) {
          for (let c = 0; c <= cols; c++) {
            const p = grid[r][c];
            if (p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10) continue;

            const edgDist = Math.hypot((p.x - w * 0.5) / (w * 0.52), (p.y - h * 0.42) / (h * 0.52));
            const edgeFade = Math.max(0, 1 - edgDist * 0.75);
            if (edgeFade <= 0.01) continue;

            const inf = p.influence;
            const dotSize = (1.5 + inf * 2.2);
            ctx.beginPath();
            ctx.arc(p.x, p.y, dotSize, 0, Math.PI * 2);

            if (inf > 0.4) {
              ctx.fillStyle = `rgba(255, 75, 34, ${0.4 + inf * 0.55})`;
            } else {
              const baseAlpha = (isLight ? 0.16 : 0.22) * edgeFade;
              ctx.fillStyle = isLight
                ? `rgba(13, 17, 23, ${baseAlpha + inf * 0.5})`
                : `rgba(237, 238, 240, ${baseAlpha + inf * 0.5})`;
            }
            ctx.fill();
          }
        }

        requestAnimationFrame(draw);
      }

      requestAnimationFrame(draw);
    }

    return { init };
  })();

  /* ---------------------------------------------------------
     MODULE: Services accordion — built from ZC_DATA.services
     --------------------------------------------------------- */
  const ServicesModule = (() => {
    function render() {
      const list = document.getElementById('serviceList');
      list.innerHTML = ZC_DATA.services.map((s, i) => `
        <div class="service-row" data-index="${i}">
          <button class="service-head" aria-expanded="false">
            <span class="service-num">${s.n}</span>
            <span class="service-title">${s.title}</span>
            <span class="service-plus" aria-hidden="true"></span>
          </button>
          <div class="service-body">
            <div class="service-body-inner">
              <p class="service-short">${s.short}</p>
              <div class="service-tags">${s.items.map(t => `<span>${t}</span>`).join('')}</div>
            </div>
          </div>
        </div>
      `).join('');

      list.querySelectorAll('.service-row').forEach(row => {
        const head = row.querySelector('.service-head');
        const body = row.querySelector('.service-body');
        head.addEventListener('click', () => {
          const isOpen = row.classList.contains('is-open');
          // close others for a cleaner editorial feel
          list.querySelectorAll('.service-row.is-open').forEach(r => {
            if (r !== row) {
              r.classList.remove('is-open');
              r.querySelector('.service-body').style.maxHeight = null;
              r.querySelector('.service-head').setAttribute('aria-expanded', 'false');
            }
          });
          row.classList.toggle('is-open', !isOpen);
          head.setAttribute('aria-expanded', String(!isOpen));
          body.style.maxHeight = !isOpen ? body.scrollHeight + 'px' : null;
        });
      });
    }
    return { render };
  })();

  /* ---------------------------------------------------------
     MODULE: Technology — marquee + grouped list from ZC_DATA.tech
     --------------------------------------------------------- */
  const TechModule = (() => {
    function render() {
      const flat = Object.values(ZC_DATA.tech).flat();
      const track = document.getElementById('techMarquee');
      const loopText = flat.join(' — ');
      track.innerHTML = `<span>${loopText} — </span><span>${loopText} — </span>`;

      const groupsEl = document.getElementById('techGroups');
      const entries = Object.entries(ZC_DATA.tech);
      groupsEl.innerHTML = `<div class="service-list tech-accordion">${entries.map(([group, items], i) => `
        <div class="service-row" data-index="${i}">
          <button class="service-head" aria-expanded="false">
            <span class="service-num">${String(i + 1).padStart(2, '0')}</span>
            <span class="service-title">${group}</span>
            <span class="service-plus" aria-hidden="true"></span>
          </button>
          <div class="service-body">
            <div class="service-body-inner tech-body-inner">
              <div class="service-tags">${items.map(t => `<span>${t}</span>`).join('')}</div>
            </div>
          </div>
        </div>
      `).join('')}</div>`;

      groupsEl.querySelectorAll('.service-row').forEach(row => {
        const head = row.querySelector('.service-head');
        const body = row.querySelector('.service-body');
        head.addEventListener('click', () => {
          const isOpen = row.classList.contains('is-open');
          groupsEl.querySelectorAll('.service-row.is-open').forEach(r => {
            if (r !== row) {
              r.classList.remove('is-open');
              r.querySelector('.service-body').style.maxHeight = null;
              r.querySelector('.service-head').setAttribute('aria-expanded', 'false');
            }
          });
          row.classList.toggle('is-open', !isOpen);
          head.setAttribute('aria-expanded', String(!isOpen));
          body.style.maxHeight = !isOpen ? body.scrollHeight + 'px' : null;
        });
      });
    }
    return { render };
  })();

  /* ---------------------------------------------------------
     MODULE: Process timeline — from ZC_DATA.process
     --------------------------------------------------------- */
  const ProcessModule = (() => {
    function render() {
      const list = document.getElementById('processList');
      list.innerHTML = ZC_DATA.process.map(p => `
        <div class="process-row reveal-up">
          <span class="process-num">${p.n}</span>
          <span class="process-title">${p.title}</span>
          <span class="process-body">${p.body}</span>
        </div>
      `).join('');
    }
    return { render };
  })();

  /* ---------------------------------------------------------
     MODULE: FAQ accordion — from ZC_DATA.faq
     --------------------------------------------------------- */
  const FaqModule = (() => {
    function render() {
      const list = document.getElementById('faqList');
      list.innerHTML = ZC_DATA.faq.map((item, i) => `
        <div class="faq-row" data-index="${i}">
          <button class="faq-q" aria-expanded="false">
            <span>${item.q}</span>
            <span class="faq-icon" aria-hidden="true">+</span>
          </button>
          <div class="faq-a"><div class="faq-a-inner">${item.a}</div></div>
        </div>
      `).join('');

      list.querySelectorAll('.faq-row').forEach(row => {
        const q = row.querySelector('.faq-q');
        const a = row.querySelector('.faq-a');
        q.addEventListener('click', () => {
          const isOpen = row.classList.contains('is-open');
          row.classList.toggle('is-open', !isOpen);
          q.setAttribute('aria-expanded', String(!isOpen));
          a.style.maxHeight = !isOpen ? a.scrollHeight + 'px' : null;
        });
      });
    }
    return { render };
  })();

  /* ---------------------------------------------------------
     MODULE: Selected Work — project list + case-study overlay
     --------------------------------------------------------- */
  const WorkModule = (() => {
    function drawProjectVisual(canvas, seed) {
      // lightweight generated abstract visual per project, no stock photos
      const ctx = canvas.getContext('2d');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = rect.width, h = rect.height;

      let s = seed;
      const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      ctx.fillStyle = isLight ? '#EEF1F6' : '#101319';
      ctx.fillRect(0, 0, w, h);

      // grid
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
      for (let x = 0; x < w; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

      // abstract nodes + connectors, themed by seed
      const nodes = [];
      const count = 7 + Math.floor(rand() * 4);
      for (let i = 0; i < count; i++) {
        nodes.push({ x: rand() * w, y: rand() * h, r: 3 + rand() * 6 });
      }
      ctx.strokeStyle = 'rgba(255,75,34,0.35)';
      nodes.forEach((n, i) => {
        const next = nodes[(i + 1) % nodes.length];
        ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(next.x, next.y); ctx.stroke();
      });
      nodes.forEach((n, i) => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = i % 3 === 0 ? '#FF4B22' : (isLight ? 'rgba(30,34,43,0.55)' : 'rgba(237,238,240,0.55)');
        ctx.fill();
      });
    }

    function renderList() {
      const list = document.getElementById('projectList');
      list.innerHTML = ZC_DATA.projects.map(p => `
        <article class="project-card" data-id="${p.id}" tabindex="0" role="button" aria-label="View ${p.name} case study">
          <div class="project-visual">
            ${p.image ? `<img src="${p.image}" alt="${p.name}" class="pv-img" loading="lazy">` : `<canvas class="pv-canvas"></canvas>`}
          </div>
          <div class="project-info">
            <p class="project-eyebrow">${p.n} — ${p.category}</p>
            <h3 class="project-name">${p.name} <span class="arrow-icon">↗</span></h3>
            <p class="project-summary">${p.summary}</p>
            <div class="project-tech">${p.tech.map(t => `<span>${t}</span>`).join('')}</div>
          </div>
        </article>
      `).join('');

      list.querySelectorAll('.project-card').forEach((card, i) => {
        const canvas = card.querySelector('.pv-canvas');
        if (canvas) drawProjectVisual(canvas, (i + 1) * 137);

        const open = () => Overlay.open(card.dataset.id);
        card.addEventListener('click', open);
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });

        card.addEventListener('mouseenter', () => CursorModule.setProjectMode(true, 'VIEW PROJECT →'));
        card.addEventListener('mouseleave', () => CursorModule.setProjectMode(false));
      });
    }

    const Overlay = (() => {
      const el = document.getElementById('projectOverlay');
      const content = document.getElementById('overlayContent');
      const closeBtn = document.getElementById('overlayClose');
      let lastFocused = null;

      function template(p) {
        const noteHtml = p.note ? `<span class="ov-note">${p.note}</span><br>` : '';
        return `
          ${noteHtml}
          <p class="ov-eyebrow">${p.n} — ${p.category}</p>
          <h2 class="ov-title" id="overlayTitle">${p.name}</h2>
          <p class="ov-summary">${p.summary}</p>
          <div class="ov-visual">
            ${p.image ? `<img src="${p.image}" alt="${p.name}" class="ov-img">` : `<canvas class="pv-canvas" id="ovCanvas"></canvas>`}
          </div>

          <div class="ov-block"><h4>The problem</h4><p>${p.problem}</p></div>
          <div class="ov-block"><h4>The approach</h4><p>${p.approach}</p></div>
          <div class="ov-block"><h4>The build</h4><p>${p.build}</p></div>

          <div class="ov-block">
            <h4>Features</h4>
            <ul class="ov-features">${p.features.map(f => `<li>${f}</li>`).join('')}</ul>
          </div>

          <div class="ov-block"><h4>The result</h4><p>${p.result}</p></div>

          <div class="ov-block">
            <h4>Technology</h4>
            <div class="ov-tech">${p.tech.map(t => `<span>${t}</span>`).join('')}</div>
          </div>
        `;
      }

      function open(id) {
        const p = ZC_DATA.projects.find(x => x.id === id);
        if (!p) return;
        content.innerHTML = template(p);
        const canvas = document.getElementById('ovCanvas');
        if (canvas) {
          const seed = (p.n * 1) * 211 + 5;
          canvas.dataset.seed = String(seed);
          drawProjectVisual(canvas, seed);
        }

        lastFocused = document.activeElement;
        el.classList.add('is-open');
        el.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        closeBtn.focus();
        document.addEventListener('keydown', onKeydown);
      }

      function close() {
        el.classList.remove('is-open');
        el.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        document.removeEventListener('keydown', onKeydown);
        if (lastFocused) lastFocused.focus();
      }

      function onKeydown(e) { if (e.key === 'Escape') close(); }

      closeBtn.addEventListener('click', close);
      el.addEventListener('click', (e) => { if (e.target === el) close(); });

      return { open, close };
    })();

    function init() {
      renderList();
      window.addEventListener('themechange', () => {
        document.querySelectorAll('.project-card .pv-canvas').forEach((canvas, i) => {
          drawProjectVisual(canvas, (i + 1) * 137);
        });
        const ovCanvas = document.getElementById('ovCanvas');
        if (ovCanvas) {
          const openCard = document.querySelector('.project-card.is-active');
          const seed = ovCanvas.dataset.seed ? Number(ovCanvas.dataset.seed) : 100;
          drawProjectVisual(ovCanvas, seed);
        }
      });
    }
    return { init };
  })();

  /* ---------------------------------------------------------
     MODULE: Featured Work dropdown — the project list starts
     collapsed so the page doesn't force a long scroll past
     four large case-study cards; one click reveals them.
     --------------------------------------------------------- */
  const WorkToggleModule = (() => {
    function init() {
      const toggle = document.getElementById('workToggle');
      const collapse = document.getElementById('workCollapse');
      const label = toggle.querySelector('.work-toggle-label');
      let isOpen = false;

      toggle.addEventListener('click', () => {
        isOpen = !isOpen;
        toggle.setAttribute('aria-expanded', String(isOpen));
        label.textContent = isOpen ? 'Hide projects' : 'Show projects';

        const targetHeight = isOpen ? collapse.scrollHeight : 0;

        if (hasGsap) {
          gsap.to(collapse, {
            height: targetHeight,
            duration: prefersReducedMotion ? 0.01 : 0.6,
            ease: 'power2.inOut',
            onComplete: () => { if (isOpen) collapse.style.height = 'auto'; }
          });
        } else {
          collapse.style.height = isOpen ? 'auto' : '0px';
        }

        if (isOpen) toggle.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      });
    }
    return { init };
  })();

  /* ---------------------------------------------------------
     MODULE: Footer brick-breaker (v3)
     Inspired by the reference screenshots:
     - Ball + paddle sit at the bottom of the FULL viewport overlay
     - Bricks are sampled from the actual large ZEROCLUB text
       rendered onto the canvas — letters break character by character
     - Score multiplier, lives, win/lose modal with confetti
  /* ---------------------------------------------------------
     MODULE: Footer brick-breaker (v4 — in-place)

     Reference: Kommersense footer game.
     - NO full-screen overlay / separate screen
     - A <canvas> is injected directly INSIDE the footer,
       positioned absolute to cover it exactly
     - Bricks are pixel-sampled from the REAL rendered footer
       text at their ACTUAL screen positions inside the footer
       (logo, tagline, nav links, copyright, "Built from zero.")
     - Ball + paddle float over the real footer content
     - HUD (SCORE · xCOMBO · LIVES  ×) sits top-right of footer
     - Clicking anywhere on the footer that isn't an active link
       starts/serves the game
     - Real text fades out once game starts so the brick layer
     MODULE: Contact form
     Submits to Formspree-style endpoint. Replace FORM_ENDPOINT
     below with a real endpoint (see README.md) — until then
     it falls back to opening the user's mail client so the
     form always produces a real message either way.
     --------------------------------------------------------- */
  const ContactModule = (() => {
    const FORM_ENDPOINT = ''; // e.g. 'https://formspree.io/f/xxxxxxx' — see README.md

    function init() {
      const form = document.getElementById('contactForm');
      const status = document.getElementById('formStatus');
      const btn = document.getElementById('submitBtn');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // honeypot check
        if (form._gotcha.value) return;

        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }

        const data = Object.fromEntries(new FormData(form).entries());
        btn.disabled = true;
        btn.querySelector('.btn-label').textContent = 'Sending…';
        status.textContent = '';
        status.className = 'form-status';

        try {
          if (FORM_ENDPOINT) {
            const res = await fetch(FORM_ENDPOINT, {
              method: 'POST',
              headers: { 'Accept': 'application/json' },
              body: new FormData(form)
            });
            if (!res.ok) throw new Error('Request failed');
            status.textContent = 'Thanks — your message has been received. I\u2019ll get back to you as soon as possible.';
            status.classList.add('is-success');
            form.reset();
          } else {
            // No backend configured yet — open a pre-filled email as a working fallback.
            const subject = encodeURIComponent(`New project inquiry — ${data.need || 'General'}`);
            const body = encodeURIComponent(
              `Name: ${data.name}\nEmail: ${data.email}\nCompany: ${data.company || '-'}\nNeed: ${data.need}\nBudget: ${data.budget || 'Not specified'}\n\n${data.message}`
            );
            window.location.href = `mailto:hellothisismeashutosh@gmail.com?subject=${subject}&body=${body}`;
            status.textContent = 'Opening your email client to send this inquiry…';
            status.classList.add('is-success');
          }
        } catch (err) {
          status.textContent = 'Something went wrong sending that. Please email hellothisismeashutosh@gmail.com directly.';
          status.classList.add('is-error');
        } finally {
          btn.disabled = false;
          btn.querySelector('.btn-label').textContent = 'Send project inquiry ↗';
        }
      });
    }
    return { init };
  })();

  /* ---------------------------------------------------------
     MODULE: Site Preloader — bouncing & exploding signal ball
     --------------------------------------------------------- */
  const LoaderModule = (() => {
    const loader = document.getElementById('siteLoader');
    const bar = document.getElementById('loaderProgressBar');

    function init() {
      if (!loader) {
        HeroTimelineModule.play();
        return;
      }

      let progress = 0;
      const progressTimer = setInterval(() => {
        progress = Math.min(progress + Math.random() * 25, 94);
        if (bar) bar.style.width = `${progress}%`;
      }, 100);

      let hasFinished = false;
      const finishLoading = () => {
        if (hasFinished) return;
        hasFinished = true;
        clearInterval(progressTimer);
        if (bar) bar.style.width = '100%';

        // Ensure user enjoys the energetic bounce animation briefly before explosion
        setTimeout(() => {
          loader.classList.add('is-exploding');

          // Trigger Hero entrance animation synchronously as the ball blast clears
          setTimeout(() => {
            HeroTimelineModule.play();
          }, 260);

          // Cleanly remove loader after explosion transition
          setTimeout(() => {
            loader.classList.add('is-done');
            loader.setAttribute('aria-hidden', 'true');
          }, 650);
        }, 400);
      };

      if (document.readyState === 'complete') {
        setTimeout(finishLoading, 650);
      } else {
        window.addEventListener('load', () => {
          setTimeout(finishLoading, 450);
        }, { once: true });
        // Safety timeout so site is never blocked if network stalls
        setTimeout(finishLoading, 2800);
      }
    }

    return { init };
  })();

  /* ---------------------------------------------------------
     MODULE: Theme switcher & persistence (Circular Reveal)
     --------------------------------------------------------- */
  const ThemeModule = (() => {
    const desktopBtn = document.getElementById('themeToggle');
    const mobileBtn = document.getElementById('mobileThemeToggle');

    function getCurrentTheme() {
      return document.documentElement.getAttribute('data-theme') ||
        (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    }

    function updateA11y(theme) {
      const isLight = theme === 'light';
      const label = isLight ? 'Switch to dark mode' : 'Switch to light mode';
      if (desktopBtn) {
        desktopBtn.setAttribute('aria-label', label);
        desktopBtn.setAttribute('title', label);
      }
      if (mobileBtn) {
        mobileBtn.setAttribute('aria-label', label);
        const icon = mobileBtn.querySelector('.mobile-theme-icon');
        const text = mobileBtn.querySelector('.mobile-theme-label');
        if (icon) icon.textContent = isLight ? '🌙' : '☀️';
        if (text) text.textContent = isLight ? 'Dark Mode' : 'Light Mode';
      }
    }

    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      try {
        localStorage.setItem('zeroclub-theme', theme);
      } catch (e) { }
      updateA11y(theme);
      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    }

    function toggle(e) {
      const current = getCurrentTheme();
      const next = current === 'light' ? 'dark' : 'light';

      // Capture origin coordinates from the click event or button center
      let x, y;
      if (e && typeof e.clientX === 'number' && e.clientX > 0) {
        x = e.clientX;
        y = e.clientY;
      } else if (e && e.currentTarget) {
        const rect = e.currentTarget.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      } else {
        x = window.innerWidth / 2;
        y = 36;
      }

      // If View Transitions API is supported and motion not reduced, perform circular reveal
      if (document.startViewTransition && !prefersReducedMotion) {
        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );

        const transition = document.startViewTransition(() => {
          applyTheme(next);
        });

        transition.ready.then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`
              ]
            },
            {
              duration: 540,
              easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
              pseudoElement: '::view-transition-new(root)'
            }
          );
        });
      } else {
        applyTheme(next);
      }
    }

    function init() {
      const current = getCurrentTheme();
      updateA11y(current);

      if (desktopBtn) desktopBtn.addEventListener('click', (e) => toggle(e));
      if (mobileBtn) mobileBtn.addEventListener('click', (e) => toggle(e));

      // System preference listener (only activates if user hasn't set manual preference)
      try {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        mq.addEventListener('change', (e) => {
          if (!localStorage.getItem('zeroclub-theme')) {
            applyTheme(e.matches ? 'dark' : 'light');
          }
        });
      } catch (err) { }
    }

    return { init, setTheme: applyTheme, getCurrentTheme, toggle };
  })();

  /* ---------------------------------------------------------
     BOOT
     --------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    LoaderModule.init();
    ThemeModule.init();
    NavModule.init();
    CursorModule.init();
    ServicesModule.render();
    TechModule.render();
    ProcessModule.render();
    FaqModule.render();
    WorkModule.init();
    WorkToggleModule.init();
    ContactModule.init();
    HeroGridModule.init();
    HeroTimelineModule.init();
    RevealModule.init(); // last, so injected content above is present to observe
  });
})();
