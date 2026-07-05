/**
 * 달력 처리 모듈입니다.
 * 현재 V2는 프론트 단독 배포를 위해 양력 기준 계산을 기본으로 합니다.
 * 음력 입력은 보존하되, 실제 상용 정확도가 필요하면 여기에 음력-양력 변환 테이블을 연결하세요.
 */
(function () {
  function normalizeBirthDate(input) {
    const dateParts = window.SajuUtils.parseDate(input.birthDate);

    if (!dateParts) {
      throw new Error("생년월일을 올바르게 입력해 주세요.");
    }

    const isLunar = input.calendarType === "lunar";

    return {
      original: input.birthDate,
      calendarType: isLunar ? "lunar" : "solar",
      solarDate: input.birthDate,
      dateParts,
      note: isLunar
        ? "음력 입력입니다. V2 기본 엔진은 입력값을 보존하고 양력 기준 간지 계산을 수행합니다. 상용 배포 전 음력 변환 테이블을 연결하세요."
        : "양력 입력입니다.",
    };
  }

  window.SajuCalendar = {
    normalizeBirthDate,
  };
})();
