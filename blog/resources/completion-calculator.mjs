// All calculations stay in this page. No storage, requests or app integration.
export function completionSummary(planned, completed, missed) {
  const counts = [planned, completed, missed];
  if (counts.some(value => !Number.isSafeInteger(value) || value < 0 || value > 100000)) {
    throw new Error('Use whole numbers from 0 to 100,000 for all three counts.');
  }
  if (completed + missed > planned) {
    throw new Error('Completed plus missed must fit within scheduled opportunities.');
  }
  const unknown = planned - completed - missed;
  return {
    planned, completed, missed, unknown,
    confirmedPercent: planned ? 100 * completed / planned : null,
    possiblePercent: planned ? 100 * (completed + unknown) / planned : null,
    coveragePercent: planned ? 100 * (completed + missed) / planned : null,
  };
}

export function describeCompletion(result) {
  if (!result.planned) return 'No opportunities are due, so there is no completion rate for this period.';
  const percent = value => `${Number(value.toFixed(1))}%`;
  const unknown = `${result.unknown} unknown ${result.unknown === 1 ? 'opportunity' : 'opportunities'}`;
  const range = result.unknown
    ? `Possible completion after resolving unknowns: ${percent(result.confirmedPercent)} to ${percent(result.possiblePercent)}.`
    : `All records are known. Completion: ${percent(result.confirmedPercent)}.`;
  return `${result.completed} of ${result.planned} opportunities confirmed complete (${percent(result.confirmedPercent)}). ${result.missed} confirmed missed; ${unknown}. ${range} Record coverage: ${percent(result.coveragePercent)}.`;
}

if (typeof document !== 'undefined') {
  const form = document.getElementById('completion-form');
  if (form) {
    const inputs = ['completion-planned', 'completion-done', 'completion-missed'].map(id => document.getElementById(id));
    const status = document.getElementById('completion-status');
    const calculate = () => {
      try {
        if (inputs.some(input => !input.value.trim())) throw new Error('Enter all three counts, using 0 when appropriate.');
        status.textContent = describeCompletion(completionSummary(...inputs.map(input => Number(input.value))));
      } catch (error) {
        status.textContent = error.message;
      }
    };
    form.hidden = false;
    form.addEventListener('submit', event => { event.preventDefault(); calculate(); });
    form.addEventListener('input', () => { status.textContent = 'Counts changed. Select Calculate completion to update the result.'; });
    calculate();
  }
}
