/**
 * 상세 사주풀이 아코디언 컴포넌트입니다.
 * 섹션 목록은 app.js가 아니라 컴포넌트 안에 보관해 유지보수를 쉽게 합니다.
 */
(function () {
  const SECTION_LABELS = {
    personality: "성격",
    earlyLife: "초년운",
    middleLife: "중년운",
    lateLife: "말년운",
    yearFortune: "올해운",
    money: "재물운",
    career: "직업운",
    business: "사업운",
    jobChange: "이직운",
    love: "애정운",
    marriage: "결혼운",
    health: "건강운",
    relationship: "대인관계",
    goodActions: "좋은 행동",
    cautions: "주의사항",
    luckyColor: "행운의 색",
    luckyNumber: "행운의 숫자",
    luckyDirection: "행운의 방향",
  };

  function renderAccordion(container, sections) {
    container.innerHTML = "";

    Object.entries(SECTION_LABELS).forEach(([key, label], index) => {
      const detail = document.createElement("details");
      detail.className = "accordion-item";
      if (index === 0) detail.open = true;

      const summary = document.createElement("summary");
      summary.textContent = label;

      const paragraph = document.createElement("p");
      paragraph.textContent = sections[key] || "해당 항목은 분석 결과가 준비되지 않았습니다.";

      detail.append(summary, paragraph);
      container.append(detail);
    });
  }

  window.AppAccordion = {
    SECTION_LABELS,
    renderAccordion,
  };
})();
