/* ============================================
   سامانه ثبت قرارداد — رسانه میم
   ============================================ */

const WORKER_URL = 'https://iran.miim-mr63.workers.dev/';

/* ============================================
   ۱) تبدیل تاریخ میلادی ↔ شمسی
   ============================================ */
const PERSIAN_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const PERSIAN_WEEKDAYS = ['ش','ی','د','س','چ','پ','ج'];

function toJalali(gy, gm, gd) {
  const gDM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + gDM[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return [jy, jm, jd];
}

function toGregorian(jy, jm, jd) {
  let gy = (jy <= 979) ? 621 : 1600;
  jy -= (jy <= 979) ? 0 : 979;
  let days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0);
  const salA = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm;
  for (gm = 0; gm < 13 && gd > salA[gm]; gm++) gd -= salA[gm];
  return [gy, gm, gd];
}

function jalaliMonthDays(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  const test = toGregorian(jy, 12, 30);
  const back = toJalali(test[0], test[1], test[2]);
  return (back[0] === jy && back[1] === 12 && back[2] === 30) ? 30 : 29;
}

function jalaliDayOfWeek(jy, jm, jd) {
  const [gy, gm, gd] = toGregorian(jy, jm, jd);
  const d = new Date(gy, gm - 1, gd);
  return (d.getDay() + 1) % 7;
}

function pad2(n) { return n < 10 ? '0' + n : String(n); }
function formatJalali(jy, jm, jd) { return `${jy}/${pad2(jm)}/${pad2(jd)}`; }

/* ============================================
   ۲) تقویم شمسی سفارشی
   ============================================ */
const activePickers = [];

function createPersianDatePicker(input) {
  const today = new Date();
  const [tjy, tjm, tjd] = toJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());

  let viewJy = tjy;
  let viewJm = tjm;
  let selected = null;

  const popup = document.createElement('div');
  popup.className = 'pdp-popup';
  popup.innerHTML = `
    <div class="pdp-header">
      <button type="button" class="pdp-nav" data-dir="1"><i class="fa-solid fa-chevron-right"></i></button>
      <div class="pdp-title">
        <select class="pdp-month"></select>
        <select class="pdp-year"></select>
      </div>
      <button type="button" class="pdp-nav" data-dir="-1"><i class="fa-solid fa-chevron-left"></i></button>
    </div>
    <div class="pdp-weekdays"></div>
    <div class="pdp-days"></div>
    <div class="pdp-footer">
      <button type="button" class="pdp-today">
        <i class="fa-solid fa-calendar-day"></i> امروز
      </button>
      <button type="button" class="pdp-clear">
        <i class="fa-solid fa-eraser"></i> پاک کردن
      </button>
    </div>
  `;
  document.body.appendChild(popup);

  const monthSelect = popup.querySelector('.pdp-month');
  const yearSelect  = popup.querySelector('.pdp-year');
  const weekdaysEl  = popup.querySelector('.pdp-weekdays');
  const daysEl      = popup.querySelector('.pdp-days');

  PERSIAN_MONTHS.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = i + 1;
    opt.textContent = name;
    monthSelect.appendChild(opt);
  });

  for (let y = tjy - 100; y <= tjy + 10; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  }

  PERSIAN_WEEKDAYS.forEach(w => {
    const s = document.createElement('span');
    s.textContent = w;
    weekdaysEl.appendChild(s);
  });

  function renderDays() {
    daysEl.innerHTML = '';
    monthSelect.value = viewJm;
    yearSelect.value = viewJy;

    const totalDays = jalaliMonthDays(viewJy, viewJm);
    const firstDow = jalaliDayOfWeek(viewJy, viewJm, 1);

    for (let i = 0; i < firstDow; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pdp-day empty';
      daysEl.appendChild(b);
    }

    for (let d = 1; d <= totalDays; d++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pdp-day';
      btn.textContent = d;

      if (viewJy === tjy && viewJm === tjm && d === tjd) btn.classList.add('today');
      if (selected && viewJy === selected[0] && viewJm === selected[1] && d === selected[2]) {
        btn.classList.add('selected');
      }

      btn.addEventListener('click', () => {
        selected = [viewJy, viewJm, d];
        const str = formatJalali(viewJy, viewJm, d);
        input.value = str;
        input.dataset.jalali = str;
        const [gy, gm, gd] = toGregorian(viewJy, viewJm, d);
        input.dataset.gregorian = `${gy}-${pad2(gm)}-${pad2(gd)}`;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        close();
      });

      daysEl.appendChild(btn);
    }
  }

  function open() {
    if (input.dataset.jalali) {
      const [y, m, d] = input.dataset.jalali.split('/').map(Number);
      selected = [y, m, d];
      viewJy = y; viewJm = m;
    } else {
      viewJy = tjy; viewJm = tjm;
    }
    renderDays();
    position();
    popup.classList.add('show');
    if (!activePickers.includes(picker)) activePickers.push(picker);
  }

  function close() {
    popup.classList.remove('show');
    const idx = activePickers.indexOf(picker);
    if (idx > -1) activePickers.splice(idx, 1);
  }

  function position() {
    const rect = input.getBoundingClientRect();
    const popupW = 300;
    const popupH = 380;
    let left = rect.left + rect.width / 2 - popupW / 2;
    let top  = rect.bottom + 8;

    if (left < 8) left = 8;
    if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;
    if (top + popupH > window.innerHeight) top = rect.top - popupH - 8;
    if (top < 8) top = 8;

    popup.style.left = left + 'px';
    popup.style.top  = top + 'px';
  }

  const picker = { input, open, close, popup, contains: (el) => popup.contains(el) };

  input.addEventListener('click', (e) => {
    e.stopPropagation();
    activePickers.slice().forEach(p => { if (p !== picker) p.close(); });
    if (popup.classList.contains('show')) close();
    else open();
  });

  popup.querySelectorAll('.pdp-nav').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = Number(btn.dataset.dir);
      viewJm += dir;
      if (viewJm > 12) { viewJm = 1; viewJy++; }
      if (viewJm < 1)  { viewJm = 12; viewJy--; }
      renderDays();
    });
  });

  monthSelect.addEventListener('change', () => {
    viewJm = Number(monthSelect.value);
    renderDays();
  });
  yearSelect.addEventListener('change', () => {
    viewJy = Number(yearSelect.value);
    renderDays();
  });

  popup.querySelector('.pdp-today').addEventListener('click', () => {
    viewJy = tjy; viewJm = tjm;
    selected = [tjy, tjm, tjd];
    const str = formatJalali(tjy, tjm, tjd);
    input.value = str;
    input.dataset.jalali = str;
    const [gy, gm, gd] = toGregorian(tjy, tjm, tjd);
    input.dataset.gregorian = `${gy}-${pad2(gm)}-${pad2(gd)}`;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  });

  popup.querySelector('.pdp-clear').addEventListener('click', () => {
    input.value = '';
    delete input.dataset.jalali;
    delete input.dataset.gregorian;
    selected = null;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  });

  return picker;
}

