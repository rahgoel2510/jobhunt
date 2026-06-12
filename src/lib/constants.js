export const STATUSES = [
  'Applied', 'HR Called', 'Screening Done',
  'Interview Scheduled', 'Interview In Progress',
  'Offer Received', 'Accepted', 'Rejected', 'Withdrawn', 'Ghosted'
]

export const SOURCES = ['Cold Application', 'Referral', 'Recruiter Outreach', 'Network/Warm Intro']

export const INTERVIEW_MEDIUMS = ['Microsoft Teams', 'Zoom', 'Google Meet', 'Phone', 'In-Person', 'Custom']

export const ROUND_TYPES = ['HR Screen', 'Technical', 'System Design', 'Behavioral', 'Coding', 'Hiring Manager', 'Panel', 'Bar Raiser', 'Culture Fit', 'Final']

export const GHOSTED_ELIGIBLE = ['Applied', 'HR Called', 'Screening Done']
export const DEFAULT_GHOSTED_DAYS = 21

// Linear process stages for the progress tracker
export const PROCESS_STAGES = [
  { status: 'Applied', icon: '📨', label: 'Applied' },
  { status: 'HR Called', icon: '📞', label: 'HR Call' },
  { status: 'Screening Done', icon: '✅', label: 'Screening' },
  { status: 'Interview Scheduled', icon: '📅', label: 'Interviews' },
  { status: 'Interview In Progress', icon: '🎯', label: 'Interviews' },
  { status: 'Offer Received', icon: '🎉', label: 'Offer' },
  { status: 'Accepted', icon: '🏆', label: 'Accepted' },
]

export function getGlassdoorUrl(company, role) {
  const q = encodeURIComponent(`${company} ${role} salary`)
  return `https://www.glassdoor.co.in/Salaries/index.htm?typedKeyword=${q}`
}
