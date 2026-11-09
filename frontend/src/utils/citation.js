export const PUBLICATION_TYPES = [
  { value: 'JOURNAL', label: 'Journal', hint: 'Paper in a journal' },
  { value: 'CONFERENCE', label: 'Conference', hint: 'Paper in proceedings' },
  { value: 'BOOK_CHAPTER', label: 'Book chapter', hint: 'Chapter in a book' },
  { value: 'BOOK', label: 'Book', hint: 'A complete book' },
]

export const TYPE_LABELS = Object.fromEntries(PUBLICATION_TYPES.map((t) => [t.value, t.label]))

export const VENUE_LABELS = {
  JOURNAL: 'Journal name',
  CONFERENCE: 'Conference name',
  BOOK_CHAPTER: 'Book title',
}

const MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.']
const DOI_RE = /10\.\d{4,9}\/\S+/

export function doiLooksValid(value) {
  return DOI_RE.test(String(value || ''))
}

// "https://doi.org/10.1109/X.1" or "10.1109/X.1" -> "10.1109/X.1"
export function bareDoi(value) {
  const match = String(value || '').match(DOI_RE)
  return match ? match[0].replace(/[.,;]+$/, '') : ''
}

// Always stored as a full link so it is clickable on the detail page.
export function normalizeDoi(value) {
  const doi = bareDoi(value)
  return doi ? `https://doi.org/${doi}` : ''
}

// IEEE style: "A", "A and B", "A, B, and C"
export function formatAuthors(authors = []) {
  const list = authors.map((a) => String(a).trim()).filter(Boolean)
  if (list.length <= 1) return list[0] || ''
  if (list.length === 2) return `${list[0]} and ${list[1]}`
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`
}

function monthYear(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

const clean = (parts) => parts.map((p) => String(p ?? '').trim()).filter(Boolean)

const pagesText = (pages) => {
  const text = String(pages || '').trim()
  return text ? `pp. ${text.replace(/\s*-\s*/g, '–')}` : ''
}

function volumeIssue(volume, issue) {
  const v = String(volume || '').trim()
  const i = String(issue || '').trim()
  if (v && i) return `${v}(${i})`
  if (v) return `vol. ${v}`
  if (i) return `no. ${i}`
  return ''
}

// Builds the one-line reference used in the monthly progress report.
// Change the layout of any type here and the form and detail page follow.
export function buildCitation(p = {}) {
  const title = String(p.title || '').trim()
  const authors = formatAuthors(p.authors)
  if (!title || !authors) return ''

  const doi = bareDoi(p.doi)
  const doiText = doi ? `doi: ${doi}` : ''
  const year = p.publicationYear || ''

  if (p.publicationType === 'BOOK') {
    const parts = clean([
      authors,
      title,
      p.edition ? `${String(p.edition).trim()} ed.` : '',
      p.publisher,
      year,
      p.isbn ? `ISBN: ${String(p.isbn).trim()}` : '',
      doiText,
    ])
    return `${parts.join(', ')}.`
  }

  let tail
  if (p.publicationType === 'CONFERENCE') {
    tail = [
      p.venueName ? `in ${p.venueName}` : '',
      p.conferenceVenue,
      monthYear(p.conferenceStartDate) || year,
      pagesText(p.pages),
      doiText,
    ]
  } else if (p.publicationType === 'BOOK_CHAPTER') {
    tail = [
      p.venueName ? `in ${p.venueName}` : '',
      p.editors ? `${String(p.editors).trim()} (Eds.)` : '',
      p.publisher,
      year,
      pagesText(p.pages),
      p.isbn ? `ISBN: ${String(p.isbn).trim()}` : '',
      doiText,
    ]
  } else {
    // JOURNAL
    tail = [p.venueName, volumeIssue(p.volume, p.issue), pagesText(p.pages), year, doiText]
  }

  const body = clean(tail).join(', ')
  return body ? `${authors}, “${title},” ${body}.` : `${authors}, “${title}.”`
}