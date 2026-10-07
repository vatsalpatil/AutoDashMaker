import { LogoIcon } from '@/components/common/LogoIcon';
import { greeting, todayLabel } from './recent';

/** The big headline: greeting in display type, a line about what is on this page, and the logo mark as a watermark. */
export function HomeHeader({ hasData }: { hasData: boolean }) {
  return (
    <header className="relative overflow-hidden rounded-2xl border bg-card px-6 py-6 shadow-xs sm:px-8 sm:py-8">
      <LogoIcon className="pointer-events-none absolute -right-4 -top-6 hidden size-44 opacity-[0.14] md:block" />
      <p className="text-sm font-medium text-muted-foreground">{todayLabel()}</p>
      <h1 className="mt-1 bg-linear-to-r from-foreground to-primary bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
        {greeting()}.
      </h1>
      <p className="mt-2 max-w-xl text-base text-muted-foreground">
        {hasData ? 'Here is where your data stands today. Ask a question, or pick up where you left off.' : "Let's get your first dataset in, then you can ask it anything."}
      </p>
    </header>
  );
}
