import { useState } from 'react'

export default function Tooltip({ text, children }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-md bg-gray-900 text-white text-xs font-normal normal-case tracking-normal whitespace-nowrap shadow-lg z-50 animate-[fadeIn_0.1s_ease]">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>}
    </span>
  )
}

export function HelpDot({ text }) {
  return (
    <Tooltip text={text}>
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted/20 text-muted text-[10px] font-bold cursor-help ml-1 hover:bg-accent/20 hover:text-accent transition-colors">?</span>
    </Tooltip>
  )
}
