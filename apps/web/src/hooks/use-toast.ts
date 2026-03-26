/**
 * Toast hook — thin wrapper around sonner for V3 compatibility.
 * Screening modules call useToast().toast({ title, description, variant })
 */
import { toast as sonnerToast } from 'sonner'

export interface ToastOptions {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
  duration?: number
}

function toast(opts: ToastOptions) {
  const message = opts.title || opts.description || ''
  const description = opts.title ? opts.description : undefined

  if (opts.variant === 'destructive') {
    sonnerToast.error(message, { description, duration: opts.duration })
  } else {
    sonnerToast(message, { description, duration: opts.duration })
  }
}

export function useToast() {
  return { toast }
}
