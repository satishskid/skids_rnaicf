import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Class name utility — compatible with shadcn/ui components */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
