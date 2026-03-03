/* ================================================================
   JobGuardAI — Frontend Logic v3 (Complete Overhaul)
   ================================================================ */

const API_BASE = "https://amanthegreat01-fake-job-detector.hf.space";

// ── Tab switching ──────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
});

// ── DOM shortcuts ──────────────────────────────────────
const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');

function setLoading(on) {
    if (on) {
        hide('results'); hide('error-box'); show('loading');
        document.querySelectorAll('.scan-btn').forEach(b => b.disabled = true);
    } else {
        hide('loading');
        document.querySelectorAll('.scan-btn').forEach(b => b.disabled = false);
    }
}

function showError(msg, sub) {
    $('error-msg').textContent = msg;
    $('error-suggestion').textContent = sub || '';
    show('error-box');
}

// ── Analyze URL ────────────────────────────────────────
async function analyzeURL() {
    const url = $('url-input').value.trim();
    if (!url) return showError('Please paste a LinkedIn job URL first.');

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
        renderReport(data);
    } catch (err) {
        showError(
            'Cannot reach the API server.',
            'The Hugging Face Space may be sleeping — wait 30s and try again.'
        );
    }
    setLoading(false);
}

// ── Analyze Text ───────────────────────────────────────
async function analyzeText() {
    const title = $('field-title').value.trim();
    const description = $('field-description').value.trim();
    if (!title && !description) return showError('Enter at least a job title or description.');

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
        renderReport(data);
    } catch (err) {
        showError(
            'Cannot reach the API server.',
            'The Hugging Face Space may be sleeping — wait 30s and try again.'
        );
    }
    setLoading(false);
}

// ── Render Report ──────────────────────────────────────
function renderReport(data) {
    hide('error-box');
    const isLegit = data.verdict === 'Legit';
    const score = data.risk_score;
    const redFlags = data.red_flags || [];
    const greenFlags = data.green_flags || [];

    // Verdict badge
    const badge = $('verdict-badge');
    badge.className = 'verdict-badge ' + (isLegit ? 'legit' : 'fraud');
    badge.textContent = isLegit ? 'LEGIT' : 'FRAUDULENT';

    // Circular gauge
    animateCircularGauge(score);

    // Stats
    $('stat-conf-val').textContent = (data.confidence * 100).toFixed(1) + '%';
    $('stat-red-val').textContent = redFlags.length;
    $('stat-green-val').textContent = greenFlags.length;
    const sv = $('stat-verdict-val');
    sv.textContent = isLegit ? 'Safe' : 'Danger';
    sv.style.color = isLegit ? 'var(--green-2)' : 'var(--red-2)';

    // Details
    const jd = data.job_details || {};
    $('detail-title').textContent = jd.title || 'N/A';
    $('detail-company').textContent = jd.company || 'N/A';
    $('detail-description').textContent = jd.description || 'N/A';

    // Flags
    $('red-count-badge').textContent = redFlags.length;
    $('green-count-badge').textContent = greenFlags.length;
    renderFlags('red-flags-list', redFlags, 'red');
    renderFlags('green-flags-list', greenFlags, 'green');

    show('results');
    setTimeout(() => {
        $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
}

function renderFlags(id, flags, type) {
    const el = $(id);
    if (!flags.length) {
        el.innerHTML = `<div class="no-flags">No ${type} flags detected</div>`;
        return;
    }
    el.innerHTML = flags.map((f, i) => `
        <div class="flag-card ${type}" style="animation-delay:${i * 0.06}s">
            <div class="flag-name">${esc(f.flag)}</div>
            <div class="flag-detail">${esc(f.detail)}</div>
        </div>
    `).join('');
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ── Circular Gauge Animation ───────────────────────────
function animateCircularGauge(score) {
    const fill = $('cg-fill');
    const numEl = $('cg-number');
    const circumference = 2 * Math.PI * 52; // r=52

    // Color mapping
    let color;
    if (score < 25) color = '#10b981';
    else if (score < 50) color = '#fbbf24';
    else if (score < 75) color = '#f59e0b';
    else color = '#ef4444';

    fill.style.stroke = color;
    numEl.style.color = color;

    // Animate arc
    const offset = circumference - (score / 100) * circumference;
    fill.style.strokeDasharray = circumference;
    fill.style.strokeDashoffset = offset;

    // Animate number
    const duration = 1400;
    const start = performance.now();
    (function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        numEl.textContent = Math.round(eased * score);
        if (t < 1) requestAnimationFrame(tick);
        else numEl.textContent = Math.round(score);
    })(start);
}

// ── Keyboard shortcut ──────────────────────────────────
$('url-input').addEventListener('keydown', e => { if (e.key === 'Enter') analyzeURL(); });
