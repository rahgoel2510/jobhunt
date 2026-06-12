export const STATUSES = [
  'Wishlist', 'Applied', 'Recruiter Screen Scheduled', 'Recruiter Screen Done',
  'Interview Scheduled', 'Interview In Progress',
  'Offer', 'Offer Negotiation', 'Accepted', 'Rejected', 'Withdrawn', 'Ghosted'
]

export const SOURCES = ['Cold Application', 'Referral', 'Recruiter Outreach', 'Network/Warm Intro']

export const INTERVIEW_MEDIUMS = ['Microsoft Teams', 'Zoom', 'Google Meet', 'Phone', 'In-Person', 'Custom']

export const ROUND_TYPES = ['Recruiter Screen', 'Technical', 'System Design', 'Behavioral', 'Coding', 'Hiring Manager', 'Panel', 'Bar Raiser', 'Culture Fit', 'Final']

export const GHOSTED_ELIGIBLE = ['Applied', 'Recruiter Screen Scheduled']
export const DEFAULT_GHOSTED_DAYS = 21

export const PROCESS_STAGES = [
  { status: 'Wishlist', icon: '⭐', label: 'Wishlist' },
  { status: 'Applied', icon: '📨', label: 'Applied' },
  { status: 'Recruiter Screen Scheduled', icon: '📞', label: 'Screen' },
  { status: 'Recruiter Screen Done', icon: '✅', label: 'Screened' },
  { status: 'Interview Scheduled', icon: '📅', label: 'Interview' },
  { status: 'Interview In Progress', icon: '🎯', label: 'Looping' },
  { status: 'Offer', icon: '🎉', label: 'Offer' },
  { status: 'Accepted', icon: '🏆', label: 'Accepted' },
]

export function getGlassdoorUrl(company, role) {
  const q = encodeURIComponent(`${company} ${role} salary`)
  return `https://www.glassdoor.co.in/Salaries/index.htm?typedKeyword=${q}`
}

export function getLevelsFyiUrl(company, role) {
  return `https://www.levels.fyi/t/${encodeURIComponent(role)}?company=${encodeURIComponent(company)}`
}
