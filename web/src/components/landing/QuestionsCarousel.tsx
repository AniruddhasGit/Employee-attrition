"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { compareSegments, getMetrics, getWorkforce } from "@/lib/api";
import { pct } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { ErrorState } from "@/components/ui/ErrorState";
import { Reveal } from "@/components/ui/Reveal";
import { Skeleton } from "@/components/ui/Skeleton";

type Card = { question: string; stat: string; body: string; tone: string };

async function loadCards(): Promise<Card[]> {
  const [wf, metrics, ot] = await Promise.all([
    getWorkforce(),
    getMetrics(),
    compareSegments({ overTime: "Yes" }, { overTime: "No" }),
  ]);
  const risky = [...wf.heatmap].filter((c) => c.n >= 10).sort((a, b) => b.meanRisk - a.meanRisk)[0];
  const driver = wf.topDrivers[0];
  const [lo, hi] = metrics.after.ci?.roc_auc ?? [0, 0];
  return [
    {
      question: "Who is most at risk?",
      stat: pct(risky.meanRisk),
      body: `${risky.jobRole}s in ${risky.department} have the highest average risk score, across ${risky.n} people.`,
      tone: "bg-[radial-gradient(120%_120%_at_80%_0%,var(--hero-c),var(--hero-a))]",
    },
    {
      question: "Does overtime matter?",
      stat: `${pct(ot.a.attritionRate ?? 0)} vs ${pct(ot.b.attritionRate ?? 0)}`,
      body: `People who worked overtime left at about ${((ot.a.attritionRate ?? 0) / (ot.b.attritionRate || 1)).toFixed(1)} times the rate of those who didn't.`,
      tone: "bg-surface border border-line",
    },
    {
      question: "What raises risk most often?",
      stat: pct(driver.share),
      body: `of employees have "${driver.text.toLowerCase()}" among the factors pushing their score up.`,
      tone: "bg-signal-soft",
    },
    {
      question: "How sure is the model?",
      stat: metrics.after.roc_auc.toFixed(2),
      body: `It ranks a leaver above a stayer about ${pct(metrics.after.roc_auc)} of the time. The 95% range is ${pct(lo)} to ${pct(hi)}.`,
      tone: "bg-surface border border-line",
    },
  ];
}

function Track({ cards }: { cards: Card[] }) {
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const first = useRef<HTMLLIElement>(null);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const el = first.current;
    if (!el) return;
    const measure = () => setStep(el.offsetWidth + 16);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.target instanceof HTMLElement) || !e.target.closest("[data-testid=questions]")) return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, cards.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cards.length]);

  const go = (d: number) => setIndex((i) => Math.min(Math.max(i + d, 0), cards.length - 1));

  return (
    <>
      <div className="overflow-hidden">
        <motion.ul
          data-testid="carousel-track"
          className="flex cursor-grab gap-4 active:cursor-grabbing"
          drag="x"
          dragConstraints={{ left: -step * (cards.length - 1), right: 0 }}
          dragElastic={0.12}
          onDragEnd={(_, info) => {
            if (info.offset.x < -50 || info.velocity.x < -400) go(1);
            else if (info.offset.x > 50 || info.velocity.x > 400) go(-1);
          }}
          animate={{ x: -index * step }}
          transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.55, bounce: 0.12 }}
        >
          {cards.map((c, i) => (
            <li
              key={c.question}
              ref={i === 0 ? first : undefined}
              aria-hidden={i !== index}
              className={`flex min-h-[340px] shrink-0 basis-[86%] select-none flex-col justify-between rounded-2xl p-6 md:basis-[56%] md:p-10 ${c.tone}`}
            >
              <h3 className="text-xl font-medium md:text-2xl">{c.question}</h3>
              <div>
                <p className="tabular text-[clamp(3rem,7vw,5.5rem)] font-semibold leading-none tracking-[-0.04em]">{c.stat}</p>
                <p className="mt-4 max-w-[44ch] text-sm leading-relaxed text-ink-soft md:text-base">{c.body}</p>
              </div>
            </li>
          ))}
        </motion.ul>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <p data-testid="carousel-status" aria-live="polite" className="text-sm text-muted">
          Question {index + 1} of {cards.length}
        </p>
        <div className="flex gap-2">
          {[
            { d: -1, label: "Previous question", Icon: ArrowLeftIcon, disabled: index === 0 },
            { d: 1, label: "Next question", Icon: ArrowRightIcon, disabled: index === cards.length - 1 },
          ].map(({ d, label, Icon, disabled }) => (
            <button
              key={label}
              aria-label={label}
              disabled={disabled}
              onClick={() => go(d)}
              className="grid size-10 place-items-center rounded-full border border-line transition-transform duration-150 ease-out active:scale-[0.96] enabled:hover:bg-surface disabled:opacity-35"
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export function QuestionsCarousel() {
  const { data, error, retry } = useApi(loadCards);
  return (
    <section data-testid="questions" aria-labelledby="questions-title" className="mx-auto max-w-[1400px] px-4 py-24 md:px-8 md:py-32">
      <Reveal>
        <h2 id="questions-title" className="max-w-[16ch] text-[clamp(2.25rem,4.4vw,4rem)] font-semibold leading-[1] tracking-[-0.035em]">
          Questions leaders ask, answered with the data.
        </h2>
      </Reveal>
      <div className="mt-12">
        {data && <Track cards={data} />}
        {error && <ErrorState message={error.message} onRetry={retry} />}
        {!data && !error && <Skeleton className="h-[340px]" />}
      </div>
    </section>
  );
}