document.addEventListener('click', (e) => {
  activePickers.slice().forEach(p => {
    if (!p.contains(e.target) && e.target !== p.input) p.close();
  });
});

document.querySelectorAll('.persian-date').forEach(inp => createPersianDatePicker(inp));

/* ============================================
   ۳) مبلغ قرارداد
   ============================================ */
const amountInput = document.getElementById('amount');
const amountInWords = document.getElementById('amountInWords');
const amountInContract = document.getElementById('amountInContract');

function formatNumber(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function numberToPersianWords(num) {
  if (num === 0) return 'صفر';
  const yekan = ['','یک','دو','سه','چهار','پنج','شش','هفت','هشت','نه'];
  const dahgan = ['','','بیست','سی','چهل','پنجاه','شصت','هفتاد','هشتاد','نود'];
  const dah = ['ده','یازده','دوازده','سیزده','چهارده','پانزده','شانزده','هفده','هجده','نوزده'];
  const sadgan = ['','صد','دویست','سیصد','چهارصد','پانصد','ششصد','هفتصد','هشتصد','نهصد'];
  const scales = ['','هزار','میلیون','میلیارد','بیلیون'];

  function threeDigit(n) {
    const parts = [];
    const s = Math.floor(n / 100);
    const rem = n % 100;
    if (s) parts.push(sadgan[s]);
    if (rem >= 10 && rem < 20) {
      parts.push(dah[rem - 10]);
    } else {
      const d = Math.floor(rem / 10);
      const y = rem % 10;
      if (d) parts.push(dahgan[d]);
      if (y) parts.push(yekan[y]);
    }
    return parts.join(' و ');
  }

  const groups = [];
  let n = num;
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }

  const out = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    const w = threeDigit(groups[i]);
    if (scales[i]) out.push(w + ' ' + scales[i]);
    else out.push(w);
  }
  return out.join(' و ');
}

if (amountInput) {
  amountInput.addEventListener('input', (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw === '') {
      e.target.value = '';
      amountInWords.textContent = '';
      amountInContract.textContent = 'مبلغ توافق‌شده';
      return;
    }
    const num = parseInt(raw, 10);
    e.target.value = formatNumber(num);
    amountInWords.textContent = numberToPersianWords(num) + ' تومان';
    amountInContract.textContent = formatNumber(num) + ' تومان';
  });

  amountInput.value = '6,000,000';
  amountInWords.textContent = numberToPersianWords(6000000) + ' تومان';
  amountInContract.textContent = '6,000,000 تومان';
}

