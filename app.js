/* ================================================================
   Fake Job Detector — Frontend Logic (Netlify Deploy)
   ================================================================ */

// ┌─────────────────────────────────────────────────────────────────┐
// │  IMPORTANT: Replace this URL with your Hugging Face Space URL  │
// │  After deploying your HF Space, it will be something like:     │
// │  https://<your-username>-fake-job-detector.hf.space            │
// └─────────────────────────────────────────────────────────────────┘
const API_BASE = "https://amanthegreat01-fake-job-detector.hf.space";

// ── Mode toggle ────────────────────────────────────────
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.input-mode').forEach(m => m.classList.remove('active'));
        document.getElementById(btn.dataset.mode + '-mode').classList.add('active');
    });
});

// ── Helpers ────────────────────────────────────────────
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

function setLoading(on) {
    if (on) {
        hide('results');
        hide('error-box');
        show('loading');
        document.querySelectorAll('.analyze-btn').forEach(b => b.disabled = true);
    } else {
        hide('loading');
        document.querySelectorAll('.analyze-btn').forEach(b => b.disabled = false);
    }
}

function showError(msg, suggestion) {
    document.getElementById('error-msg').textContent = msg;
    document.getElementById('error-suggestion').textContent = suggestion || '';
    show('error-box');
}

// ── Analyze URL ────────────────────────────────────────
async function analyzeURL() {
    const url = document.getElementById('url-input').value.trim();
    if (!url) return showError('Please paste a LinkedIn URL first.');

    setLoading(true);
    try {
        const resp = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'url', url }),
        });
        const data = await resp.json();
        if (!resp.ok) {
            showError(data.error, data.suggestion || '');
            setLoading(false);
            return;
        }
        renderResults(data);
    } catch (err) {
        showError('Cannot reach the API. Is the Hugging Face Space running?', err.message);
    }
    setLoading(false);
}

// ── Analyze Text ───────────────────────────────────────
async function analyzeText() {
    const title = document.getElementById('field-title').value.trim();
    const description = document.getElementById('field-description').value.trim();

    if (!title && !description) {
        return showError('Please fill in at least the job title or description.');
    }

    const payload = {
        mode: 'text',
        title,
        company_profile: document.getElementById('field-company').value.trim(),
        description,
        requirements: document.getElementById('field-requirements').value.trim(),
        benefits: document.getElementById('field-benefits').value.trim(),
        telecommuting: document.getElementById('toggle-telecommuting').checked ? 1 : 0,
        has_company_logo: document.getElementById('toggle-logo').checked ? 1 : 0,
        has_questions: document.getElementById('toggle-questions').checked ? 1 : 0,
    };

    setLoading(true);
    try {
        const resp = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await resp.json();
        if (!resp.ok) {
            showError(data.error, data.suggestion || '');
            setLoading(false);
            return;
        }
        renderResults(data);
    } catch (err) {
        showError('Cannot reach the API. Is the Hugging Face Space running?', err.message);
    }
    setLoading(false);
}

// ── Render results ─────────────────────────────────────
function renderResults(data) {
    hide('error-box');

    // Verdict
    const vc = document.getElementById('verdict-card');
    vc.classList.remove('legit', 'fraud');
    vc.classList.add(data.verdict === 'Legit' ? 'legit' : 'fraud');
    document.getElementById('verdict-text').textContent = data.verdict === 'Legit' ? 'LEGIT' : 'FRAUDULENT';
    document.getElementById('confidence-text').textContent =
        `Model confidence: ${(data.confidence * 100).toFixed(1)}%`;

    // Gauge
    animateGauge(data.risk_score);

    // Job details
    const jd = data.job_details || {};
    document.getElementById('detail-title').textContent = jd.title || 'N/A';
    document.getElementById('detail-company').textContent = jd.company || 'N/A';
    document.getElementById('detail-description').textContent = jd.description || 'N/A';

    // Flags
    renderFlags('red-flags-list', data.red_flags || [], 'red');
    renderFlags('green-flags-list', data.green_flags || [], 'green');

    show('results');
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderFlags(containerId, flags, type) {
    const el = document.getElementById(containerId);
    if (flags.length === 0) {
        el.innerHTML = `<div class="no-flags">No ${type === 'red' ? 'red' : 'green'} flags detected</div>`;
        return;
    }
    el.innerHTML = flags.map((f, i) => `
        <div class="flag-card ${type}" style="animation-delay: ${i * 0.08}s">
            <div class="flag-name">${escapeHtml(f.flag)}</div>
            <div class="flag-detail">${escapeHtml(f.detail)}</div>
        </div>
    `).join('');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ── Gauge animation ────────────────────────────────────
function animateGauge(score) {
    const fill = document.getElementById('gauge-fill');
    const valueEl = document.getElementById('gauge-value');
    const totalLen = 251.2;

    let color;
    if (score < 30) color = '#00cec9';
    else if (score < 60) color = '#fdcb6e';
    else color = '#ff6b6b';

    fill.style.stroke = color;
    valueEl.style.color = color;

    const targetOffset = totalLen - (score / 100) * totalLen;
    fill.style.strokeDashoffset = targetOffset;

    let current = 0;
    const step = Math.max(1, Math.ceil(score / 60));
    const timer = setInterval(() => {
        current += step;
        if (current >= score) {
            current = score;
            clearInterval(timer);
        }
        valueEl.textContent = Math.round(current);
    }, 20);
}

// ── Enter key triggers analyze ─────────────────────────
document.getElementById('url-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') analyzeURL();
});
