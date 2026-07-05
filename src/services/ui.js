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

  function applyFeatureFlags(config) {
    const featureMap = {
      "ai-chat": config.ENABLE_AI_CHAT,
      "lucky-items": config.ENABLE_LUCKY_ITEMS,
      compatibility: config.ENABLE_COMPATIBILITY,
      "share-card": config.ENABLE_SHARE_CARD,
      "pdf-export": config.ENABLE_PDF_EXPORT,
      premium: config.ENABLE_PREMIUM,
    };

    Object.entries(featureMap).forEach(([feature, isEnabled]) => {
      if (isEnabled) return;

      document.querySelectorAll(`[data-feature="${feature}"]`).forEach((element) => {
        element.remove();
      });
    });

    document.querySelectorAll(".action-row").forEach((row) => {
      if (!row.children.length) row.remove();
    });
  }

  function setLoading(isLoading, stepText, progress) {
    qs("#loading").classList.toggle("hidden", !isLoading);

    if (isLoading) {
      qs("#result").classList.add("hidden");
      setText("#loadingStep", stepText || "우주의 문이 열리고 있습니다...");
      qs("#loadingProgress").style.width = `${progress || 12}%`;
    }
  }

  function resetResultView() {
    const loading = qs("#loading");
    const result = qs("#result");
    const intro = qs("#resultRevealMessage");
    const progress = qs("#loadingProgress");

    if (loading) loading.classList.add("hidden");
    if (progress) progress.style.width = "0%";
    if (intro) intro.classList.add("hidden");

    if (result) {
      result.classList.add("hidden");
      result.classList.remove("result-gate-opening", "result-gate-opened");
      result.querySelectorAll("[data-reveal]").forEach((item) => {
        item.classList.remove("reveal-visible");
        item.style.removeProperty("--reveal-delay");
      });
    }
  }

  function renderResult(session) {
    const { saju, analysis } = session;

    setText("#totalScore", analysis.totalScore);
    setText("#starRating", createStars(analysis.totalScore));
    setText("#summary", analysis.summary);
    setText(
      "#summaryEcho",
      analysis.todayInsight ||
        analysis.coreMessage ||
        (Array.isArray(analysis.coreInsight) ? analysis.coreInsight[0] : "") ||
        window.ResultReveal.getDominantFortune(analysis.scores),
    );
    hideAnalysisMode();

    renderScores(analysis.scores);
    renderPillars(saju);
    renderTimeUnknownNotice(saju);
    window.AppChart.renderFiveElementChart(
      qs("#fiveElementsChart"),
      qs("#fiveElementsLegend"),
      saju.fiveElements,
    );
    renderAnalysisBasis(saju, analysis);
    window.AppAccordion.renderAccordion(qs("#accordion"), analysis.sections);
    if (window.AppConfig.getRuntimeConfig().ENABLE_LUCKY_ITEMS) {
      renderLuckyItems(analysis.luckyItems);
    }
    renderLuckCycle(saju.luckCycle);
    setText("#dominantFortuneText", window.ResultReveal.getDominantFortune(analysis.scores));

    if (window.AppConfig.getRuntimeConfig().ENABLE_AI_CHAT) {
      renderChat(session.chat || []);
    }

    qs("#result").classList.remove("hidden");
    window.ResultReveal.reveal(session);
    qs("#result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function hideAnalysisMode() {
    const mode = qs("#analysisMode");
    if (!mode) return;

    mode.textContent = "";
    mode.classList.add("hidden");
    mode.setAttribute("aria-hidden", "true");
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
      element.querySelector("small").textContent = pillar.unknown
        ? "시주 제외 분석"
        : `${pillar.stem} / ${pillar.branch}`;
    });
  }

  function renderTimeUnknownNotice(saju) {
    const notice = qs("#timeUnknownNotice");
    if (!notice) return;

    notice.classList.toggle("hidden", !saju.hourUnknown);
  }

  function renderAnalysisBasis(saju, analysis) {
    renderBasisPillars(saju);
    renderBasisElements(saju.fiveElements);
    renderBasisInsights(saju, analysis);
  }

  function renderBasisPillars(saju) {
    const container = qs("#basisPillars");
    if (!container) return;

    const items = [
      ["년주", saju.yearPillar],
      ["월주", saju.monthPillar],
      ["일주", saju.dayPillar],
      ["시주", saju.hourUnknown ? "시간 모름" : saju.hourPillarLabel || saju.hourPillar],
    ];

    container.innerHTML = items
      .map(
        ([label, value]) => `
          <div>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value || "-")}</strong>
          </div>
        `,
      )
      .join("");
  }

  function renderBasisElements(fiveElements) {
    const container = qs("#basisElements");
    if (!container) return;

    const ratio = fiveElements.ratio || {};
    const labels = fiveElements.labels || window.SajuFiveElements.ELEMENT_LABELS;

    container.innerHTML = window.SajuFiveElements.ELEMENT_ORDER.map((element) => {
      const value = Math.round(window.SajuUtils.clamp(ratio[element] || 0, 0, 100));

      return `
        <div class="basis-element-row">
          <span>${escapeHtml(labels[element])}</span>
          <div class="basis-element-track"><i style="width:${value}%"></i></div>
          <strong>${value}%</strong>
        </div>
      `;
    }).join("");
  }

  function renderBasisInsights(saju, analysis) {
    const container = qs("#basisInsights");
    if (!container) return;
    const basisInsights = analysis.analysisBasis?.keyInsights;

    if (Array.isArray(basisInsights) && basisInsights.length) {
      container.innerHTML = basisInsights
        .map((text) => `<li>${escapeHtml(text)}</li>`)
        .join("");
      return;
    }

    const dominant = saju.fiveElements.labels[saju.fiveElements.dominant];
    const weakest = saju.fiveElements.labels[saju.fiveElements.weakest];
    const dominantFortune = window.ResultReveal.getDominantFortune(analysis.scores);
    const insights = [
      `${dominant} 기운이 가장 두드러진 구조입니다.`,
      `${weakest} 기운은 상대적으로 보완이 필요한 흐름입니다.`,
      `올해 ${saju.yearFortune.pillar} 세운에서는 ${dominantFortune} 흐름을 중점적으로 봅니다.`,
    ];

    if (saju.hourUnknown) {
      insights.unshift("태어난 시간이 확인되지 않아 년주·월주·일주를 중심으로 분석했습니다.");
    }

    container.innerHTML = insights.map((text) => `<li>${escapeHtml(text)}</li>`).join("");
  }

  function renderLuckyItems(items) {
    const container = qs("#luckyItems");
    if (!container) return;

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
    applyFeatureFlags,
    applyTheme,
    qs,
    renderChat,
    renderRecent,
    renderResult,
    resetResultView,
    setLoading,
    setText,
    showNotice,
    showToast,
  };
})();
