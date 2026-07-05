/**
 * 전역 설정 파일입니다.
 * 초보자는 우선 APPS_SCRIPT_URL만 자신의 Google Apps Script 웹 앱 URL로 바꾸면 됩니다.
 * API 키는 절대 이 파일이나 프론트엔드 파일에 넣지 않습니다.
 */
(function () {
  const ADMIN_STORAGE_KEY = "aiSajuAdminSettings";
  const CURRENT_APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbyw8JjQvx52yVewY3jMDSKXTWaq-_omu4-AgwvfRwP18e7Y-JnUXDqazxMK5Be7qpUg/exec";

  const defaultConfig = {
    APPS_SCRIPT_URL: CURRENT_APPS_SCRIPT_URL,
    USE_MOCK_WHEN_API_EMPTY: false,
    API_TIMEOUT_MS: 30000,
    STORAGE_PREFIX: "aiSajuV4",
    RECENT_LIMIT: 10,
    ENABLE_AI_CHAT: false,
    ENABLE_LUCKY_ITEMS: false,
    ENABLE_COMPATIBILITY: false,
    ENABLE_SHARE_CARD: false,
    ENABLE_PDF_EXPORT: false,
    ENABLE_PREMIUM: false,
    DEFAULT_MODEL: "gemini-2.5-flash",
    BRAND_NAME: "별빛사주",
    SITE_URL: "https://example.com/ai-saju-webapp/",
  };

  function readAdminSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY)) || {};
      return normalizeAdminSettings(settings);
    } catch (error) {
      console.warn("관리자 설정을 읽지 못했습니다.", error);
      return {};
    }
  }

  function normalizeAdminSettings(settings) {
    if (!settings || typeof settings !== "object") return {};

    const storedUrl = String(settings.appsScriptUrl || "").trim();
    const isAppsScriptUrl = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(storedUrl);

    if (!storedUrl || (isAppsScriptUrl && storedUrl !== CURRENT_APPS_SCRIPT_URL)) {
      const migrated = {
        ...settings,
        appsScriptUrl: CURRENT_APPS_SCRIPT_URL,
      };

      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }

    return settings;
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
    CURRENT_APPS_SCRIPT_URL,
    getRuntimeConfig,
  };
})();
