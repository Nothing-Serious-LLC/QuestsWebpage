const FIELDS = ['action', 'cue', 'checkin', 'support', 'fallback', 'celebration'];
const LABELS = ['Daily action', 'Cue and place', 'Check-in', 'Support', 'Difficult-day plan', 'Review and celebrate'];
const clean = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);

export function buildPlan(input) {
  const days = Number(input.days);
  if (![7, 14, 30].includes(days)) throw new Error('Choose a 7-, 14-, or 30-day plan.');
  const fields = FIELDS.map((key, i) => ({ label: LABELS[i], value: clean(input[key]) }));
  if (fields.some(field => !field.value)) throw new Error('Fill in each part of your plan before building it.');
  let start = null;
  if (input.start) {
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(input.start) || input.start > '2099-12-01') throw new Error('Choose a valid start date between 2000 and December 1, 2099.');
    start = new Date(`${input.start}T12:00:00Z`);
    if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== input.start) throw new Error('Choose a valid start date.');
  }
  const checklist = Array.from({ length: days }, (_, i) => {
    const day = start ? new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10) : null;
    return { day: i + 1, date: day };
  });
  return { days, fields, checklist };
}

export function planText(plan) {
  return [`Quests: your ${plan.days}-day challenge plan`, ...plan.fields.map(field => `${field.label}: ${field.value}`), '', 'Daily checklist', ...plan.checklist.map(entry => `[ ] Day ${entry.day}${entry.date ? ` (${entry.date})` : ''}`), '', 'Agree with your group how to record a smaller action or a missed day. This plan is separate from the app\'s check-in, point, and streak rules.', 'Made at https://thequestsapp.com/blog/challenge-planner'].join('\n');
}

export function dateLabel(value) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}

if (typeof document !== 'undefined') {
  const form = document.getElementById('planner-form');
  if (form) {
    const result = document.getElementById('planner-result');
    const status = document.getElementById('planner-status');
    const actionStatus = document.getElementById('plan-action-status');
    let current;
    let dirty = false;
    function render(plan) {
      document.getElementById('plan-heading').textContent = `Your ${plan.days}-day challenge plan`;
      const first = plan.checklist[0].date;
      const last = plan.checklist.at(-1).date;
      document.getElementById('plan-range').textContent = first ? `${dateLabel(first)} to ${dateLabel(last)}` : `${plan.days} days, starting when you are ready.`;
      const details = document.getElementById('plan-details');
      details.replaceChildren(...plan.fields.flatMap(field => {
        const term = document.createElement('dt'); term.textContent = field.label;
        const value = document.createElement('dd'); value.textContent = field.value;
        return [term, value];
      }));
      document.getElementById('plan-checklist').replaceChildren(...plan.checklist.map(entry => {
        const li = document.createElement('li');
        li.textContent = `□ Day ${entry.day}${entry.date ? ` · ${dateLabel(entry.date)}` : ''}`;
        return li;
      }));
      document.getElementById('plan-text').value = planText(plan);
      document.getElementById('plan-text').hidden = true;
      document.getElementById('plan-text-label').hidden = true;
      actionStatus.textContent = '';
      current = plan;
      dirty = false;
      document.querySelectorAll('#plan-actions button').forEach(button => { button.disabled = false; });
    }
    form.addEventListener('input', () => {
      dirty = true;
      status.textContent = 'You have changes. Build your plan to update the preview and exports.';
      actionStatus.textContent = '';
      document.querySelectorAll('#plan-actions button').forEach(button => { button.disabled = true; });
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      try {
        render(buildPlan(Object.fromEntries(new FormData(form))));
        status.textContent = 'Your plan is ready to copy, download, or print.';
        result.focus();
      } catch (error) { status.textContent = error.message; }
    });
    document.getElementById('copy-plan').addEventListener('click', async () => {
      if (dirty) return;
      try { await navigator.clipboard.writeText(planText(current)); actionStatus.textContent = 'Plan copied. Paste it wherever you want to share it.'; }
      catch {
        const text = document.getElementById('plan-text'); text.hidden = false;
        document.getElementById('plan-text-label').hidden = false;
        text.focus(); text.select(); actionStatus.textContent = 'Select and copy the plan text below.';
      }
    });
    document.getElementById('download-plan').addEventListener('click', () => {
      if (dirty) return;
      const url = URL.createObjectURL(new Blob([planText(current)], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'quests-challenge-plan.txt';
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      actionStatus.textContent = 'Your text download is ready.';
    });
    document.getElementById('print-plan').addEventListener('click', () => { if (!dirty) window.print(); });
    render(buildPlan(Object.fromEntries(new FormData(form))));
    form.hidden = false;
    document.getElementById('plan-actions').hidden = false;
  }
}
