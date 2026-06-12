// Tries to fetch company logo via Clearbit (free, no API key)
// Falls back to Google favicon service + DiceBear initials
export function getLogoUrl(company) {
  if (!company) return null
  const domain = guessDomain(company)
  if (domain) return `https://logo.clearbit.com/${domain}`
  return null
}

export function getFallbackUrl(company) {
  if (!company) return null
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(company)}&background=6366f1&color=fff&size=64&font-size=0.4&bold=true`
}

function guessDomain(company) {
  const clean = company.toLowerCase().trim()
    .replace(/\s*(inc|corp|ltd|llc|co|company|technologies|tech|software|systems|group|labs|io)\.?\s*$/i, '')
    .replace(/[^a-z0-9]/g, '')
  if (!clean) return null
  return `${clean}.com`
}
