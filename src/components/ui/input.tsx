import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        aria-invalid={Boolean(error)}
        className={cn(
          'flex h-11 w-full rounded-md border border-[#3f2319] bg-[#140d0a] px-3.5 py-2 text-sm text-[#f5f1eb] placeholder:text-[#b39463]/70 focus-visible:outline-2 focus-visible:outline-[#e89b55] focus-visible:border-[#d28a4c] disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
          error && 'border-[#f0805f] focus-visible:outline-[#f0805f]',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
