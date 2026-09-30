// =============================================
//  CreditGuard AI — Frontend Logic
// =============================================

const form       = document.getElementById('loanForm');
const submitBtn  = document.getElementById('submitBtn');
const clearBtn   = document.getElementById('clearBtn');
const resultSection = document.getElementById('resultSection');
const resultCard    = document.getElementById('resultCard');
const toast      = document.getElementById('toast');

// ---- Live Loan-to-Income Ratio Calculation ----
function calcLoanPercentIncome() {
  const income  = parseFloat(document.getElementById('person_income').value);
  const loanAmt = parseFloat(document.getElementById('loan_amnt').value);
  const display = document.getElementById('lpiDisplay');
  const valEl   = document.getElementById('lpiValue');

  if (income > 0 && loanAmt >= 0) {
    const ratio = loanAmt / income;
    valEl.textContent = ratio.toFixed(4) + `  (${(ratio * 100).toFixed(1)}%)`;
    display.classList.add('has-value');
  } else {
    valEl.textContent = 'Auto-calculated';
    display.classList.remove('has-value');
  }
}

document.getElementById('person_income').addEventListener('input', calcLoanPercentIncome);
document.getElementById('loan_amnt').addEventListener('input', calcLoanPercentIncome);

// ---- Toast Notification ----
function showToast(message, type = 'info', duration = 3500) {
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = 'toast'; }, duration);
}

// ---- Form Validation ----
function validateForm() {
  let valid = true;
  const fields = form.querySelectorAll('input, select');
  fields.forEach(field => {
    field.classList.remove('invalid');
    if (!field.value || field.value.trim() === '') {
      field.classList.add('invalid');
      valid = false;
    }
  });
  return valid;
}

// ---- Clear Form ----
clearBtn.addEventListener('click', () => {
  form.reset();
  form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  // Reset auto-calc display
  document.getElementById('lpiValue').textContent = 'Auto-calculated';
  document.getElementById('lpiDisplay').classList.remove('has-value');
  resultSection.style.display = 'none';
  showToast('Form cleared.', 'info', 2000);
});

// Remove invalid class on input
form.querySelectorAll('input, select').forEach(field => {
  field.addEventListener('input', () => field.classList.remove('invalid'));
  field.addEventListener('change', () => field.classList.remove('invalid'));
});

// ---- Probability Bar Update ----
function updateProbBar(probability, threshold) {
  const fill      = document.getElementById('probBarFill');
  const threshBar = document.getElementById('probBarThreshold');
  const pct  = Math.min(100, Math.max(0, probability * 100)).toFixed(1);
  const tpct = Math.min(100, Math.max(0, threshold * 100)).toFixed(1);
  fill.style.width      = `${pct}%`;
  threshBar.style.left  = `${tpct}%`;
}

// ---- Gauge Update ----
function updateGauge(probability) {
  const arc = document.getElementById('gaugeArc');
  const val = document.querySelector('.gauge-value');
  if (!arc || !val) return;
  // Full arc length ~157; 0% → 157 offset (empty), 100% → 0 offset (full)
  const offset = 157 - (probability * 157);
  arc.style.strokeDashoffset = offset;
  val.textContent = `${(probability * 100).toFixed(1)}%`;
}

// ---- Render Result ----
function renderResult(data) {
  const isHigh = data.default_prediction === 1;

  // Card styling
  resultCard.className = `result-card ${isHigh ? 'high-risk' : 'low-risk'}`;

  // Icon
  document.getElementById('resultIcon').className = `result-icon ${isHigh ? 'high' : 'low'}`;
  document.getElementById('resultIcon').textContent = isHigh ? '⚠️' : '✅';

  // Title & subtitle
  document.getElementById('resultTitle').textContent = isHigh ? 'High Risk Applicant' : 'Low Risk Applicant';
  document.getElementById('resultSubtitle').textContent = isHigh
    ? 'This applicant is likely to default on the loan.'
    : 'This applicant is unlikely to default on the loan.';

  // Metrics
  const prob = (data.default_probability * 100).toFixed(2);
  document.getElementById('resProbability').textContent = `${prob}%`;
  document.getElementById('resProbability').style.color = isHigh ? 'var(--danger)' : 'var(--success)';

  document.getElementById('resResult').textContent = data.Result;
  document.getElementById('resResult').style.color = isHigh ? 'var(--danger)' : 'var(--success)';

  document.getElementById('resThreshold').textContent = `${(data.threshold * 100).toFixed(1)}%`;
  document.getElementById('resPrediction').textContent = data.default_prediction === 1 ? 'Default' : 'No Default';

  // Probability bar
  updateProbBar(data.default_probability, data.threshold);

  // Update hero gauge
  updateGauge(data.default_probability);

  // Show section
  resultSection.style.display = 'block';
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- Form Submit ----
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!validateForm()) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }

  // Gather data — loan_percent_income is auto-calculated
  const incomeVal  = parseFloat(document.getElementById('person_income').value);
  const loanAmtVal = parseFloat(document.getElementById('loan_amnt').value);

  const formData = {
    person_age               : parseInt(document.getElementById('person_age').value),
    person_income            : incomeVal,
    person_home_ownership    : document.getElementById('person_home_ownership').value,
    person_emp_length        : parseFloat(document.getElementById('person_emp_length').value),
    loan_intent              : document.getElementById('loan_intent').value,
    loan_grade               : document.getElementById('loan_grade').value,
    loan_amnt                : loanAmtVal,
    loan_int_rate            : parseFloat(document.getElementById('loan_int_rate').value),
    loan_percent_income      : parseFloat((loanAmtVal / incomeVal).toFixed(4)),
    cb_person_default_on_file: document.getElementById('cb_person_default_on_file').value,
    cb_person_cred_hist_length: parseInt(document.getElementById('cb_person_cred_hist_length').value),
  };

  // Loading state
  submitBtn.classList.add('loading');
  submitBtn.disabled = true;
  submitBtn.querySelector('.btn-text').textContent = 'Analyzing';
  submitBtn.querySelector('.btn-icon').style.display = 'none';

  try {
    const response = await fetch('/predict', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(formData),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Server error: ${response.status}`);
    }

    const data = await response.json();
    renderResult(data);
    showToast('Risk assessment complete!', 'success');

  } catch (error) {
    console.error('Prediction error:', error);
    showToast(`Error: ${error.message}`, 'error', 5000);
  } finally {
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').textContent = 'Analyze Risk';
    submitBtn.querySelector('.btn-icon').style.display = '';
  }
});
