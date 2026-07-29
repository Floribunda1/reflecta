import type { ReactNode } from "react";
import { cn } from "../src/lib/utils";

export function StoryShowcase({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto grid w-full max-w-[1440px] gap-6">
      <header className="grid max-w-3xl gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </header>
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">{children}</div>
    </main>
  );
}

export function StoryCase({
  title,
  description,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border bg-background", className)}>
      <header className="grid gap-1 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? (
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className={cn("min-w-0 p-4", contentClassName)}>{children}</div>
    </section>
  );
}
