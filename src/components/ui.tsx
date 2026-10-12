import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'outline' | 'ghost' | 'good' | 'bad';

export function Button({
  variant = 'outline',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-primary text-primary-fg hover:opacity-90 border-transparent',
    outline: 'bg-card hover:bg-muted border-border',
    ghost: 'border-transparent hover:bg-muted',
    good: 'bg-good-bg text-good border-transparent hover:opacity-85',
    bad: 'bg-bad-bg text-bad border-transparent hover:opacity-85',
  };
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        styles[variant],
        className,
      )}
      {...rest}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-xl border border-border bg-card shadow-sm', className)}>{children}</div>;
}

type Tone = 'neutral' | 'good' | 'bad' | 'warn' | 'primary';
export function Badge({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  const t: Record<Tone, string> = {
    neutral: 'bg-muted text-muted-fg',
    good: 'bg-good-bg text-good',
    bad: 'bg-bad-bg text-bad',
    warn: 'bg-warn-bg text-warn',
    primary: 'bg-primary/15 text-primary',
  };
  return (
    <span title={title} className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', t[tone])}>
      {children}
    </span>
  );
}

export function Bar({ value, tone = 'primary' }: { value: number; tone?: 'primary' | 'good' | 'bad' | 'warn' }) {
  const color = { primary: 'bg-primary', good: 'bg-good', bad: 'bg-bad', warn: 'bg-warn' }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={cx('h-full rounded-full', color)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export const fmt = (x: number, d = 2) => x.toFixed(d);
