import type { HTMLAttributes } from 'react';

type SymposiaLogoProps = HTMLAttributes<HTMLDivElement> & {
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'light';
};

const sizeClasses = {
  sm: {
    gap: 'gap-2',
    mark: 'h-7 w-7 rounded-lg',
    wordmark: 'text-sm',
  },
  md: {
    gap: 'gap-3',
    mark: 'h-8 w-8 rounded-xl',
    wordmark: 'text-lg',
  },
  lg: {
    gap: 'gap-3',
    mark: 'h-9 w-9 rounded-xl',
    wordmark: 'text-xl',
  },
};

export function SymposiaLogo({
  size = 'md',
  tone = 'default',
  className = '',
  ...props
}: SymposiaLogoProps) {
  const classes = sizeClasses[size];
  const wordmarkColor = tone === 'light' ? 'text-white' : 'text-slate-900';

  return (
    <div
      {...props}
      role="img"
      aria-label="Symposia"
      className={`flex shrink-0 items-center ${classes.gap} ${className}`.trim()}
    >
      <img
        src="/favicon.svg"
        alt=""
        aria-hidden="true"
        className={`shrink-0 ${classes.mark}`}
      />
      <span className={`font-bold tracking-tight leading-none ${wordmarkColor} ${classes.wordmark}`}>
        symposia
      </span>
    </div>
  );
}
