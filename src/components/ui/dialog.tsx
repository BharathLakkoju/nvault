"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;

export function DialogContent({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in" />
      <RadixDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-surface p-5 shadow-lg focus:outline-none sm:p-6",
          className,
        )}
      >
        <RadixDialog.Title className="text-base font-semibold text-ink">
          {title}
        </RadixDialog.Title>
        {description && (
          <RadixDialog.Description className="mt-1 text-sm text-muted">
            {description}
          </RadixDialog.Description>
        )}
        <div className="mt-4">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export const DialogClose = RadixDialog.Close;