/* ============================================
   ۴) همگام‌سازی نام مشتری
   ============================================ */
const fullNameInput = document.getElementById('fullName');
const customerNameInContract = document.getElementById('customerNameInContract');

fullNameInput.addEventListener('input', (e) => {
  const val = e.target.value.trim();
  customerNameInContract.textContent = val || 'علی رضایی';
});

/* ============================================
   ۵) همگام‌سازی تاریخ‌ها
   ============================================ */
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const contractDateDisplay = document.getElementById('contractDateDisplay');
const startDateDisplay = document.getElementById('startDateDisplay');
const endDateDisplay = document.getElementById('endDateDisplay');

const now = new Date();
const [tjy, tjm, tjd] = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
contractDateDisplay.textContent = formatJalali(tjy, tjm, tjd);

startDateInput.value = formatJalali(tjy, tjm, tjd);
startDateInput.dataset.jalali = formatJalali(tjy, tjm, tjd);
startDateDisplay.textContent = formatJalali(tjy, tjm, tjd);

const nextMonth = new Date(now);
nextMonth.setMonth(nextMonth.getMonth() + 1);
const [njy, njm, njd] = toJalali(nextMonth.getFullYear(), nextMonth.getMonth() + 1, nextMonth.getDate());
endDateInput.value = formatJalali(njy, njm, njd);
endDateInput.dataset.jalali = formatJalali(njy, njm, njd);
endDateDisplay.textContent = formatJalali(njy, njm, njd);

startDateInput.addEventListener('change', () => {
  startDateDisplay.textContent = startDateInput.value || '.................';
});
endDateInput.addEventListener('change', () => {
  endDateDisplay.textContent = endDateInput.value || '.................';
});

/* ============================================
   ۶) امضای دیجیتال
   ============================================ */
const canvas = document.getElementById('signatureCanvas');
const ctx = canvas.getContext('2d');
const placeholder = document.getElementById('sigPlaceholder');
const sigWrap = document.querySelector('.signature-wrap');

/* 🎨 رنگ قلم امضا — هماهنگ با پالت سایت */
const SIGNATURE_COLOR = '#d97706';   // نارنجی طلایی
const SIGNATURE_BG    = '#ffffff';   // پس‌زمینه سفید

let drawing = false;
let hasSignature = false;
let lastX = 0;
let lastY = 0;

function setupCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const prev = hasSignature ? canvas.toDataURL() : null;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = SIGNATURE_COLOR;  // 🎨 نارنجی طلایی
  ctx.lineWidth = 2.6;

  if (prev) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
    img.src = prev;
  }
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const p = e.touches ? e.touches[0] : e;
  return { x: p.clientX - rect.left, y: p.clientY - rect.top };
}

function startDraw(e) {
  e.preventDefault();
  drawing = true;
  sigWrap.classList.add('active');
  const pos = getPos(e);
  lastX = pos.x;
  lastY = pos.y;
  if (!hasSignature) {
    hasSignature = true;
    placeholder.classList.add('hide');
  }
}

function draw(e) {
  if (!drawing) return;
  e.preventDefault();
  const pos = getPos(e);
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  lastX = pos.x;
  lastY = pos.y;
}

function endDraw() {
  drawing = false;
  sigWrap.classList.remove('active');
}

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', endDraw);
canvas.addEventListener('mouseleave', endDraw);
canvas.addEventListener('touchstart', startDraw, { passive: false });
canvas.addEventListener('touchmove', draw, { passive: false });
canvas.addEventListener('touchend', endDraw);

window.addEventListener('resize', setupCanvas);
setupCanvas();

/* 🔧 تبدیل امضا به PNG با پس‌زمینه سفید */
function getSignatureWithWhiteBg() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // ساخت یه بوم موقت با پس‌زمینه سفید
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = rect.width * dpr;
  tempCanvas.height = rect.height * dpr;

  const tempCtx = tempCanvas.getContext('2d');

  // ۱) پس‌زمینه سفید
  tempCtx.fillStyle = SIGNATURE_BG;
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  // ۲) خط راهنما (شبیه دفتر)
  tempCtx.strokeStyle = 'rgba(217, 119, 6, 0.12)';
  tempCtx.lineWidth = 1 * dpr;
  tempCtx.beginPath();
  const lineY = (rect.height - 42) * dpr;
  tempCtx.moveTo(30 * dpr, lineY);
  tempCtx.lineTo((rect.width - 30) * dpr, lineY);
  tempCtx.stroke();

  // ۳) کپی کردن امضا روی پس‌زمینه سفید
  tempCtx.drawImage(canvas, 0, 0);

  return tempCanvas.toDataURL('image/png');
}

