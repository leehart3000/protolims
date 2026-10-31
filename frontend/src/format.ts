export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// A date and time, as in "30 Oct 2026, 17:58".
export function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// A count with its noun, as in "1 assay" or "1,875 data files".
export function counted(count: number, one: string, many = `${one}s`) {
  return `${count.toLocaleString('en-GB')} ${count === 1 ? one : many}`
}

// How many of a subject's samples, as in "1 of this subject's samples" (for one, "this
// subject's sample" would suggest it has only one).
export function samplesOf(count: number) {
  return `${count.toLocaleString('en-GB')} of this subject's samples`
}
