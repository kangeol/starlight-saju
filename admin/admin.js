/**
 * 정적 배포용 관리자 페이지입니다.
 * 이 보호 방식은 편의 기능이며, 실제 보안 인증은 서버/회원 기능에서 구현해야 합니다.
 */
(function () {
  const PASSWORD = "admin1234";
  const storageKey = window.AppConfig.ADMIN_STORAGE_KEY;
  const defaultAppsScriptUrl = window.AppConfig.APPS_SCRIPT_URL;

  const loginPanel = document.querySelector("#loginPanel");
  const settingsPanel = document.querySelector("#settingsPanel");
  const loginForm = document.querySelector("#loginForm");
  const settingsForm = document.querySelector("#settingsForm");

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const password = document.querySelector("#adminPassword").value;

    if (password !== PASSWORD) {
      document.querySelector("#loginError").textContent = "비밀번호가 올바르지 않습니다.";
      return;
    }

    loginPanel.classList.add("hidden");
    settingsPanel.classList.remove("hidden");
    loadSettings();
  });

  settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const settings = {
      appsScriptUrl: normalizeAppsScriptUrl(
        document.querySelector("#appsScriptUrl").value.trim(),
      ),
      geminiModel: document.querySelector("#geminiModel").value,
      notice: document.querySelector("#notice").value.trim(),
      promptMemo: document.querySelector("#promptMemo").value.trim(),
      recommendationButtonText: document
        .querySelector("#recommendationButtonText")
        .value.trim(),
      recommendationBaseUrl: document
        .querySelector("#recommendationBaseUrl")
        .value.trim(),
    };

    localStorage.setItem(storageKey, JSON.stringify(settings));
    document.querySelector("#saveMessage").textContent =
      "설정을 저장했습니다. 사이트 화면을 새로고침하면 반영됩니다.";
  });

  function normalizeAppsScriptUrl(url) {
    const trimmedUrl = String(url || "").trim();
    const isAppsScriptUrl = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(trimmedUrl);

    if (!trimmedUrl || (isAppsScriptUrl && trimmedUrl !== defaultAppsScriptUrl)) {
      return defaultAppsScriptUrl;
    }

    return trimmedUrl;
  }

  function loadSettings() {
    const settings = JSON.parse(localStorage.getItem(storageKey) || "{}");
    const normalizedAppsScriptUrl = normalizeAppsScriptUrl(settings.appsScriptUrl || "");

    if (settings.appsScriptUrl && settings.appsScriptUrl !== normalizedAppsScriptUrl) {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...settings,
          appsScriptUrl: normalizedAppsScriptUrl,
        }),
      );
    }

    document.querySelector("#appsScriptUrl").value = normalizedAppsScriptUrl;
    document.querySelector("#geminiModel").value =
      settings.geminiModel || window.AppConfig.DEFAULT_MODEL;
    document.querySelector("#notice").value = settings.notice || "";
    document.querySelector("#promptMemo").value = settings.promptMemo || "";
    document.querySelector("#recommendationButtonText").value =
      settings.recommendationButtonText || "행운 아이템 보기";
    document.querySelector("#recommendationBaseUrl").value =
      settings.recommendationBaseUrl || "#";
  }
})();
