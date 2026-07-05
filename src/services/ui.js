/**
 * 화면 렌더링 전담 모듈입니다.
 * app.js는 흐름만 관리하고, DOM 조작은 가능한 한 이 파일에 모았습니다.
 */
(function () {
  const scoreMap = {
    money: "재물운",
    career: "직장운",
    health: "건강운",
    love: "애정운",
    relationship: "대인운",
  };

  function qs(selector) {
    return document.querySelector(selector);
  }

  function setText(selector, value) {
    const element = qs(selector);
    if (element) element.textContent = value;
  }

  function showNotice(text) {
    const notice = qs("#noticeBar");
    if (!notice) return;
    notice.textContent = text || "";
    notice.classList.toggle("hidden", !text);
  }

  function setLoading(isLoading, stepText, progress) {
    qs("#loading").classList.toggle("hidden", !isLoading);

    if (isLoading) {
      qs("#result").classList.add("hidden");
      setText("#loadingStep", stepText || "우주의 문이 열리고 있습니다...");
      qs("#loadingProgress").style.width = `${progress || 12}%`;
    }
  }

  function renderResult(session) {
    const { saju, analysis } = session;

    setText("#totalScore", analysis.totalScore);
    setText("#starRating", createStars(analysis.totalScore));
    setText("#summary", analysis.summary);
    setText("#summaryEcho", analysis.summary);
    setText("#analysisMode", analysis.meta?.mode === "mock" ? "Mock Mode" : "API Mode");

    renderScores(analysis.scores);
    renderPillars(saju);
    window.AppChart.renderFiveElementChart(
      qs("#fiveElementsChart"),
      qs("#fiveElementsLegend"),
      saju.fiveElements,
    );
    window.AppAccordion.renderAccordion(qs("#accordion"), analysis.sections);
    renderLuckyItems(analysis.luckyItems);
    renderLuckCycle(saju.luckCycle);
    setText("#dominantFortuneText", window.ResultReveal.getDominantFortune(analysis.scores));

    if (window.AppConfig.getRuntimeConfig().ENABLE_AI_CHAT) {
      renderChat(session.chat || []);
    }

    qs("#result").classList.remove("hidden");
    window.ResultReveal.reveal(session);
    qs("#result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderScores(scores) {
    Object.entries(scoreMap).forEach(([key, label]) => {
      const value = Math.round(window.SajuUtils.clamp(scores[key], 0, 100));
      const card = qs(`[data-score="${key}"]`);
      if (!card) return;

      card.querySelector("span").textContent = label;
      card.querySelector("strong").textContent = value;
      card.querySelector("i").style.width = `${value}%`;
    });
  }

  function renderPillars(saju) {
    const items = [
      ["year", "년주"],
      ["month", "월주"],
      ["day", "일주"],
      ["hour", "시주"],
    ];

    items.forEach(([key, label]) => {
      const pillar = saju.pillars[key];
      const element = qs(`[data-pillar="${key}"]`);
      if (!element) return;

      element.querySelector("span").textContent = label;
      element.querySelector("strong").textContent = pillar.text;
      element.querySelector("small").textContent =
        pillar.stem === "미상" ? "태어난 시간 미상" : `${pillar.stem} / ${pillar.branch}`;
    });
  }

  function renderLuckyItems(items) {
    const container = qs("#luckyItems");
    const config = window.AppConfig.getRuntimeConfig();
    container.innerHTML = "";

    items.forEach((item) => {
      const article = document.createElement("article");
      article.className = "lucky-item";
      article.innerHTML = `
        <div>
          <strong>${escapeHtml(item.title || "행운 아이템")}</strong>
          <p>${escapeHtml(
            item.description ||
              "부족한 기운을 보완하는 상징 아이템입니다.",
          )}</p>
        </div>
        <a href="${escapeAttribute(item.url || config.recommendationBaseUrl)}" target="_blank" rel="noopener sponsored" aria-label="${escapeAttribute(item.title || "행운 아이템")} 보기">행운 아이템 보기</a>
      `;
      container.append(article);
    });
  }

  function renderLuckCycle(cycles) {
    const container = qs("#luckCycle");
    container.innerHTML = "";

    cycles.slice(0, 5).forEach((cycle) => {
      const item = document.createElement("li");
      item.innerHTML = `
        <span>${cycle.ageStart}-${cycle.ageEnd}세</span>
        <strong>${cycle.pillar}</strong>
        <small>${cycle.direction}</small>
      `;
      container.append(item);
    });
  }

  function renderRecent(readings, onSelect) {
    const container = qs("#recentList");
    container.innerHTML = "";

    if (!readings.length) {
      container.innerHTML = `<p class="empty-text">최근 본 사주가 없습니다.</p>`;
      return;
    }

    readings.forEach((reading) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "recent-item";
      button.setAttribute("aria-label", `${reading.name}님의 최근 사주 결과 열기`);
      button.innerHTML = `
        <span>${escapeHtml(reading.name)}</span>
        <strong>${reading.totalScore}점</strong>
        <small>${escapeHtml(reading.birthDate)}</small>
      `;
      button.addEventListener("click", () => onSelect(reading));
      container.append(button);
    });
  }

  function renderChat(chat, options = {}) {
    const container = qs("#chatMessages");
    if (!container) return;

    container.innerHTML = "";

    if (!chat.length && !options.typing) {
      container.innerHTML = `
        <div class="chat-empty">
          <span class="ai-avatar" aria-hidden="true">✦</span>
          <p>사주 결과를 바탕으로 궁금한 점을 질문해 보세요.</p>
        </div>
      `;
      return;
    }

    chat.forEach((message) => {
      container.append(createChatBubble(message));
    });

    if (options.typing) {
      container.append(createTypingBubble());
    }

    container.scrollTop = container.scrollHeight;
  }

  function createChatBubble(message) {
    const row = document.createElement("div");
    row.className = `chat-row chat-row--${message.role}`;

    if (message.role === "assistant") {
      const avatar = document.createElement("span");
      avatar.className = "ai-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = "✦";
      row.append(avatar);
    }

    const bubble = document.createElement("div");
    bubble.className = `chat-bubble chat-bubble--${message.role}`;
    bubble.textContent = message.content;
    row.append(bubble);

    return row;
  }

  function createTypingBubble() {
    const row = document.createElement("div");
    row.className = "chat-row chat-row--assistant";
    row.innerHTML = `
      <span class="ai-avatar" aria-hidden="true">✦</span>
      <div class="chat-bubble chat-bubble--assistant chat-bubble--typing">
        <span>별빛을 해석하는 중</span>
        <i></i><i></i><i></i>
      </div>
    `;
    return row;
  }

  function createStars(score) {
    const count = Math.max(1, Math.round(score / 20));
    return "★★★★★".slice(0, count).padEnd(5, "☆");
  }

  function showToast(message) {
    const toast = qs("#toast");
    toast.textContent = message;
    toast.classList.add("toast--visible");
    window.setTimeout(() => toast.classList.remove("toast--visible"), 2400);
  }

  function applyTheme(theme) {
    document.body.classList.remove("theme-dark", "theme-light");
    if (theme === "dark") document.body.classList.add("theme-dark");
    if (theme === "light") document.body.classList.add("theme-light");
    setText("#themeLabel", theme === "light" ? "Light" : theme === "dark" ? "Dark" : "Auto");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  window.AppUI = {
    applyTheme,
    qs,
    renderChat,
    renderRecent,
    renderResult,
    setLoading,
    setText,
    showNotice,
    showToast,
  };
})();
