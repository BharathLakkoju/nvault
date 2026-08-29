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
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-slate-950/50 [animation:dc-fade-in_.12s_ease-out]" />
      <RadixDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[14px] border border-line bg-surface p-5 shadow-2xl focus:outline-none [animation:dc-pop-in_.14s_ease-out] sm:p-6",
          className,
        )}
      >
        <RadixDialog.Title className="text-lg font-medium text-ink">{title}</RadixDialog.Title>
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
