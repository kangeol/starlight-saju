/**
 * 사주 계산 엔진의 단일 진입점입니다.
 * Gemini에는 이 함수가 만든 JSON만 전달합니다. AI가 직접 사주를 계산하지 않게 하는 핵심 경계입니다.
 */
(function () {
  function calculateSaju(input) {
    const normalizedDate = window.SajuCalendar.normalizeBirthDate(input);
    const { dateParts } = normalizedDate;

    const yearPillar = window.SajuGanji.getYearPillar(dateParts);
    const monthPillar = window.SajuGanji.getMonthPillar(dateParts, yearPillar);
    const dayPillar = window.SajuGanji.getDayPillar(dateParts);
    const hourUnknown = input.hourUnknown || input.birthTime === "UNKNOWN" || input.birthTime === "unknown";
    const hourPillar = hourUnknown
      ? {
          stem: "UNKNOWN",
          branch: "UNKNOWN",
          text: "시간 모름",
          timeLabel: "시간 모름",
          unknown: true,
        }
      : window.SajuGanji.getHourPillar(input.birthTime, dayPillar);
    const pillars = [yearPillar, monthPillar, dayPillar, hourPillar];
    const fiveElements = window.SajuFiveElements.calculateFiveElements(pillars);
    const tenGods = window.SajuFiveElements.calculateTenGods(dayPillar, pillars);
    const hiddenStems = window.SajuFiveElements.calculateHiddenStems(pillars);
    const yongHee = window.SajuFiveElements.calculateYongHee(fiveElements);
    const twelveStages = window.SajuLuckCycle.calculateTwelveStages(
      dayPillar.stem,
      pillars,
    );
    const twelveSinsal = window.SajuLuckCycle.calculateTwelveSinsal(
      yearPillar.branch,
      pillars,
    );
    const luckCycle = window.SajuLuckCycle.calculateLuckCycle(
      input,
      yearPillar,
      monthPillar,
    );
    const yearFortune = window.SajuLuckCycle.calculateYearFortune(
      new Date().getFullYear(),
    );

    return {
      engineVersion: "2.0.0",
      calculatedAt: new Date().toISOString(),
      calendar: normalizedDate,
      birthData: {
        name: input.name || "",
        gender: input.gender,
        genderLabel: window.SajuUtils.getGenderLabel(input.gender),
        calendarType: input.calendarType,
        birthDate: input.birthDate,
        birthTime: input.birthTime,
        birthTimeLabel: input.birthTimeLabel || input.birthTime,
        hourUnknown,
      },
      yearPillar: yearPillar.text,
      monthPillar: monthPillar.text,
      dayPillar: dayPillar.text,
      hourPillar: hourUnknown ? "UNKNOWN" : hourPillar.text,
      hourPillarLabel: hourPillar.text,
      hourUnknown,
      pillars: {
        year: yearPillar,
        month: monthPillar,
        day: dayPillar,
        hour: hourPillar,
      },
      fiveElements,
      tenGods,
      hiddenStems,
      yongSin: yongHee.yongSin,
      heeSin: yongHee.heeSin,
      yongHeeExplanation: yongHee.explanation,
      twelveStages,
      twelveSinsal,
      luckCycle,
      yearFortune,
    };
  }

  window.SajuCalculator = {
    calculateSaju,
  };
})();
