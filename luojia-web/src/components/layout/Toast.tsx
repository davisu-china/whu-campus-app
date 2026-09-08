import { useEffect } from 'react'
import { useToastStore } from '../../store/toast'

export function Toast() {
  const message = useToastStore((s) => s.message)
  const clear = useToastStore((s) => s.clear)

  useEffect(() => {
    if (!message) return
    const t = setTimeout(clear, 2200)
    return () => clearTimeout(t)
  }, [message, clear])

  if (!message) return null
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
      <div className="px-4 py-2 rounded-lg bg-ink text-white text-sm shadow-pop animate-toast-in">
        {message}
      </div>
    </div>
  )
}
