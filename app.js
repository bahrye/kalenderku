// State Management
let holidays = [];
let currentYear = 2026;
let currentMonth = 6; // July (0-indexed)
let selectedDate = new Date(2026, 6, 11); // Defaults to 11 July 2026
const todayDate = new Date(2026, 6, 11); // Standard today reference as per context

// Cache for storing loaded holidays data per year to avoid repeated fetch requests
const holidaysCache = {};

// Year boundaries configuration
const minYear = 2011;
const maxYear = todayDate.getFullYear() + 2;

// Indonesian Names
const monthNames = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const dayNames = [
  "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"
];

// DOM Elements
const calendarDaysContainer = document.getElementById("calendar-days");
const currentMonthYearHeader = document.getElementById("current-month-year");
const selectMonth = document.getElementById("select-month");
const selectYear = document.getElementById("select-year");
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const btnToday = document.getElementById("btn-today");

// Detail Panel Elements
const detailDayName = document.getElementById("detail-day-name");
const detailWetonBadge = document.getElementById("detail-weton-badge");
const detailDayNum = document.getElementById("detail-day-num");
const detailMonthYear = document.getElementById("detail-month-year");
const detailHijriDate = document.getElementById("detail-hijri-date");
const detailHolidayName = document.getElementById("detail-holiday-name");
const detailHolidayContainer = document.getElementById("detail-holiday-container");

// Holidays List Elements
const holidaysList = document.getElementById("holidays-list");
const holidayCountBadge = document.getElementById("holiday-count-badge");

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  setupTheme();
  populateYearDropdown();
  
  // Sync dropdown options initially (before fetching) to prevent "blink to 2011"
  selectMonth.value = currentMonth;
  selectYear.value = currentYear;

  fetchMetadata();

  fetchHolidays().then(() => {
    renderApp();
    setupEventListeners();
  });
});

// Fetch Last Updated Metadata
async function fetchMetadata() {
  const updateElement = document.getElementById("last-update-time");
  const checkElement = document.getElementById("last-check-time");
  
  const formatWIB = (isoString) => {
    try {
      const d = new Date(isoString);
      const s = new Intl.DateTimeFormat('id-ID', {
        year: 'numeric', month: 'long', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZoneName: 'short', timeZone: 'Asia/Jakarta'
      }).format(d);
      return s.replace(' pukul ', ' ').replace(/\./g, ':');
    } catch(e) {
      return "Format tidak valid";
    }
  };

  try {
    const res = await fetch("/data/metadata.json");
    if (!res.ok) throw new Error("Gagal mengambil metadata");
    const data = await res.json();
    
    if (updateElement) {
      updateElement.innerText = data.lastUpdated ? formatWIB(data.lastUpdated) : "Tidak tersedia";
    }
    if (checkElement) {
      checkElement.innerText = data.lastChecked ? formatWIB(data.lastChecked) : "Tidak tersedia";
    }
  } catch (err) {
    console.warn("Could not load metadata:", err);
    if (updateElement) updateElement.innerText = "Tidak tersedia";
    if (checkElement) checkElement.innerText = "Tidak tersedia";
  }
}

// Dynamic year dropdown generator
function populateYearDropdown() {
  selectYear.innerHTML = "";
  for (let yr = maxYear; yr >= minYear; yr--) {
    const option = document.createElement("option");
    option.value = yr;
    option.innerText = yr;
    selectYear.appendChild(option);
  }
}

// Theme Configuration
function setupTheme() {
  const themeToggle = document.getElementById("theme-toggle");
  
  // Fetch icons initially to set correct state before Lucide renders
  const darkIcon = document.getElementById("theme-toggle-dark-icon");
  const lightIcon = document.getElementById("theme-toggle-light-icon");
  
  // Use theme class pre-applied by inline head script
  const isDark = document.documentElement.classList.contains("dark");

  if (isDark) {
    darkIcon.classList.remove("hidden");
    lightIcon.classList.add("hidden");
  } else {
    darkIcon.classList.add("hidden");
    lightIcon.classList.remove("hidden");
  }

  themeToggle.addEventListener("click", () => {
    // Re-fetch icons because lucide.createIcons() replaces the original <i> tags with <svg> tags
    const currentDarkIcon = document.getElementById("theme-toggle-dark-icon");
    const currentLightIcon = document.getElementById("theme-toggle-light-icon");

    if (document.documentElement.classList.contains("dark")) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      if (currentDarkIcon) currentDarkIcon.classList.add("hidden");
      if (currentLightIcon) currentLightIcon.classList.remove("hidden");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      if (currentDarkIcon) currentDarkIcon.classList.remove("hidden");
      if (currentLightIcon) currentLightIcon.classList.add("hidden");
    }
  });
}

