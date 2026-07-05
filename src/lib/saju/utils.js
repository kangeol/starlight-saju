/**
 * 사주 계산 모듈 공통 유틸리티입니다.
 * 정확한 상용 만세력 수준으로 확장할 때도 이 파일의 입출력 형태는 유지하는 것이 좋습니다.
 */
(function () {
  const HANGUL_GENDER = {
    female: "여성",
    male: "남성",
    none: "선택 안함",
  };

  function mod(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function clamp(value, min, max) {
    const number = Number(value);
    if (Number.isNaN(number)) return min;
    return Math.max(min, Math.min(max, number));
  }

  function parseDate(dateText) {
    const [year, month, day] = String(dateText || "")
      .split("-")
      .map((value) => Number(value));

    if (!year || !month || !day) {
      return null;
    }

    return {
      year,
      month,
      day,
      date: new Date(year, month - 1, day),
    };
  }

  function toIsoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getGenderLabel(gender) {
    return HANGUL_GENDER[gender] || "선택 안함";
  }

  function createId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function simpleHash(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    let hash = 0;

    for (let index = 0; index < text.length; index += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(index);
      hash |= 0;
    }

    return Math.abs(hash).toString(36);
  }

  function safeJsonParse(text, fallback) {
    try {
      return JSON.parse(text);
    } catch (error) {
      return fallback;
    }
  }

  window.SajuUtils = {
    clamp,
    createId,
    getGenderLabel,
    mod,
    parseDate,
    safeJsonParse,
    simpleHash,
    toIsoDate,
  };
})();
