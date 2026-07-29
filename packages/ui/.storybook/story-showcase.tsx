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
    <main className="mx-auto grid w-full max-w-[1440px] gap-8">
      <header className="grid max-w-3xl gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </header>
      <div className="grid min-w-0 divide-y">{children}</div>
    </main>
  );
}

export function StoryCase({
  title,
  description,
  children,
  contentClassName,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <section className="min-w-0 py-8 first:pt-0 last:pb-0">
      <header className="grid gap-1 pb-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className={cn("min-w-0", contentClassName)}>{children}</div>
    </section>
  );
}
