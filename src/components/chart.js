/**
 * 오행 도넛차트 컴포넌트입니다.
 * 외부 차트 라이브러리 없이 CSS conic-gradient로 가볍게 렌더링합니다.
 */
(function () {
  const ELEMENT_COLORS = {
    wood: "#4f8f6b",
    fire: "#b85058",
    earth: "#cfa968",
    metal: "#aab4d4",
    water: "#1d4e89",
  };

  function renderFiveElementChart(chartElement, legendElement, fiveElements) {
    const ratio = fiveElements.ratio || {};
    const labels = fiveElements.labels || window.SajuFiveElements.ELEMENT_LABELS;
    let start = 0;

    const gradientParts = window.SajuFiveElements.ELEMENT_ORDER.map((element) => {
      const value = ratio[element] || 0;
      const end = start + value;
      const part = `${ELEMENT_COLORS[element]} ${start}% ${end}%`;
      start = end;
      return part;
    });

    chartElement.style.background = `conic-gradient(${gradientParts.join(", ")})`;
    chartElement.setAttribute(
      "aria-label",
      `오행 비율 목 ${ratio.wood || 0}%, 화 ${ratio.fire || 0}%, 토 ${ratio.earth || 0}%, 금 ${ratio.metal || 0}%, 수 ${ratio.water || 0}%`,
    );

    legendElement.innerHTML = "";

    window.SajuFiveElements.ELEMENT_ORDER.forEach((element) => {
      const row = document.createElement("li");
      row.innerHTML = `
        <span class="legend-dot" style="background:${ELEMENT_COLORS[element]}"></span>
        <span>${labels[element]}</span>
        <strong>${ratio[element] || 0}%</strong>
      `;
      legendElement.append(row);
    });
  }

  window.AppChart = {
    renderFiveElementChart,
  };
})();
