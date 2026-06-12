import { useState } from 'react'
import { getLogoUrl, getFallbackUrl } from '../../lib/logo'

export default function CompanyLogo({ company, size = 32 }) {
  const [failed, setFailed] = useState(false)
  const logoUrl = getLogoUrl(company)
  const fallback = getFallbackUrl(company)

  if (!company) return null

  const src = (!failed && logoUrl) ? logoUrl : fallback

  return (
    <img
      src={src}
      alt={company}
      width={size}
      height={size}
      className="rounded-md object-contain shrink-0"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
    />
  )
}
