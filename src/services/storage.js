/**
 * LocalStorage 저장소입니다.
 * 최근 본 사주, 현재 상담 세션, 관리자 설정을 한 곳에서 다루기 위해 분리했습니다.
 */
(function () {
  const config = window.AppConfig.getRuntimeConfig();
  const prefix = config.STORAGE_PREFIX;

  const KEYS = {
    recent: `${prefix}:recentReadings`,
    session: `${prefix}:currentSession`,
    theme: `${prefix}:theme`,
  };

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch (error) {
      console.warn("저장된 데이터를 읽지 못했습니다.", error);
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function saveRecentReading(session) {
    const recent = read(KEYS.recent, []);
    const unique = recent.filter((item) => item.id !== session.id);
    const compact = {
      id: session.id,
      savedAt: new Date().toISOString(),
      name: session.birthData.name || "이름 없음",
      birthDate: session.birthData.birthDate,
      birthTime: session.birthData.birthTime,
      totalScore: session.analysis.totalScore,
      summary: session.analysis.summary,
      saju: session.saju,
      analysis: session.analysis,
      birthData: session.birthData,
      chat: session.chat || [],
    };

    write(KEYS.recent, [compact, ...unique].slice(0, config.RECENT_LIMIT));
    write(KEYS.session, compact);
  }

  function updateSession(session) {
    write(KEYS.session, session);
    saveRecentReading(session);
  }

  function getRecentReadings() {
    return read(KEYS.recent, []);
  }

  function getCurrentSession() {
    return read(KEYS.session, null);
  }

  function clearRecentReadings() {
    localStorage.removeItem(KEYS.recent);
  }

  function clearCurrentSession() {
    localStorage.removeItem(KEYS.session);
  }

  function getTheme() {
    return localStorage.getItem(KEYS.theme) || "auto";
  }

  function setTheme(theme) {
    localStorage.setItem(KEYS.theme, theme);
  }

  window.AppStorage = {
    clearCurrentSession,
    clearRecentReadings,
    getCurrentSession,
    getRecentReadings,
    getTheme,
    saveRecentReading,
    setTheme,
    updateSession,
  };
})();
