import { cn } from '../utils/cn'

interface BrandLogoProps {
  className?: string
  size?: number
}

export function BrandLogo({ className, size = 48 }: BrandLogoProps) {
  return <img src="./logo.ico" alt="INKIDEA logo" width={size} height={size} className={cn('rounded-sm object-contain', className)} />
}
