/**
 * Gemini 직접 호출 파일이 아닙니다.
 * 프론트엔드는 Google Apps Script URL로만 요청하고, Apps Script가 Gemini API를 호출합니다.
 */
(function () {
  const API_ERROR_MESSAGE = "현재 AI 분석 서버 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
  const REQUIRED_SCORE_KEYS = ["money", "career", "health", "love", "relationship"];
  const REQUIRED_SECTION_KEYS = [
    "personality",
    "earlyLife",
    "middleLife",
    "lateLife",
    "yearFortune",
    "money",
    "career",
    "love",
    "health",
    "relationship",
    "goodActions",
    "cautions",
  ];

  function getConfig() {
    return window.AppConfig.getRuntimeConfig();
  }

  async function requestFortune({ birthData, saju }) {
    const config = getConfig();

    if (!config.APPS_SCRIPT_URL) {
      throw new Error(API_ERROR_MESSAGE);
    }

    const response = await postToProxy({
      type: "fortune",
      payload: {
        birthData,
        saju,
      },
      settings: {
        model: config.DEFAULT_MODEL,
        promptMemo: config.promptMemo,
      },
    });

    return normalizeAnalysis(response, birthData, saju);
  }

  async function askQuestion({ session, question }) {
    const config = getConfig();

    if (!config.APPS_SCRIPT_URL) {
      throw new Error(API_ERROR_MESSAGE);
    }

    const response = await postToProxy({
      type: "question",
      sessionId: session.id,
      payload: {
        question,
        birthData: session.birthData,
        saju: session.saju,
        analysis: session.analysis,
        history: session.chat || [],
      },
      settings: {
        model: config.DEFAULT_MODEL,
        promptMemo: config.promptMemo,
      },
    });

    return {
      answer:
        response.answer ||
        API_ERROR_MESSAGE,
    };
  }

  async function postToProxy(body) {
    const config = getConfig();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), config.API_TIMEOUT_MS);
    const payload = JSON.stringify(body);

    try {
      const response = await fetch(config.APPS_SCRIPT_URL, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        redirect: "follow",
        // Apps Script Web App은 OPTIONS preflight를 안정적으로 처리하지 못할 수 있습니다.
        // application/json 헤더를 직접 넣지 않고 text/plain simple request로 전송합니다.
        // Apps Script doPost에서는 JSON.parse(e.postData.contents)로 이 문자열을 파싱합니다.
        body: payload,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(API_ERROR_MESSAGE);
      }

      let data;
      try {
        data = await response.json();
      } catch (error) {
        throw new Error(API_ERROR_MESSAGE);
      }

      if (data.error || data.ok === false) {
        throw new Error(data.userMessage || data.message || API_ERROR_MESSAGE);
      }

      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(API_ERROR_MESSAGE);
      }

      throw error.message ? error : new Error(API_ERROR_MESSAGE);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function normalizeAnalysis(data, birthData, saju) {
    validateAnalysisResponse(data);
    const scores = data.scores;

    return {
      sessionId: data.sessionId || window.SajuUtils.createId("session"),
      totalScore: clampScore(data.totalScore),
      scores: {
        money: clampScore(scores.money),
        career: clampScore(scores.career),
        health: clampScore(scores.health),
        love: clampScore(scores.love),
        relationship: clampScore(scores.relationship),
      },
      summary: data.summary,
      analysisBasis: data.analysisBasis || null,
      coreInsight: Array.isArray(data.coreInsight) ? data.coreInsight : [],
      goodActions: Array.isArray(data.goodActions) ? data.goodActions : [],
      avoidActions: Array.isArray(data.avoidActions) ? data.avoidActions : [],
      sections: data.sections,
      luckyItems: Array.isArray(data.luckyItems) ? data.luckyItems : [],
      meta: {
        ...(data.meta || {}),
        mode: "api",
        apiCalls: 1,
      },
    };
  }

  function validateAnalysisResponse(data) {
    if (!data || typeof data !== "object") throw new Error(API_ERROR_MESSAGE);
    if (!Number.isFinite(Number(data.totalScore))) throw new Error(API_ERROR_MESSAGE);
    if (!data.summary || typeof data.summary !== "string") throw new Error(API_ERROR_MESSAGE);
    if (!data.scores || typeof data.scores !== "object") throw new Error(API_ERROR_MESSAGE);
    if (!data.analysisBasis || typeof data.analysisBasis !== "object") throw new Error(API_ERROR_MESSAGE);
    if (!data.sections || typeof data.sections !== "object") throw new Error(API_ERROR_MESSAGE);

    REQUIRED_SCORE_KEYS.forEach((key) => {
      if (!Number.isFinite(Number(data.scores[key]))) throw new Error(API_ERROR_MESSAGE);
    });

    REQUIRED_SECTION_KEYS.forEach((key) => {
      if (!data.sections[key] || typeof data.sections[key] !== "string") {
        throw new Error(API_ERROR_MESSAGE);
      }
    });
  }

  function clampScore(value) {
    return Math.round(window.SajuUtils.clamp(value, 0, 100));
  }

  window.GeminiService = {
    askQuestion,
    requestFortune,
  };
})();
