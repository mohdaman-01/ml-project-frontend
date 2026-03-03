/* ================================================================
   JobGuardAI — Frontend Logic v2 (Netlify Deploy)
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
const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');

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
    $('error-msg').textContent = msg;
    $('error-suggestion').textContent = suggestion || '';
    show('error-box');
}

// ── Analyze URL ────────────────────────────────────────
async function analyzeURL() {
    const url = $('url-input').value.trim();
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
        showError('Cannot reach the API. The Hugging Face Space may be sleeping — try again in 30 seconds.', err.message);
    }
    setLoading(false);
}

// ── Analyze Text ───────────────────────────────────────
async function analyzeText() {
    const title = $('field-title').value.trim();
    const description = $('field-description').value.trim();

    if (!title && !description) {
        return showError('Please fill in at least the job title or description.');
    }

    const payload = {
        mode: 'text',
        title,
        company_profile: $('field-company').value.trim(),
        description,
        requirements: $('field-requirements').value.trim(),
        benefits: $('field-benefits').value.trim(),
        telecommuting: $('toggle-telecommuting').checked ? 1 : 0,
        has_company_logo: $('toggle-logo').checked ? 1 : 0,
        has_questions: $('toggle-questions').checked ? 1 : 0,
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
        showError('Cannot reach the API. The Hugging Face Space may be sleeping — try again in 30 seconds.', err.message);
    }
    setLoading(false);
}

// ── Render results ─────────────────────────────────────
function renderResults(data) {
    hide('error-box');

    // Verdict
    const vc = $('verdict-card');
    vc.classList.remove('legit', 'fraud');
    const isLegit = data.verdict === 'Legit';
    vc.classList.add(isLegit ? 'legit' : 'fraud');
    $('verdict-text').textContent = isLegit ? 'LEGIT' : 'FRAUDULENT';
    $('confidence-text').textContent =
        `Model confidence: ${(data.confidence * 100).toFixed(1)}%`;

    // Gauge
    animateGauge(data.risk_score);

    // Job details
    const jd = data.job_details || {};
    $('detail-title').textContent = jd.title || 'N/A';
    $('detail-company').textContent = jd.company || 'N/A';
    $('detail-description').textContent = jd.description || 'N/A';

    // Flags
    const redFlags = data.red_flags || [];
    const greenFlags = data.green_flags || [];

    $('red-count').textContent = redFlags.length;
    $('green-count').textContent = greenFlags.length;

    renderFlags('red-flags-list', redFlags, 'red');
    renderFlags('green-flags-list', greenFlags, 'green');

    show('results');

    // Smooth scroll to results
    setTimeout(() => {
        $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

function renderFlags(containerId, flags, type) {
    const el = $(containerId);
    if (flags.length === 0) {
        el.innerHTML = `<div class="no-flags">No ${type === 'red' ? 'red' : 'green'} flags detected</div>`;
        return;
    }
    el.innerHTML = flags.map((f, i) => `
        <div class="flag-card ${type}" style="animation-delay: ${i * 0.07}s">
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
    const fill = $('gauge-fill');
    const valueEl = $('gauge-value');
    const totalLen = 251.2;

    // Dynamic color: green → amber → red
    let color;
    if (score < 25) color = '#34d399';
    else if (score < 50) color = '#fbbf24';
    else if (score < 75) color = '#f97316';
    else color = '#f87171';

    fill.style.stroke = color;
    valueEl.style.color = color;

    // Animate arc
    const targetOffset = totalLen - (score / 100) * totalLen;
    fill.style.strokeDashoffset = targetOffset;

    // Animate number with easing
    const duration = 1200;
    const start = performance.now();

    function update(now) {
        const elapsed = Math.min(now - start, duration);
        const progress = elapsed / duration;
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * score);
        valueEl.textContent = current;
        if (elapsed < duration) requestAnimationFrame(update);
        else valueEl.textContent = Math.round(score);
    }
    requestAnimationFrame(update);
}

// ── Enter key triggers analyze ─────────────────────────
$('url-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') analyzeURL();
});
