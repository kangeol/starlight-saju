/**
 * V4 시네마틱 로딩 오버레이입니다.
 * requestAnimationFrame은 절제된 별 입자와 1~2개의 별똥별만 담당하고, SVG/CSS가 천문도 연출을 담당합니다.
 */
(function () {
  const steps = [
    { at: 0, text: "별의 흐름을 깨우는 중..." },
    { at: 800, text: "태어난 순간의 하늘을 펼치고 있습니다..." },
    { at: 1800, text: "사주팔자의 결을 맞추고 있습니다..." },
    { at: 2800, text: "오행의 균형을 읽고 있습니다..." },
    { at: 3800, text: "당신의 운명을 해석하고 있습니다..." },
    { at: 4800, text: "당신의 운명을 읽었습니다." },
  ];

  const minimumMs = 4000;
  const idealMs = 5400;
  const longWaitMs = 12000;

  let animationFrame = 0;
  let particles = [];
  let meteors = [];
  let ctx = null;
  let canvas = null;
  let startedAt = 0;
  let active = false;

  function start() {
    const overlay = document.querySelector("#cosmicLoading");
    const status = document.querySelector("#cosmicLoadingText");
    const longWait = document.querySelector("#cosmicLongWait");

    if (!overlay || !status) {
      return {
        finish: () => Promise.resolve(),
        fail: () => Promise.resolve(),
      };
    }

    startedAt = performance.now();
    active = true;
    overlay.classList.remove("hidden", "cosmic-loading--closing", "cosmic-loading--failed");
    overlay.setAttribute("aria-hidden", "false");
    overlay.classList.toggle("cosmic-loading--mobile-lite", isMobilePerformanceMode());
    status.textContent = steps[0].text;
    if (longWait) longWait.classList.add("hidden");

    const canvasEnabled = setupCanvas();
    updateStep();
    if (canvasEnabled) draw();

    return {
      finish,
      fail,
    };
  }

  async function finish() {
    const elapsed = performance.now() - startedAt;
    const waitFor = Math.max(minimumMs - elapsed, idealMs - elapsed, 0);

    await wait(waitFor);
    setStatus(steps[steps.length - 1].text);
    document.querySelector("#cosmicLoading")?.classList.add("cosmic-loading--closing");
    await wait(1050);
    stop();
  }

  async function fail(message) {
    setStatus(message || "현재 AI 분석 서버 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
    document.querySelector("#cosmicLoading")?.classList.add("cosmic-loading--failed");
    await wait(900);
    stop();
  }

  function stop() {
    const overlay = document.querySelector("#cosmicLoading");
    active = false;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    window.removeEventListener("resize", resizeCanvas);

    if (overlay) {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      overlay.classList.remove("cosmic-loading--closing", "cosmic-loading--failed");
    }
  }

  function setupCanvas() {
    canvas = document.querySelector("#cosmicCanvas");
    if (!canvas) return false;

    if (isMobilePerformanceMode()) {
      canvas.width = 0;
      canvas.height = 0;
      ctx = null;
      particles = [];
      meteors = [];
      return false;
    }

    ctx = canvas.getContext("2d", { alpha: true });
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });
    particles = createParticles();
    meteors = createMeteors();
    return true;
  }

  function resizeCanvas() {
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    if (ctx) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function createParticles() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const baseCount = Math.min(62, Math.floor(window.innerWidth / 7));
    const count = reducedMotion ? 18 : isMobilePerformanceMode() ? Math.max(6, Math.floor(baseCount * 0.2)) : baseCount;

    return Array.from({ length: count }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 1.15 + 0.35,
      speed: Math.random() * 0.08 + 0.02,
      alpha: Math.random() * 0.32 + 0.18,
      pulse: Math.random() * Math.PI * 2,
    }));
  }

  function createMeteors() {
    return Array.from({ length: 2 }, (_, index) => ({
      x: -180 - index * 360,
      y: 80 + Math.random() * window.innerHeight * 0.45,
      speed: 3.6 + Math.random() * 1.2,
      delay: 1900 + index * 1400,
      length: 150 + Math.random() * 90,
    }));
  }

  function draw() {
    if (!active || !ctx || !canvas) return;

    const elapsed = performance.now() - startedAt;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    drawParticles(elapsed);
    drawMeteors(elapsed);

    animationFrame = requestAnimationFrame(draw);
  }

  function drawParticles(elapsed) {
    particles.forEach((star) => {
      star.pulse += 0.018;
      star.y += star.speed;
      if (star.y > window.innerHeight + 6) star.y = -6;

      const alpha = star.alpha + Math.sin(star.pulse) * 0.16;
      ctx.beginPath();
      ctx.fillStyle = `rgba(231, 199, 125, ${Math.max(0.08, alpha)})`;
      ctx.shadowColor = "rgba(122, 92, 255, 0.42)";
      ctx.shadowBlur = 5;
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  function drawMeteors(elapsed) {
    if (elapsed < 1500) return;

    meteors.forEach((meteor) => {
      if (elapsed < meteor.delay) return;

      meteor.x += meteor.speed;
      meteor.y += meteor.speed * 0.42;

      if (meteor.x > window.innerWidth + 180) {
        meteor.x = -160;
        meteor.y = 40 + Math.random() * window.innerHeight * 0.5;
      }

      const gradient = ctx.createLinearGradient(
        meteor.x,
        meteor.y,
        meteor.x - meteor.length,
        meteor.y - meteor.length * 0.42,
      );
      gradient.addColorStop(0, "rgba(245, 233, 208, 0.68)");
      gradient.addColorStop(0.36, "rgba(231, 199, 125, 0.38)");
      gradient.addColorStop(1, "rgba(125, 183, 255, 0)");

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(meteor.x, meteor.y);
      ctx.lineTo(meteor.x - meteor.length, meteor.y - meteor.length * 0.42);
      ctx.stroke();
    });
  }

  function updateStep() {
    if (!active) return;

    const elapsed = performance.now() - startedAt;
    const current = steps.reduce((selected, step) => (elapsed >= step.at ? step : selected), steps[0]);
    setStatus(current.text);

    const longWait = document.querySelector("#cosmicLongWait");
    if (longWait) longWait.classList.toggle("hidden", elapsed < longWaitMs);

    window.setTimeout(updateStep, isMobilePerformanceMode() ? 220 : 120);
  }

  function setStatus(text) {
    const status = document.querySelector("#cosmicLoadingText");
    if (status) status.textContent = text;
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function isMobilePerformanceMode() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  window.CosmicLoading = {
    start,
    stop,
  };
})();