// Fetch Holidays Data for a specific year (defaults to currentYear)
async function fetchHolidays(year) {
  const targetYear = year || currentYear;
  if (holidaysCache[targetYear]) {
    holidays = holidaysCache[targetYear];
    return;
  }

  // Try fetching from Cloudflare D1 Database (via Pages Function)
  try {
    const response = await fetch(`/api/holidays?year=${targetYear}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Response bukan JSON");
    }

    const data = await response.json();
    if (Array.isArray(data)) {
      holidaysCache[targetYear] = data;
      holidays = data;
      console.log(`Successfully loaded holidays for year ${targetYear} from Cloudflare D1.`);
      return;
    }
    throw new Error("Format data D1 tidak sesuai");
  } catch (apiError) {
    console.warn(`Gagal memuat D1 untuk tahun ${targetYear}, mencoba fallback ke data lokal:`, apiError.message || apiError);
    
    // Fallback to local yearly JSON file
    try {
      const response = await fetch(`public/data/holidays-${targetYear}.json`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Response lokal bukan JSON");
      }

      const localData = await response.json();
      holidaysCache[targetYear] = localData;
      holidays = localData;
      console.log(`Successfully loaded holidays for year ${targetYear} from local fallback.`);
    } catch (localError) {
      console.warn(`Gagal memuat data hari libur lokal untuk tahun ${targetYear}:`, localError.message || localError);
      holidaysCache[targetYear] = [];
      holidays = [];
    }
  }
}

// Setup Event Listeners
function setupEventListeners() {
  btnPrev.addEventListener("click", () => {
    hideTooltip();
    navigateMonth(-1);
  });

  btnNext.addEventListener("click", () => {
    hideTooltip();
    navigateMonth(1);
  });

  selectMonth.addEventListener("change", (e) => {
    hideTooltip();
    currentMonth = parseInt(e.target.value);
    renderApp();
  });

  selectYear.addEventListener("change", async (e) => {
    hideTooltip();
    currentYear = parseInt(e.target.value);
    await fetchHolidays(currentYear);
    renderApp();
  });

  btnToday.addEventListener("click", async () => {
    hideTooltip();
    selectedDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    const targetYear = selectedDate.getFullYear();
    currentMonth = selectedDate.getMonth();
    
    selectMonth.value = currentMonth;
    selectYear.value = targetYear;
    
    if (currentYear !== targetYear) {
      currentYear = targetYear;
      await fetchHolidays(currentYear);
    }
    
    renderApp();
  });
}

// Navigate Month Helper
async function navigateMonth(direction) {
  let targetMonth = currentMonth + direction;
  let targetYear = currentYear;
  if (targetMonth < 0) {
    targetMonth = 11;
    targetYear -= 1;
  } else if (targetMonth > 11) {
    targetMonth = 0;
    targetYear += 1;
  }
  
  // Bound to years dynamic range (minYear to maxYear)
  if (targetYear < minYear) {
    targetYear = minYear;
    targetMonth = 0;
  } else if (targetYear > maxYear) {
    targetYear = maxYear;
    targetMonth = 11;
  }

  currentMonth = targetMonth;
  
  if (currentYear !== targetYear) {
    currentYear = targetYear;
    selectYear.value = currentYear;
    await fetchHolidays(currentYear);
  }

  selectMonth.value = currentMonth;
  
  renderApp();
}

// Render Complete App
function renderApp() {
  currentMonthYearHeader.innerText = `${monthNames[currentMonth]} ${currentYear}`;
  renderCalendarGrid();
  updateDetailCard();
  updateHolidaysList();
  
  // Update API URL example to use current year
  const apiUrlText = document.getElementById("api-url-text");
  const apiUrlLink = document.getElementById("api-url-link");
  if (apiUrlText && apiUrlLink) {
    const url = `https://kalender-id.pages.dev/api/holidays?year=${currentYear}`;
    apiUrlText.innerText = url;
    apiUrlLink.href = url;
  }
  
  lucide.createIcons();
}

// Render Calendar Grid (Days & Holidays)
function renderCalendarGrid() {
  calendarDaysContainer.innerHTML = "";

  const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // Sunday=0, Monday=1, ...
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Prev Month Days for padding
  const prevMonthTotalDays = new Date(currentYear, currentMonth, 0).getDate();
  const startDayPadding = firstDay; // number of empty cells at start

  // Render padding cells from previous month
  for (let i = startDayPadding - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const paddingCell = document.createElement("div");
    paddingCell.className = "flex flex-col items-center justify-center p-2 rounded-xl text-slate-300 dark:text-slate-700 text-sm font-medium bg-slate-100/30 dark:bg-slate-900/20 cursor-not-allowed select-none";
    paddingCell.innerText = dayNum;
    calendarDaysContainer.appendChild(paddingCell);
  }

  // Render actual month cells
  for (let day = 1; day <= totalDays; day++) {
    const currentDate = new Date(currentYear, currentMonth, day);
    const dayOfWeek = currentDate.getDay(); // 0 = Minggu, 6 = Sabtu
    const dateString = formatDateString(currentDate);

    // Find all holidays for this date
    const dayHolidays = holidays.filter(h => h.date === dateString);
    const holiday = dayHolidays[0];

    const cell = document.createElement("button");
    cell.type = "button";
    
    // Core styling classes
    let cellClasses = "flex flex-col items-center justify-between p-1 sm:p-2.5 rounded-xl text-sm font-medium relative h-12 sm:h-14 w-full transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none ";
    
    let labelClasses = "text-xs font-semibold mt-auto truncate w-full text-center px-0.5 ";
    let numClasses = "text-sm sm:text-base font-bold ";

    // Identify holiday vs weekend vs weekday styling
    if (dayOfWeek === 0 || (holiday && !holiday.is_leave_together)) {
      // Sunday or National Holiday (Red theme)
      cellClasses += "bg-rose-50 hover:bg-rose-100/80 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 dark:text-rose-400";
    } else if (holiday && holiday.is_leave_together) {
      // Cuti Bersama (Emerald/Sage green theme)
      cellClasses += "bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/25 dark:hover:bg-emerald-900/30 dark:text-emerald-400";
    } else if (dayOfWeek === 6) {
      // Saturday (Sky/Blue theme)
      cellClasses += "bg-sky-50 hover:bg-sky-100/80 text-sky-600 dark:bg-sky-950/20 dark:hover:bg-sky-900/30 dark:text-sky-400";
    } else {
      // Normal Day (Slate theme)
      cellClasses += "bg-slate-100/60 hover:bg-slate-200/50 dark:bg-slate-800/40 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300";
    }

    // Highlight "Today" (glowing ring)
    const isToday = todayDate.getFullYear() === currentYear && todayDate.getMonth() === currentMonth && todayDate.getDate() === day;
    if (isToday) {
      cellClasses += " ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900";
    }

    // Highlight Selected Date
    const isSelected = selectedDate.getFullYear() === currentYear && selectedDate.getMonth() === currentMonth && selectedDate.getDate() === day;
    if (isSelected) {
      cell.id = "selected-date-cell";
      cellClasses += " border-2 border-indigo-600 dark:border-indigo-400 shadow-sm";
    }

    cell.className = cellClasses;

    // Render contents inside cell
    // Day Number
    const numEl = document.createElement("span");
    numEl.className = numClasses;
    numEl.innerText = day;
    cell.appendChild(numEl);

    // Indicator Dot/Badge inside cell
    if (holiday) {
      const dot = document.createElement("span");
      dot.className = `w-1.5 h-1.5 rounded-full ${holiday.is_leave_together ? 'bg-emerald-500' : 'bg-rose-500'} mt-1`;
      cell.appendChild(dot);
    } else {
      // Subtle Javanese pasaran name (very small) for normal days
      const pasaranName = getJavanesePasaran(currentDate);
      const pasaranEl = document.createElement("span");
      pasaranEl.className = "text-[9px] font-normal text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-tight";
      pasaranEl.innerText = pasaranName.substring(0, 3);
      cell.appendChild(pasaranEl);
    }

    // Click handler to select date
    cell.addEventListener("click", (e) => {
      selectedDate = currentDate;

      // Close previous tooltip
      hideTooltip();

      renderApp();

      // If on mobile and it is a holiday, show tooltip on the newly selected cell
      if (window.innerWidth < 1024 && dayHolidays.length > 0) {
        // Prevent click from propagating to document listener immediately
        e.stopPropagation();
        const selectedCell = document.getElementById("selected-date-cell");
        if (selectedCell) {
          showTooltip(selectedCell, dayHolidays);
        }
      }
    });

    calendarDaysContainer.appendChild(cell);
  }

  // Next Month padding to finish grid (42 cells total for perfect 6 rows)
  const totalCellsRendered = startDayPadding + totalDays;
  const remainingCells = 42 - totalCellsRendered;
  
  for (let i = 1; i <= remainingCells; i++) {
    const paddingCell = document.createElement("div");
    paddingCell.className = "flex flex-col items-center justify-center p-2 rounded-xl text-slate-300 dark:text-slate-700 text-sm font-medium bg-slate-100/30 dark:bg-slate-900/20 cursor-not-allowed select-none";
    paddingCell.innerText = i;
    calendarDaysContainer.appendChild(paddingCell);
  }
}

// Update detail card on the right
function updateDetailCard() {
  const dayIndex = selectedDate.getDay();
  const dayNum = selectedDate.getDate();
  const monthIndex = selectedDate.getMonth();
  const year = selectedDate.getFullYear();

  // Populate basic date info
  detailDayName.innerText = dayNames[dayIndex];
  detailDayNum.innerText = dayNum;
  detailMonthYear.innerText = `${monthNames[monthIndex]} ${year}`;

  // Javanese weton pasaran
  const pasaran = getJavanesePasaran(selectedDate);
  detailWetonBadge.innerText = pasaran;

  // Hijri date
  const hijri = getHijriDate(selectedDate);
  detailHijriDate.innerText = `${hijri.day} ${hijri.month} ${hijri.year} H`;

  // Holiday details
  const dateString = formatDateString(selectedDate);
  const holiday = holidays.find(h => h.date === dateString);

  if (holiday) {
    detailHolidayName.innerText = holiday.name;
    detailHolidayContainer.classList.remove("border-white/10");
    if (holiday.is_leave_together) {
      detailHolidayContainer.className = "mt-6 pt-4 border-t border-emerald-400/40 text-emerald-100";
      detailHolidayName.className = "text-sm font-bold mt-0.5 text-emerald-100";
    } else {
      detailHolidayContainer.className = "mt-6 pt-4 border-t border-rose-400/40 text-rose-100";
      detailHolidayName.className = "text-sm font-bold mt-0.5 text-rose-100";
    }
  } else {
    detailHolidayContainer.className = "mt-6 pt-4 border-t border-white/20 text-indigo-100";
    if (dayIndex === 0) {
      detailHolidayName.innerText = "Libur Akhir Pekan (Minggu)";
    } else if (dayIndex === 6) {
      detailHolidayName.innerText = "Libur Akhir Pekan (Sabtu)";
    } else {
      detailHolidayName.innerText = "Hari Kerja Biasa";
    }
    detailHolidayName.className = "text-sm font-medium mt-0.5";
  }
}

// Populate the holiday list for active month
function updateHolidaysList() {
  holidaysList.innerHTML = "";

  // Filter holidays for the active month and year
  const activeMonthString = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const monthlyHolidays = holidays.filter(h => h.date.startsWith(activeMonthString));

  // Sort monthly holidays by date
  monthlyHolidays.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Update Count Badge
  holidayCountBadge.innerText = `${monthlyHolidays.length} Hari`;

  if (monthlyHolidays.length === 0) {
    holidaysList.innerHTML = `
      <div class="text-center text-slate-400 dark:text-slate-500 text-sm py-16">
        <i data-lucide="smile" class="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700"></i>
        Tidak ada hari libur di bulan ini
      </div>
    `;
    return;
  }

  monthlyHolidays.forEach(holiday => {
    const hDate = new Date(holiday.date);
    const dateNum = hDate.getDate();
    const dayName = dayNames[hDate.getDay()];
    const pasaran = getJavanesePasaran(hDate);

    const holidayItem = document.createElement("button");
    holidayItem.type = "button";
    holidayItem.className = "w-full text-left flex items-center space-x-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition duration-150 border border-transparent hover:border-slate-200 dark:hover:border-slate-700/50";
    
    // Highlight if this holiday is selected
    const isSelected = selectedDate.getDate() === dateNum && selectedDate.getMonth() === currentMonth && selectedDate.getFullYear() === currentYear;
    if (isSelected) {
      holidayItem.className += " bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700";
    }

    // Dot color based on holiday type
    const colorClass = holiday.is_leave_together 
      ? "bg-emerald-500 text-emerald-600 dark:text-emerald-400" 
      : "bg-rose-500 text-rose-600 dark:text-rose-400";

    const badgeColorClass = holiday.is_leave_together
      ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
      : "bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300";

    holidayItem.innerHTML = `
      <div class="w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold text-sm shrink-0 ${badgeColorClass}">
        <span>${dateNum}</span>
      </div>
      <div class="flex-grow min-w-0">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">${dayName} ${pasaran}</span>
          <span class="inline-block w-2.5 h-2.5 rounded-full ${colorClass.split(' ')[0]}"></span>
        </div>
        <p class="text-sm font-semibold text-slate-800 dark:text-white truncate mt-0.5">${holiday.name}</p>
      </div>
    `;

    holidayItem.addEventListener("click", () => {
      selectedDate = hDate;
      renderApp();
    });

    holidaysList.appendChild(holidayItem);
  });
}

// Helper: Format Date object to YYYY-MM-DD
function formatDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Javanese Weton Pasaran Calculation
function getJavanesePasaran(date) {
  const refDate = new Date(1970, 0, 1);
  const d1 = Date.UTC(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const d2 = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  const pasarans = ['Wage', 'Kliwon', 'Legi', 'Pahing', 'Pon'];
  const index = ((diffDays % 5) + 5) % 5;
  return pasarans[index];
}

function getHijriDate(date) {
  const parts = new Intl.DateTimeFormat('id-ID-u-ca-islamic', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric'
  }).formatToParts(date);

  const dayPart = parts.find(p => p.type === 'day');
  const monthPart = parts.find(p => p.type === 'month');
  const yearPart = parts.find(p => p.type === 'year');

  const hm = parseInt(monthPart.value, 10);

  const hijriMonths = [
    "Muharram", "Safar", "Rabi'ul Awal", "Rabi'ul Akhir",
    "Jumadil Awal", "Jumadil Akhir", "Rajab", "Sya'ban",
    "Ramadhan", "Syawal", "Dzulqa'dah", "Dzulhijjah"
  ];
  
  return {
    day: parseInt(dayPart.value, 10),
    month: hijriMonths[hm - 1] || "Muharram",
    year: parseInt(yearPart.value, 10)
  };
}

// Tooltip Helpers for Mobile Viewports
let tooltipEl = null;

function createTooltip() {
  if (tooltipEl) return;
  tooltipEl = document.createElement("div");
  tooltipEl.id = "calendar-tooltip";
  tooltipEl.className = "absolute hidden z-50 p-3.5 rounded-xl shadow-xl backdrop-blur-md text-white text-xs max-w-[220px] border transition-all duration-150 ease-out scale-95 opacity-0 pointer-events-auto";
  document.body.appendChild(tooltipEl);

  // Close when clicking outside of the calendar cells
  document.addEventListener("click", (e) => {
    if (tooltipEl && !tooltipEl.contains(e.target) && !e.target.closest("#calendar-days")) {
      hideTooltip();
    }
  });
}

function showTooltip(cell, dayHolidays) {
  createTooltip();
  
  if (!dayHolidays || dayHolidays.length === 0) return;

  // Let's generate HTML for all holidays
  let contentHtml = `<div class="flex flex-col space-y-3">`;
  
  dayHolidays.forEach((holiday, index) => {
    const isLeave = holiday.is_leave_together;
    const badgeText = isLeave ? "Cuti Bersama" : "Libur Nasional";
    const badgeClass = isLeave 
      ? "bg-emerald-800 dark:bg-emerald-900 text-emerald-100" 
      : "bg-rose-800 dark:bg-rose-900 text-rose-100";
    
    // Add border top if it's the second or subsequent holiday
    const borderClass = index > 0 ? "border-t border-white/20 pt-2.5" : "";

    contentHtml += `
      <div class="flex flex-col space-y-1.5 ${borderClass}">
        <span class="w-fit text-[9px] font-extrabold uppercase tracking-wider ${badgeClass} px-1.5 py-0.5 rounded">${badgeText}</span>
        <p class="font-bold leading-snug text-white">${holiday.name}</p>
      </div>
    `;
  });

  // Add the date at the bottom
  contentHtml += `
      <p class="text-[10px] text-slate-300 dark:text-slate-400 border-t border-white/10 pt-2 mt-1">${formatTooltipDate(dayHolidays[0].date)}</p>
    </div>
  `;

  // Set visual theme based on whether there's any national holiday
  const hasNationalHoliday = dayHolidays.some(h => !h.is_leave_together);
  if (hasNationalHoliday) {
    tooltipEl.className = "absolute z-50 p-3.5 rounded-xl shadow-xl backdrop-blur-md text-white text-xs max-w-[220px] border border-rose-500/20 bg-rose-900/95 dark:bg-rose-950/95 transition-all duration-150 ease-out pointer-events-auto";
  } else {
    tooltipEl.className = "absolute z-50 p-3.5 rounded-xl shadow-xl backdrop-blur-md text-white text-xs max-w-[220px] border border-emerald-500/20 bg-emerald-900/95 dark:bg-emerald-950/95 transition-all duration-150 ease-out pointer-events-auto";
  }

  tooltipEl.innerHTML = contentHtml;

  // Position the tooltip centered relative to the cell
  const buttonRect = cell.getBoundingClientRect();
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  // Temporarily show to measure width
  tooltipEl.classList.remove("hidden");
  tooltipEl.style.opacity = "0";
  tooltipEl.style.transform = "scale(0.95)";
  
  const tooltipWidth = tooltipEl.offsetWidth;
  const viewportWidth = window.innerWidth;

  // Center position of the cell button
  const cellCenter = buttonRect.left + scrollLeft + (buttonRect.width / 2);
  let left = cellCenter - (tooltipWidth / 2);

  // Constrain left boundary (min 12px padding from viewport edge)
  if (left < scrollLeft + 12) {
    left = scrollLeft + 12;
  }
  // Constrain right boundary (min 12px padding from viewport edge)
  else if (left + tooltipWidth > scrollLeft + viewportWidth - 12) {
    left = scrollLeft + viewportWidth - 12 - tooltipWidth;
  }

  tooltipEl.style.left = `${left}px`;

  // Prevent top boundary overflow (e.g. top row of the calendar)
  const isTopRow = buttonRect.top - 120 < 0;
  if (isTopRow) {
    tooltipEl.style.top = `${buttonRect.bottom + scrollTop + 8}px`;
    tooltipEl.style.transform = 'translate(0, 0) scale(0.95)';
  } else {
    tooltipEl.style.top = `${buttonRect.top + scrollTop - 8}px`;
    tooltipEl.style.transform = 'translate(0, -100%) scale(0.95)';
  }
  
  // Transition-in
  setTimeout(() => {
    if (tooltipEl) {
      tooltipEl.style.opacity = "1";
      tooltipEl.style.transform = tooltipEl.style.transform.replace("scale(0.95)", "scale(1)");
    }
  }, 10);
}

function hideTooltip() {
  if (tooltipEl && !tooltipEl.classList.contains("hidden")) {
    tooltipEl.style.opacity = "0";
    tooltipEl.style.transform = tooltipEl.style.transform.replace("scale(1)", "scale(0.95)");
    setTimeout(() => {
      if (tooltipEl && tooltipEl.style.opacity === "0") {
        tooltipEl.classList.add("hidden");
      }
    }, 150);
  }
}

function formatTooltipDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  const date = new Date(y, m - 1, d);
  return `${dayNames[date.getDay()]}, ${parseInt(d)} ${monthNames[date.getMonth()]} ${y}`;
}
