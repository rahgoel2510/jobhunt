export const STATUSES = [
  'Wishlist', 'Applied', 'Referred', 'Recruiter Screen Scheduled',
  'Recruiter Screen Done', 'Interview Scheduled', 'Interview In Progress',
  'Offer', 'Offer Negotiation', 'Accepted', 'Rejected', 'Withdrawn', 'Ghosted'
]

export const SOURCES = ['Cold Application', 'Referral', 'Recruiter Outreach', 'Network/Warm Intro']

// For ghosted detection: statuses that indicate "waiting for response"
export const GHOSTED_ELIGIBLE = ['Applied', 'Referred', 'Recruiter Screen Scheduled']

export const DEFAULT_GHOSTED_DAYS = 21

// Map old statuses to new enum values
export const STATUS_MIGRATION_MAP = {
  applied: 'Applied',
  screening: 'Recruiter Screen Scheduled',
  interview: 'Interview Scheduled',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  referred: 'Referred',
}
