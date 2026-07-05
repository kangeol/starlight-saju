/**
 * 전역 설정 파일입니다.
 * 초보자는 우선 APPS_SCRIPT_URL만 자신의 Google Apps Script 웹 앱 URL로 바꾸면 됩니다.
 * API 키는 절대 이 파일이나 프론트엔드 파일에 넣지 않습니다.
 */
(function () {
  const ADMIN_STORAGE_KEY = "aiSajuAdminSettings";

  const defaultConfig = {
    APPS_SCRIPT_URL: "",
    USE_MOCK_WHEN_API_EMPTY: true,
    API_TIMEOUT_MS: 30000,
    STORAGE_PREFIX: "aiSajuV4",
    RECENT_LIMIT: 10,
    ENABLE_AI_CHAT: false,
    DEFAULT_MODEL: "gemini-1.5-flash",
    BRAND_NAME: "별빛사주",
    SITE_URL: "https://example.com/ai-saju-webapp/",
  };

  function readAdminSettings() {
    try {
      return JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY)) || {};
    } catch (error) {
      console.warn("관리자 설정을 읽지 못했습니다.", error);
      return {};
    }
  }

  function getRuntimeConfig() {
    const admin = readAdminSettings();

    return {
      ...defaultConfig,
      APPS_SCRIPT_URL:
        admin.appsScriptUrl || defaultConfig.APPS_SCRIPT_URL,
      DEFAULT_MODEL: admin.geminiModel || defaultConfig.DEFAULT_MODEL,
      notice: admin.notice || "",
      promptMemo: admin.promptMemo || "",
      recommendationButtonText:
        admin.recommendationButtonText || "행운 아이템 보기",
      recommendationBaseUrl: admin.recommendationBaseUrl || "#",
      admin,
    };
  }

  window.AppConfig = {
    ...defaultConfig,
    ADMIN_STORAGE_KEY,
    getRuntimeConfig,
  };
})();
