/**
 * Owns every birth date/time input concern.
 * app.js should only read the normalized value from this component.
 */
(function () {
  const selectors = {
    year: "#birthYear",
    month: "#birthMonth",
    day: "#birthDay",
    time: "#birthTime",
    hiddenDate: "#birthDate",
  };

  let fields = {};

  function init() {
    fields = {
      year: document.querySelector(selectors.year),
      month: document.querySelector(selectors.month),
      day: document.querySelector(selectors.day),
      time: document.querySelector(selectors.time),
      hiddenDate: document.querySelector(selectors.hiddenDate),
    };

    if (fields.year) {
      fields.year.max = String(new Date().getFullYear());
      fields.year.addEventListener("input", handleDateChange);
      fields.year.addEventListener("change", handleDateChange);
    }

    if (fields.month) {
      fields.month.addEventListener("input", handleDateChange);
      fields.month.addEventListener("change", handleDateChange);
    }

    if (fields.day) {
      fields.day.addEventListener("change", syncHiddenDate);
    }

    if (fields.time && !fields.time.value) {
      fields.time.value = "UNKNOWN";
    }

    populateBirthDays();
    schedulePopulate();
    syncHiddenDate();
  }

  function schedulePopulate() {
    const run = () => {
      populateBirthDays();
      syncHiddenDate();
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(run);
      return;
    }

    window.setTimeout(run, 0);
  }

  function handleDateChange() {
    populateBirthDays();
    syncHiddenDate();
  }

  function populateBirthDays() {
    if (!fields.day) return;

    const selectedDay = Number(fields.day.value);
    const maxDay = getDaysInMonth(getNumber(fields.year), getNumber(fields.month));

    fields.day.replaceChildren(createOption("", "일"));

    for (let day = 1; day <= maxDay; day += 1) {
      const text = pad2(day);
      fields.day.append(createOption(text, text));
    }

    if (selectedDay) {
      fields.day.value = pad2(Math.min(selectedDay, maxDay));
    }
  }

  function getValue() {
    syncHiddenDate();

    const year = normalizeYear(fields.year?.value);
    const month = normalizePart(fields.month?.value);
    const day = normalizePart(fields.day?.value);
    const birthDate = year && month && day ? `${year}-${month}-${day}` : "";
    const selectedTime = fields.time?.value || "UNKNOWN";
    const hourUnknown = selectedTime === "UNKNOWN";

    return {
      year,
      month,
      day,
      birthYear: year,
      birthMonth: month,
      birthDay: day,
      birthDate,
      birthTime: hourUnknown ? "UNKNOWN" : selectedTime,
      birthTimeLabel: hourUnknown ? "시간 모름" : selectedTime,
      hourUnknown,
    };
  }

  function reset() {
    if (fields.year) fields.year.value = "";
    if (fields.month) fields.month.value = "";
    if (fields.day) fields.day.value = "";
    if (fields.time) fields.time.value = "UNKNOWN";

    populateBirthDays();
    syncHiddenDate();
  }

  function isValidDate(value) {
    const year = Number(value.birthYear || value.year);
    const month = Number(value.birthMonth || value.month);
    const day = Number(value.birthDay || value.day);
    const currentYear = new Date().getFullYear();

    if (!Number.isInteger(year) || year < 1900 || year > currentYear) return false;
    if (!Number.isInteger(month) || month < 1 || month > 12) return false;
    if (!Number.isInteger(day) || day < 1 || day > getDaysInMonth(year, month)) return false;

    const parsed = window.SajuUtils.parseDate(value.birthDate);
    return Boolean(parsed) && parsed.year === year && parsed.month === month && parsed.day === day;
  }

  function syncHiddenDate() {
    if (fields.hiddenDate) {
      fields.hiddenDate.value = getValueWithoutSync().birthDate;
    }
  }

  function getValueWithoutSync() {
    const year = normalizeYear(fields.year?.value);
    const month = normalizePart(fields.month?.value);
    const day = normalizePart(fields.day?.value);
    const birthDate = year && month && day ? `${year}-${month}-${day}` : "";

    return { year, month, day, birthDate };
  }

  function getDaysInMonth(year, month) {
    if (!Number.isInteger(month) || month < 1 || month > 12) return 31;
    if (month === 2) {
      if (!Number.isInteger(year) || year < 1) return 29;
      return isLeapYear(year) ? 29 : 28;
    }
    if ([4, 6, 9, 11].includes(month)) return 30;
    return 31;
  }

  function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  function getNumber(field) {
    return Number(field?.value || 0);
  }

  function normalizeYear(value) {
    const text = String(value || "").trim();
    return text ? text.padStart(4, "0") : "";
  }

  function normalizePart(value) {
    const number = Number(value);
    return number ? pad2(number) : "";
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function createOption(value, text) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    return option;
  }

  window.BirthInput = {
    getValue,
    init,
    isValidDate,
    populateBirthDays,
    reset,
  };
})();
