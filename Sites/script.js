(function () {
  const canvas = document.getElementById("brain-canvas");
  const header = document.querySelector(".site-header");
  const introScreen = document.querySelector(".intro-screen");
  const heroGlow = document.querySelector(".hero-glow");
  const revealNodes = document.querySelectorAll("[data-reveal]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let contour = [];

  if (introScreen) {
    document.body.classList.add("is-intro-active");

    const finishIntro = function () {
      introScreen.classList.add("is-hidden");
      document.body.classList.remove("is-intro-active");
      document.body.classList.add("is-loaded");
    };

    window.setTimeout(finishIntro, reduceMotion ? 120 : 1500);
  } else {
    document.body.classList.add("is-loaded");
  }

  if (header) {
    const syncHeader = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
    };

    syncHeader();
    window.addEventListener("scroll", syncHeader, { passive: true });
  }

  if (revealNodes.length) {
    if (reduceMotion) {
      revealNodes.forEach((node) => node.classList.add("is-visible"));
    } else {
      const observer = new IntersectionObserver(
        function (entries) {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        {
          threshold: 0.18,
          rootMargin: "0px 0px -8% 0px",
        }
      );

      revealNodes.forEach((node) => observer.observe(node));
    }
  }

  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const colors = [
    "#f5f2ff",
    "#ffffff",
    "#ffcf57",
    "#8052ff",
    "#15846e",
    "#b26cff",
    "#53abff",
  ];

  let width = 0;
  let height = 0;
  let ratio = 1;
  let animationFrame = 0;
  let time = 0;
  let particles = [];
  let stem = [];
  let ambient = [];
  let pointer = { x: 0, y: 0, active: false };

  function random(min, max) {
    return Math.random() * (max - min) + min;
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }

  function createScatterTarget() {
    return {
      scatterX: random(-width * 0.52, width * 0.52),
      scatterY: random(-height * 0.48, height * 0.48),
    };
  }

  function pointInsideBrainShape(x, y, radiusX, radiusY) {
    const left = Math.pow((x + radiusX * 0.22) / (radiusX * 0.84), 2)
      + Math.pow((y + radiusY * 0.03) / (radiusY * 0.92), 2);
    const right = Math.pow((x - radiusX * 0.24) / (radiusX * 0.76), 2)
      + Math.pow((y + radiusY * 0.03) / (radiusY * 0.9), 2);
    const crown = Math.pow(x / (radiusX * 0.68), 2)
      + Math.pow((y + radiusY * 0.28) / (radiusY * 0.6), 2);
    const lowerCut = Math.pow(x / (radiusX * 0.95), 2)
      + Math.pow((y - radiusY * 0.55) / (radiusY * 0.34), 2);

    return (left <= 1 || right <= 1 || crown <= 1) && lowerCut >= 1;
  }

  function createMainParticles(radiusX, radiusY, count) {
    const points = [];

    while (points.length < count) {
      const x = random(-radiusX, radiusX);
      const y = random(-radiusY * 0.98, radiusY * 0.92);

      if (!pointInsideBrainShape(x, y, radiusX, radiusY)) {
        continue;
      }

      const edgeBias = Math.abs(y) / radiusY;
      const lowerBias = y > radiusY * 0.18 ? 0.2 : 1;

      points.push({
        x,
        y,
        baseSize: random(1.6, 3.8) + edgeBias * 0.8,
        drift: random(0.2, 1.15),
        seed: random(0, Math.PI * 2),
        alpha: random(0.2, 0.9),
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: random(0, Math.PI * 2),
        depth: random(0.35, 1.25),
        link: Math.random() < 0.08 * lowerBias,
        ...createScatterTarget(),
      });
    }

    return points;
  }

  function createStem(radiusY, count) {
    return Array.from({ length: count }, () => ({
      x: random(-12, 18),
      y: random(radiusY * 0.88, radiusY * 1.7),
      baseSize: random(1.2, 2.2),
      drift: random(0.18, 0.45),
      seed: random(0, Math.PI * 2),
      alpha: random(0.12, 0.34),
      color: colors[Math.floor(Math.random() * 3)],
      rotation: random(0, Math.PI * 2),
      depth: random(0.4, 0.8),
      ...createScatterTarget(),
    }));
  }

  function createContourParticles(radiusX, radiusY, count) {
    return Array.from({ length: count }, () => {
      const side = Math.random() > 0.5 ? 1 : -1;
      const angle = random(-Math.PI * 0.02, Math.PI * 0.98);
      const arcX = Math.cos(angle) * radiusX * random(0.8, 1.05) * side;
      const arcY = Math.sin(angle) * radiusY * random(0.62, 1.02) - radiusY * 0.02;

      return {
        x: arcX + side * random(-18, 18),
        y: arcY + random(-16, 16),
        baseSize: random(2.4, 4.8),
        drift: random(0.22, 0.68),
        seed: random(0, Math.PI * 2),
        alpha: random(0.3, 0.88),
        color: Math.random() > 0.42 ? "#ffcf57" : colors[Math.floor(Math.random() * 2)],
        rotation: random(0, Math.PI * 2),
        depth: random(0.75, 1.45),
        ...createScatterTarget(),
      };
    });
  }

  function createAmbient(count) {
    return Array.from({ length: count }, () => ({
      x: random(0, width),
      y: random(0, height),
      baseSize: random(4, 10),
      speed: random(0.06, 0.18),
      seed: random(0, Math.PI * 2),
      alpha: random(0.08, 0.22),
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: random(0, Math.PI * 2),
    }));
  }

  function drawTriangle(x, y, size, color, alpha, rotation) {
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.beginPath();
    context.moveTo(0, -size);
    context.lineTo(size * 0.92, size * 0.82);
    context.lineTo(-size * 0.92, size * 0.82);
    context.closePath();
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.lineWidth = 1;
    context.stroke();
    context.restore();
  }

  function resize() {
    width = Math.max(320, Math.floor(window.innerWidth));
    height = Math.max(320, Math.floor(window.innerHeight));
    ratio = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const radiusX = width * 0.22;
    const radiusY = height * 0.3;
    const mainCount = width < 700 ? 720 : 1550;
    const stemCount = width < 700 ? 120 : 220;
    const contourCount = width < 700 ? 180 : 340;
    const ambientCount = width < 700 ? 24 : 48;

    particles = createMainParticles(radiusX, radiusY, mainCount);
    stem = createStem(radiusY, stemCount);
    contour = createContourParticles(radiusX, radiusY, contourCount);
    ambient = createAmbient(ambientCount);
  }

  function drawConnections(points, centerX, centerY, opacity) {
    context.save();
    context.strokeStyle = "rgba(255, 255, 255, " + opacity + ")";
    context.lineWidth = 1;

    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];

      if (!point.link || index % 3 !== 0) {
        continue;
      }

      const next = points[index + 18];

      if (!next) {
        continue;
      }

      context.beginPath();
      context.moveTo(centerX + point.currentX, centerY + point.currentY);
      context.lineTo(centerX + next.currentX, centerY + next.currentY);
      context.stroke();
    }

    context.restore();
  }

  function render() {
    time += reduceMotion ? 0.003 : 0.0085;
    context.clearRect(0, 0, width, height);

    const rawScrollProgress = clamp(window.scrollY / Math.max(window.innerHeight * 1.05, 1), 0, 1);
    const scrollProgress = easeOutCubic(rawScrollProgress);
    const centerX = lerp(width * 0.74, width * 0.5, scrollProgress);
    const centerY = lerp(height * 0.53, height * 0.48, scrollProgress);
    const pointerOffsetX = pointer.active ? (pointer.x - width * 0.5) * 0.032 * (1 - scrollProgress) : 0;
    const pointerOffsetY = pointer.active ? (pointer.y - height * 0.5) * 0.02 * (1 - scrollProgress) : 0;
    const animatedPoints = [];

    if (heroGlow) {
      heroGlow.style.opacity = String(lerp(0.8, 0.12, scrollProgress));
      heroGlow.style.transform = "scale(" + lerp(1, 1.22, scrollProgress) + ")";
    }

    context.save();
    context.globalCompositeOperation = "screen";

    ambient.forEach((particle, index) => {
      const x = particle.x + Math.sin(time + particle.seed) * 18;
      const y = particle.y + Math.cos(time * particle.speed + particle.seed) * 12;
      drawTriangle(
        x,
        y,
        particle.baseSize,
        particle.color,
        particle.alpha,
        particle.rotation + time + index * 0.015
      );
    });

    context.restore();

    const allParticles = particles.concat(contour, stem);

    allParticles.forEach((particle, index) => {
      const waveX = Math.sin(time * particle.drift + particle.seed) * 6 * particle.depth;
      const waveY = Math.cos(time * (particle.drift * 0.9) + particle.seed) * 5 * particle.depth;
      const shimmer = 0.82 + Math.sin(time * 2.1 + particle.seed) * 0.18;
      const brainX = particle.x + waveX + pointerOffsetX * particle.depth;
      const brainY = particle.y + waveY + pointerOffsetY * particle.depth;
      const scatterX = particle.scatterX + Math.sin(time * 0.7 + particle.seed) * 14 * particle.depth;
      const scatterY = particle.scatterY + Math.cos(time * 0.6 + particle.seed) * 10 * particle.depth;
      const currentX = lerp(brainX, scatterX, scrollProgress);
      const currentY = lerp(brainY, scatterY, scrollProgress);
      const currentSize = particle.baseSize * lerp(shimmer, 0.88 + shimmer * 0.34, scrollProgress);
      const baseAlpha = Math.min(1, particle.alpha + shimmer * 0.06);
      const currentAlpha = lerp(baseAlpha, Math.min(0.34, particle.alpha * 0.56 + 0.08), scrollProgress);
      const isStemParticle = index >= particles.length + contour.length;

      if (index < particles.length) {
        animatedPoints.push({
          currentX,
          currentY,
          link: particle.link,
        });
      }

      drawTriangle(
        centerX + currentX,
        centerY + currentY,
        currentSize,
        particle.color,
        isStemParticle ? currentAlpha * (1 - scrollProgress) : currentAlpha,
        particle.rotation + time * (particle.drift + scrollProgress * 0.6)
      );
    });

    drawConnections(animatedPoints, centerX, centerY, lerp(0.055, 0, scrollProgress));

    contour.forEach((particle, index) => {
      const waveX = Math.sin(time * particle.drift + particle.seed) * 8 * particle.depth;
      const waveY = Math.cos(time * particle.drift + particle.seed) * 6 * particle.depth;
      const scatterX = particle.scatterX + Math.sin(time * 0.7 + particle.seed) * 16 * particle.depth;
      const scatterY = particle.scatterY + Math.cos(time * 0.6 + particle.seed) * 12 * particle.depth;
      const currentX = lerp(particle.x + waveX, scatterX, scrollProgress);
      const currentY = lerp(particle.y + waveY, scatterY, scrollProgress);

      drawTriangle(
        centerX + currentX + pointerOffsetX * particle.depth * (1 - scrollProgress),
        centerY + currentY + pointerOffsetY * particle.depth * (1 - scrollProgress),
        particle.baseSize * lerp(1.18, 1.02, scrollProgress),
        particle.color,
        Math.min(1, particle.alpha + 0.16) * (1 - scrollProgress * 0.72),
        particle.rotation + time * (particle.drift + index * 0.0008)
      );
    });

    animationFrame = window.requestAnimationFrame(render);
  }

  function onPointerMove(event) {
    const bounds = canvas.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = true;
  }

  function onPointerLeave() {
    pointer.x = lerp(pointer.x, width * 0.5, 1);
    pointer.y = lerp(pointer.y, height * 0.5, 1);
    pointer.active = false;
  }

  resize();
  render();

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);

  window.addEventListener("resize", () => {
    window.cancelAnimationFrame(animationFrame);
    resize();
    render();
  });
})();
