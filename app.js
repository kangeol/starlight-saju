/**
 * 별빛사주 V4 앱 진입점입니다.
 * 사주 계산은 SajuCalculator가 담당하고, AI는 계산된 JSON을 해석만 합니다.
 */
(function () {
  let currentSession = window.AppStorage.getCurrentSession();

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    window.AppUI.applyTheme(window.AppStorage.getTheme());
    window.AppUI.showNotice(window.AppConfig.getRuntimeConfig().notice);
    bindEvents();
    renderInitialState();
  }

  function bindEvents() {
    const config = window.AppConfig.getRuntimeConfig();

    window.AppUI.qs("#fortuneForm").addEventListener("submit", handleSubmit);
    window.AppUI.qs("#pdfButton").addEventListener("click", () => window.print());
    window.AppUI.qs("#copyLinkButton").addEventListener("click", copyCurrentLink);
    window.AppUI.qs("#shareKakao").addEventListener("click", shareKakao);
    window.AppUI.qs("#themeToggle").addEventListener("click", rotateTheme);
    window.AppUI.qs("#clearRecent").addEventListener("click", clearRecent);

    if (config.ENABLE_AI_CHAT) {
      window.AppUI.showToast("AI 추가 질문 기능은 현재 비활성화되어 있습니다.");
    }
  }

  function renderInitialState() {
    window.AppUI.renderRecent(window.AppStorage.getRecentReadings(), restoreSession);

    if (currentSession) {
      window.AppUI.renderResult(currentSession);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const birthData = getFormData();
    const message = validateInput(birthData);

    if (message) {
      window.AppUI.setText("#formError", message);
      return;
    }

    window.AppUI.setText("#formError", "");
    const loading = window.CosmicLoading.start();

    try {
      const saju = window.SajuCalculator.calculateSaju(birthData);
      const analysis = await window.GeminiService.requestFortune({
        birthData,
        saju,
      });

      currentSession = {
        id: analysis.sessionId || window.SajuUtils.createId("session"),
        birthData,
        saju,
        analysis,
        chat: [],
      };

      window.AppStorage.saveRecentReading(currentSession);
      window.AppUI.renderRecent(window.AppStorage.getRecentReadings(), restoreSession);
      await loading.finish();
      window.AppUI.renderResult(currentSession);
    } catch (error) {
      console.error(error);
      await loading.fail();
      window.AppUI.showToast(
        error.message || "별빛 연결이 잠시 불안정합니다. 잠시 후 다시 시도해주세요.",
      );
    }
  }

  function getFormData() {
    const selectedGender = document.querySelector("input[name='gender']:checked");
    const selectedCalendar = document.querySelector("input[name='calendarType']:checked");

    return {
      name: window.AppUI.qs("#name").value.trim(),
      gender: selectedGender ? selectedGender.value : "",
      calendarType: selectedCalendar ? selectedCalendar.value : "",
      birthDate: window.AppUI.qs("#birthDate").value,
      birthTime: window.AppUI.qs("#birthTime").value,
    };
  }

  function validateInput(input) {
    if (!input.gender) return "성별을 선택해 주세요.";
    if (!input.calendarType) return "양력 또는 음력을 선택해 주세요.";
    if (!input.birthDate) return "생년월일을 입력해 주세요.";
    if (!input.birthTime) return "태어난 시간을 선택해 주세요.";

    const dateParts = window.SajuUtils.parseDate(input.birthDate);
    if (!dateParts || Number.isNaN(dateParts.date.getTime())) {
      return "생년월일 형식이 올바르지 않습니다.";
    }

    if (dateParts.date > new Date()) {
      return "미래 날짜는 입력할 수 없습니다.";
    }

    return "";
  }

  function restoreSession(reading) {
    currentSession = {
      id: reading.id,
      birthData: reading.birthData,
      saju: reading.saju,
      analysis: reading.analysis,
      chat: reading.chat || [],
    };
    window.AppStorage.updateSession(currentSession);
    window.AppUI.renderResult(currentSession);
  }

  async function copyCurrentLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      window.AppUI.showToast("링크를 복사했습니다.");
    } catch (error) {
      window.AppUI.showToast("브라우저에서 복사를 지원하지 않습니다.");
    }
  }

  function shareKakao() {
    if (window.Kakao && window.Kakao.Share) {
      window.Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: "별빛사주",
          description:
            currentSession?.analysis?.summary ||
            "우주의 흐름이 들려주는 나의 올해 운세를 확인해 보세요.",
          imageUrl: "https://example.com/ai-saju-webapp/assets/icons/favicon.svg",
          link: {
            mobileWebUrl: window.location.href,
            webUrl: window.location.href,
          },
        },
      });
      return;
    }

    copyCurrentLink();
    window.AppUI.showToast("카카오 SDK 연결 전이라 링크를 복사했습니다.");
  }

  function rotateTheme() {
    const order = ["auto", "dark", "light"];
    const current = window.AppStorage.getTheme();
    const next = order[(order.indexOf(current) + 1) % order.length];
    window.AppStorage.setTheme(next);
    window.AppUI.applyTheme(next);
  }

  function clearRecent() {
    window.AppStorage.clearRecentReadings();
    window.AppUI.renderRecent([], restoreSession);
    window.AppUI.showToast("최근 본 사주를 비웠습니다.");
  }
})();
