import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

const sizeMap: Record<string, string> = {
  sm: "size-3",
  md: "size-4",
  lg: "size-8",
}

interface SpinnerProps extends Omit<React.ComponentProps<"svg">, "size"> {
  size?: "sm" | "md" | "lg"
}

function Spinner({ className, size = "md", ...props }: SpinnerProps) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn("animate-spin", sizeMap[size], className)}
      {...props}
    />
  )
}

export { Spinner }
