/**
 * 별빛사주 V4 앱 진입점입니다.
 * 사주 계산은 SajuCalculator가 담당하고, AI는 계산된 JSON을 해석만 합니다.
 */
(function () {
  let currentSession = null;
  let isSubmitting = false;
  let activeRequestId = 0;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const config = window.AppConfig.getRuntimeConfig();
    window.AppUI.applyTheme(window.AppStorage.getTheme());
    window.AppUI.showNotice(config.notice);
    window.AppUI.applyFeatureFlags(config);
    setupBirthDateInputs();
    bindEvents();
    renderInitialState();
  }

  function bindEvents() {
    const config = window.AppConfig.getRuntimeConfig();

    const brand = window.AppUI.qs(".brand");

    if (brand) {
      brand.addEventListener("click", goHome);
    }

    bindOptional("#fortuneForm", "submit", handleSubmit);
    bindOptional("#birthYear", "input", syncBirthDateFields);
    bindOptional("#birthMonth", "change", syncBirthDateFields);
    bindOptional("#birthDay", "change", syncBirthDateFields);
    bindOptional("#birthTimePreset", "change", syncBirthTimeFields);
    bindOptional("#birthTime", "input", syncBirthTimePreset);
    bindOptional("#pdfButton", "click", () => window.print());
    bindOptional("#copyLinkButton", "click", copyCurrentLink);
    bindOptional("#shareKakao", "click", shareKakao);
    bindOptional("#themeToggle", "click", rotateTheme);
    bindOptional("#clearRecent", "click", clearRecent);

    if (config.ENABLE_AI_CHAT) {
      window.AppUI.showToast("AI 추가 질문 기능은 현재 비활성화되어 있습니다.");
    }
  }

  function renderInitialState() {
    window.AppStorage.clearCurrentSession();
    window.AppUI.resetResultView();
    window.AppUI.renderRecent(getBetaRecentReadings(), restoreSession);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const birthData = getFormData();
    const message = validateInput(birthData);

    if (message) {
      handleInvalidInput(message);
      return;
    }

    window.AppUI.setText("#formError", "");
    window.AppUI.resetResultView();
    setFormBusy(true);

    const requestId = ++activeRequestId;
    const loading = window.CosmicLoading.start();

    try {
      const saju = window.SajuCalculator.calculateSaju(birthData);
      const analysis = await window.GeminiService.requestFortune({
        birthData,
        saju,
      });

      if (isStaleRequest(requestId)) return;

      currentSession = {
        id: analysis.sessionId || window.SajuUtils.createId("session"),
        birthData,
        saju,
        analysis,
        chat: [],
      };

      window.AppStorage.saveRecentReading(currentSession);
      window.AppUI.renderRecent(getBetaRecentReadings(), restoreSession);
      await loading.finish();

      if (isStaleRequest(requestId)) return;

      window.AppUI.renderResult(currentSession);
    } catch (error) {
      if (isStaleRequest(requestId)) return;

      await loading.fail(error.message);
      window.AppUI.showToast(
        error.message || "현재 AI 분석 서버 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      if (!isStaleRequest(requestId)) {
        setFormBusy(false);
      }
    }
  }

  function getFormData() {
    const selectedGender = document.querySelector("input[name='gender']:checked");
    const selectedCalendar = document.querySelector("input[name='calendarType']:checked");
    const birthDateParts = getBirthDateParts();
    const birthDate = createBirthDate(birthDateParts);
    const hiddenBirthDate = window.AppUI.qs("#birthDate");
    const birthTimeData = getBirthTimeData();

    if (hiddenBirthDate) {
      hiddenBirthDate.value = birthDate;
    }

    return {
      name: window.AppUI.qs("#name").value.trim(),
      gender: selectedGender ? selectedGender.value : "",
      calendarType: selectedCalendar ? selectedCalendar.value : "",
      birthYear: birthDateParts.yearText,
      birthMonth: birthDateParts.monthText,
      birthDay: birthDateParts.dayText,
      birthDate,
      birthTime: birthTimeData.birthTime,
      birthTimeLabel: birthTimeData.birthTimeLabel,
      hourUnknown: birthTimeData.hourUnknown,
    };
  }

  function validateInput(input) {
    if (!input.birthYear || !input.birthMonth || !input.birthDay) {
      return "정확한 사주풀이를 위해 생년월일과 태어난 시간을 모두 입력해주세요.";
    }

    if (!input.gender) return "성별을 선택해 주세요.";
    if (!input.calendarType) return "양력 또는 음력을 선택해 주세요.";
    if (!isValidBirthDate(input)) return "생년월일을 정확히 입력해주세요.";
    if (!input.hourUnknown && !input.birthTime) {
      return "정확한 사주풀이를 위해 생년월일과 태어난 시간을 모두 입력해주세요.";
    }

    const dateParts = window.SajuUtils.parseDate(input.birthDate);
    if (dateParts.date > new Date()) {
      return "생년월일을 정확히 입력해주세요.";
    }

    return "";
  }

  function bindOptional(selector, eventName, handler) {
    const element = window.AppUI.qs(selector);
    if (element) element.addEventListener(eventName, handler);
  }

  function setupBirthDateInputs() {
    const yearInput = window.AppUI.qs("#birthYear");
    const daySelect = window.AppUI.qs("#birthDay");
    const currentYear = new Date().getFullYear();

    if (yearInput) {
      yearInput.max = String(currentYear);
    }

    if (daySelect && daySelect.options.length <= 1) {
      updateBirthDayOptions();
    }

    syncBirthDateFields();
    syncBirthTimeFields();
  }

  function syncBirthDateFields() {
    updateBirthDayOptions();

    const hiddenBirthDate = window.AppUI.qs("#birthDate");
    if (hiddenBirthDate) {
      hiddenBirthDate.value = createBirthDate(getBirthDateParts());
    }
  }

  function syncBirthTimeFields() {
    const preset = window.AppUI.qs("#birthTimePreset");
    const timeInput = window.AppUI.qs("#birthTime");
    if (!preset || !timeInput) return;

    if (preset.value === "unknown") {
      timeInput.value = "";
      timeInput.disabled = true;
      timeInput.removeAttribute("required");
      return;
    }

    timeInput.disabled = false;
    timeInput.required = true;

    if (preset.value) {
      timeInput.value = preset.value;
    }
  }

  function syncBirthTimePreset() {
    const preset = window.AppUI.qs("#birthTimePreset");
    const timeInput = window.AppUI.qs("#birthTime");
    if (!preset || !timeInput || !timeInput.value) return;

    const hasPreset = Array.from(preset.options).some((option) => option.value === timeInput.value);
    preset.value = hasPreset ? timeInput.value : "";
  }

  function updateBirthDayOptions() {
    const daySelect = window.AppUI.qs("#birthDay");
    if (!daySelect) return;

    const selectedDay = daySelect.value;
    const { year, month } = getBirthDateParts();
    const maxDay = getDaysInMonth(year, month) || 31;

    daySelect.innerHTML = '<option value="">일</option>';

    for (let day = 1; day <= maxDay; day += 1) {
      const option = document.createElement("option");
      option.value = String(day);
      option.textContent = String(day).padStart(2, "0");
      daySelect.append(option);
    }

    if (selectedDay && Number(selectedDay) <= maxDay) {
      daySelect.value = selectedDay;
    }
  }

  function getBirthDateParts() {
    const yearText = window.AppUI.qs("#birthYear")?.value.trim() || "";
    const monthText = window.AppUI.qs("#birthMonth")?.value || "";
    const dayText = window.AppUI.qs("#birthDay")?.value || "";

    return {
      yearText,
      monthText,
      dayText,
      year: Number(yearText),
      month: Number(monthText),
      day: Number(dayText),
    };
  }

  function createBirthDate(parts) {
    if (!parts.yearText || !parts.monthText || !parts.dayText) return "";

    return [
      String(parts.year).padStart(4, "0"),
      String(parts.month).padStart(2, "0"),
      String(parts.day).padStart(2, "0"),
    ].join("-");
  }

  function getBirthTimeData() {
    const preset = window.AppUI.qs("#birthTimePreset")?.value || "unknown";
    const exactTime = window.AppUI.qs("#birthTime")?.value || "";
    const hourUnknown = preset === "unknown";
    const birthTime = hourUnknown ? "unknown" : exactTime || preset;

    return {
      birthTime,
      birthTimeLabel: hourUnknown ? "시간 모름" : birthTime,
      hourUnknown,
    };
  }

  function isValidBirthDate(input) {
    const year = Number(input.birthYear);
    const month = Number(input.birthMonth);
    const day = Number(input.birthDay);
    const currentYear = new Date().getFullYear();

    if (!Number.isInteger(year) || year < 1900 || year > currentYear) return false;
    if (!Number.isInteger(month) || month < 1 || month > 12) return false;
    if (!Number.isInteger(day) || day < 1 || day > getDaysInMonth(year, month)) return false;

    const dateParts = window.SajuUtils.parseDate(input.birthDate);
    return Boolean(dateParts) && dateParts.year === year && dateParts.month === month && dateParts.day === day;
  }

  function getDaysInMonth(year, month) {
    if (!Number.isInteger(month) || month < 1 || month > 12) return 0;
    if (!Number.isInteger(year) || year < 1) return new Date(2024, month, 0).getDate();
    return new Date(year, month, 0).getDate();
  }

  function handleInvalidInput(message) {
    activeRequestId += 1;
    currentSession = null;
    isSubmitting = false;

    window.CosmicLoading.stop();
    window.AppStorage.clearCurrentSession();
    window.AppUI.resetResultView();
    window.AppUI.setText("#formError", message);
    setFormBusy(false);
  }

  function goHome(event) {
    event.preventDefault();
    resetApp();
  }

  function resetApp() {
    activeRequestId += 1;
    currentSession = null;
    isSubmitting = false;

    const form = window.AppUI.qs("#fortuneForm");
    if (form) {
      form.reset();
      form.removeAttribute("aria-busy");
    }

    setupBirthDateInputs();
    syncBirthTimeFields();

    window.CosmicLoading.stop();
    window.AppStorage.clearCurrentSession();
    window.AppUI.resetResultView();
    window.AppUI.setText("#formError", "");
    window.AppUI.renderRecent(getBetaRecentReadings(), restoreSession);
    setFormBusy(false);
    scrollToHome();
  }

  function setFormBusy(isBusy) {
    isSubmitting = isBusy;

    const form = window.AppUI.qs("#fortuneForm");
    const button = form?.querySelector("button[type='submit']");

    if (form) {
      form.setAttribute("aria-busy", String(isBusy));
    }

    if (button) {
      button.disabled = isBusy;
      button.setAttribute("aria-disabled", String(isBusy));
    }
  }

  function isStaleRequest(requestId) {
    return requestId !== activeRequestId;
  }

  function scrollToHome() {
    const target = window.AppUI.qs(".hero-header") || window.AppUI.qs("#fortuneForm");

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function restoreSession(reading) {
    if (reading.analysis?.meta?.mode === "mock") {
      window.AppUI.showToast("베타 버전에서는 Mock 결과를 열 수 없습니다.");
      return;
    }

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

  function getBetaRecentReadings() {
    return window.AppStorage
      .getRecentReadings()
      .filter((reading) => reading.analysis?.meta?.mode !== "mock");
  }
})();