document.getElementById('clearSig').addEventListener('click', () => {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  hasSignature = false;
  placeholder.classList.remove('hide');
});

/* ============================================
   ۷) اعتبارسنجی و ارسال
   ============================================ */
function markError(id, state) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('error', state);
}

function validateForm() {
  let ok = true;
  const errors = [];

  const fullName = fullNameInput.value.trim();
  const nationalId = document.getElementById('nationalId').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const amount = amountInput.value.trim();
  const startDate = startDateInput.value.trim();
  const endDate = endDateInput.value.trim();
  const agree = document.getElementById('agreeCheck').checked;

  if (fullName.length < 3) {
    markError('fullName', true);
    errors.push('نام و نام خانوادگی را کامل وارد کنید.');
    ok = false;
  } else markError('fullName', false);

  if (!/^\d{10}$/.test(nationalId)) {
    markError('nationalId', true);
    errors.push('کد ملی باید ۱۰ رقم عددی باشد.');
    ok = false;
  } else markError('nationalId', false);

  if (!/^09\d{9}$/.test(phone)) {
    markError('phone', true);
    errors.push('شماره تماس باید با ۰۹ شروع شده و ۱۱ رقم باشد.');
    ok = false;
  } else markError('phone', false);

  if (!amount || parseInt(amount.replace(/\D/g, ''), 10) < 1000) {
    markError('amount', true);
    errors.push('مبلغ قرارداد را به‌درستی وارد کنید.');
    ok = false;
  } else markError('amount', false);

  if (!startDate) {
    markError('startDate', true);
    errors.push('تاریخ شروع قرارداد را انتخاب کنید.');
    ok = false;
  } else markError('startDate', false);

  if (!endDate) {
    markError('endDate', true);
    errors.push('تاریخ پایان قرارداد را انتخاب کنید.');
    ok = false;
  } else markError('endDate', false);

  if (!hasSignature) {
    errors.push('لطفاً امضای دیجیتال خود را در کادر مربوطه ثبت کنید.');
    sigWrap.style.borderColor = '#ff4d4d';
    sigWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ok = false;
  } else {
    sigWrap.style.borderColor = '';
  }

  if (!agree) {
    errors.push('برای ثبت، باید مفاد قرارداد را بپذیرید.');
    ok = false;
  }

  return { ok, errors };
}

const form = document.getElementById('contractForm');
const submitBtn = document.getElementById('submitBtn');
const successModal = document.getElementById('successModal');
const errorModal = document.getElementById('errorModal');
const errorText = document.getElementById('errorText');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const { ok, errors } = validateForm();
  if (!ok) { showError(errors[0]); return; }

  /* 🎨 امضا با پس‌زمینه سفید */
  const signatureData = getSignatureWithWhiteBg();
  const amountRaw = parseInt(amountInput.value.replace(/\D/g, ''), 10);

  const payload = {
    fullName: fullNameInput.value.trim(),
    nationalId: document.getElementById('nationalId').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim(),
    address: document.getElementById('address').value.trim(),
    amount: amountRaw,
    amountFormatted: formatNumber(amountRaw),
    amountInWords: numberToPersianWords(amountRaw),
    contractDate: contractDateDisplay.textContent,
    startDate: startDateInput.value,
    endDate: endDateInput.value,
    signature: signatureData,
    userAgent: navigator.userAgent,
    submittedAt: new Date().toISOString()
  };

  submitBtn.classList.add('loading');
  submitBtn.disabled = true;

  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(txt || 'ارسال ناموفق');
    }

    successModal.classList.add('show');
    form.reset();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSignature = false;
    placeholder.classList.remove('hide');

    customerNameInContract.textContent = 'علی رضایی';
    amountInContract.textContent = '6,000,000 تومان';
    amountInWords.textContent = numberToPersianWords(6000000) + ' تومان';
    amountInput.value = '6,000,000';
    startDateInput.value = formatJalali(tjy, tjm, tjd);
    endDateInput.value = formatJalali(njy, njm, njd);
    startDateDisplay.textContent = formatJalali(tjy, tjm, tjd);
    endDateDisplay.textContent = formatJalali(njy, njm, njd);

    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error(err);
    showError('ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت خود را بررسی کرده و دوباره تلاش کنید.');
  } finally {
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  }
});

function showError(msg) {
  errorText.textContent = msg;
  errorModal.classList.add('show');
}

document.getElementById('closeModal').addEventListener('click', () => successModal.classList.remove('show'));
document.getElementById('closeErrorModal').addEventListener('click', () => errorModal.classList.remove('show'));

[successModal, errorModal].forEach((m) => {
  m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('show'); });
});

['nationalId', 'phone'].forEach((id) => {
  document.getElementById(id).addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '');
  });
});