"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface TerminalStep {
  /** The command typed after the prompt. */
  command: string;
  /** Output lines revealed one-by-one after the command "runs". */
  output?: readonly string[];
}

interface Props {
  steps: readonly TerminalStep[];
  title?: string;
  className?: string;
}

const TYPE_MS = 42;
const LINE_MS = 240;
const HOLD_MS = 2400;

/**
 * A terminal that types a scripted sequence of commands and reveals their
 * output, then loops. Server-rendered fully expanded (good for no-JS, crawlers
 * and `prefers-reduced-motion`); the typing animation only starts on the
 * client when reduced motion is not requested.
 */
export function AnimatedTerminal({ steps, title = "envvault — bash", className }: Props) {
  const [animate, setAnimate] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const [lines, setLines] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) setAnimate(true);
  }, []);

  useEffect(() => {
    if (!animate) return;
    const step = steps[stepIndex];
    const outCount = step.output?.length ?? 0;

    if (typed < step.command.length) {
      timer.current = setTimeout(() => setTyped((n) => n + 1), TYPE_MS);
    } else if (lines < outCount) {
      timer.current = setTimeout(() => setLines((n) => n + 1), LINE_MS);
    } else {
      const last = stepIndex === steps.length - 1;
      timer.current = setTimeout(() => {
        setStepIndex(last ? 0 : stepIndex + 1);
        setTyped(0);
        setLines(0);
      }, HOLD_MS);
    }
    return () => clearTimeout(timer.current);
  }, [animate, steps, stepIndex, typed, lines]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-xl dark:border-slate-800",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-400/80" />
        <span className="h-3 w-3 rounded-full bg-amber-400/80" />
        <span className="h-3 w-3 rounded-full bg-green-400/80" />
        <span className="ml-3 truncate text-xs text-slate-400">{title}</span>
      </div>
      <pre
        className="overflow-x-auto px-4 py-4 text-[13px] leading-relaxed text-slate-300"
        aria-label="Terminal demonstration"
      >
        <code>
          {steps.map((step, i) => {
            const done = !animate || i < stepIndex;
            const active = animate && i === stepIndex;
            if (!animate || done) {
              return <CompletedStep key={i} step={step} />;
            }
            if (active) {
              return (
                <span key={i}>
                  <span className="text-emerald-400">$ </span>
                  {step.command.slice(0, typed)}
                  <Caret />
                  {"\n"}
                  {(step.output ?? []).slice(0, lines).map((line, j) => (
                    <span key={j} className="text-slate-400">
                      {line}
                      {"\n"}
                    </span>
                  ))}
                </span>
              );
            }
            return null;
          })}
        </code>
      </pre>
    </div>
  );
}

function CompletedStep({ step }: { step: TerminalStep }) {
  return (
    <span>
      <span className="text-emerald-400">$ </span>
      {step.command}
      {"\n"}
      {(step.output ?? []).map((line, j) => (
        <span key={j} className="text-slate-400">
          {line}
          {"\n"}
        </span>
      ))}
    </span>
  );
}

function Caret() {
  return <span className="ml-0.5 inline-block h-3.5 w-1.5 -translate-y-px bg-slate-300 align-middle motion-safe:animate-pulse" />;
}
