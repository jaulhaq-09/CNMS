// Ordered steps for the Monthly Progress Report wizard — one step per
// report section, in the exact order the MPR document lists them.
//
// type: 'simple'      → description + up to 3 photos, or mark NIL
//       'publication'  → full PublicationForm (authors, indexing, DOI...)
//       'patent'       → full patent fields (inventors, grant status...)

export const REPORT_WIZARD_STEPS = [
  { category: 'MOU', label: 'Memorandum of Understanding', type: 'simple' },
  { category: 'STUDENT_ACHIEVEMENT', label: 'Students Achievements', type: 'simple' },
  { category: 'PROFESSIONAL_ACTIVITY', label: 'Professional Activities', type: 'simple' },
  { category: 'WORKSHOP_ORGANIZED', label: 'Student Workshops / Events Conducted / Organised', type: 'simple' },
  { category: 'INDUSTRIAL_VISIT', label: 'Industrial Visit', type: 'simple' },
  { category: 'FACULTY_AWARD', label: 'Faculty Awards', type: 'simple' },
  { category: 'RESOURCE_PERSON', label: 'Faculty as a Resource Person', type: 'simple' },
  { category: 'FDP_ORGANIZED', label: 'FDP Organized', type: 'simple' },
  { category: 'COLLABORATIVE_RESEARCH', label: 'Collaborative Research', type: 'simple' },
  { category: 'PUBLICATION', label: 'International Journal / Conference / Book Chapter / Book Publications', type: 'publication' },
  { category: 'PATENT', label: 'Patent Published / Granted', type: 'patent' },
  { category: 'BICEP_ACTIVITY', label: 'BICEP Activities', type: 'simple' },
  { category: 'ALUMNI_INTERACTION', label: 'Alumni Interaction', type: 'simple' },
  { category: 'CLUB_ACTIVITY', label: 'Club Activities', type: 'simple' },
  { category: 'NSS', label: 'NSS Events', type: 'simple' },
  { category: 'NCC', label: 'NCC Activities', type: 'simple' },
  { category: 'SPORTS', label: 'Sports Events', type: 'simple' },
  { category: 'PLACEMENT_ACTIVITY', label: 'Placement Activities', type: 'simple' },
  { category: 'HEC_EVENT', label: 'HEC Events', type: 'simple' },
]