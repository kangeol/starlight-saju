/**
 * LocalStorage 저장소입니다.
 * 최근 본 사주, 현재 상담 세션, 관리자 설정을 한 곳에서 다루기 위해 분리했습니다.
 */
(function () {
  const config = window.AppConfig.getRuntimeConfig();
  const prefix = config.STORAGE_PREFIX;

  const KEYS = {
    fortuneCache: `${prefix}:fortuneCache:v7`,
    recent: `${prefix}:recentReadings`,
    session: `${prefix}:currentSession`,
    theme: `${prefix}:theme`,
  };
  const FORTUNE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const FORTUNE_CACHE_LIMIT = 20;

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

  function createFortuneCacheKey(birthData, saju) {
    return window.SajuUtils.simpleHash({
      gender: birthData.gender,
      calendarType: birthData.calendarType,
      birthDate: birthData.birthDate,
      birthTime: birthData.hourUnknown ? "UNKNOWN" : birthData.birthTime,
      hourUnknown: Boolean(birthData.hourUnknown),
      yearPillar: saju.yearPillar,
      monthPillar: saju.monthPillar,
      dayPillar: saju.dayPillar,
      hourPillar: saju.hourUnknown ? "UNKNOWN" : saju.hourPillar,
      fiveElements: saju.fiveElements,
    });
  }

  function getFortuneCache(cacheKey) {
    const cache = read(KEYS.fortuneCache, {});
    const entry = cache[cacheKey];

    if (!entry || !entry.analysis || Number(entry.expiresAt || 0) < Date.now()) {
      if (entry) {
        delete cache[cacheKey];
        write(KEYS.fortuneCache, cache);
      }

      return null;
    }

    return {
      ...entry.analysis,
      meta: {
        ...(entry.analysis.meta || {}),
        cached: "local",
        apiCalls: 0,
      },
    };
  }

  function saveFortuneCache(cacheKey, analysis) {
    const cache = read(KEYS.fortuneCache, {});
    const now = Date.now();

    cache[cacheKey] = {
      savedAt: new Date(now).toISOString(),
      expiresAt: now + (analysis?.meta?.defaultResult ? 15 * 60 * 1000 : FORTUNE_CACHE_TTL_MS),
      analysis,
    };

    const compact = Object.fromEntries(
      Object.entries(cache)
        .filter(([, entry]) => Number(entry.expiresAt || 0) >= now)
        .sort((left, right) => String(right[1].savedAt).localeCompare(String(left[1].savedAt)))
        .slice(0, FORTUNE_CACHE_LIMIT),
    );

    write(KEYS.fortuneCache, compact);
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
    createFortuneCacheKey,
    getFortuneCache,
    getCurrentSession,
    getRecentReadings,
    getTheme,
    saveRecentReading,
    saveFortuneCache,
    setTheme,
    updateSession,
  };
})();
