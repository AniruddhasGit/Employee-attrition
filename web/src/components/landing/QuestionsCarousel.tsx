"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getPublicSummary } from "@/lib/api";
import { pct } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { ErrorState } from "@/components/ui/ErrorState";
import { Reveal } from "@/components/ui/Reveal";
import { Skeleton } from "@/components/ui/Skeleton";

type Card = { question: string; stat: string; body: string; tone: string };

async function loadCards(): Promise<Card[]> {
  const { riskiest, overtime, topDriver, metrics } = await getPublicSummary();
  const [lo, hi] = metrics.after.ci?.roc_auc ?? [0, 0];
  return [
    {
      question: "Who is most at risk?",
      stat: pct(riskiest.meanRisk),
      body: `${riskiest.jobRole}s in ${riskiest.department} have the highest average risk score, across ${riskiest.n} people.`,
      tone: "bg-[radial-gradient(120%_120%_at_80%_0%,var(--hero-c),var(--hero-a))]",
    },
    {
      question: "Does overtime matter?",
      stat: `${pct(overtime.yes)} vs ${pct(overtime.no)}`,
      body: `People who worked overtime left at about ${(overtime.yes / (overtime.no || 1)).toFixed(1)} times the rate of those who didn't.`,
      tone: "bg-surface border border-line",
    },
    {
      question: "What raises risk most often?",
      stat: pct(topDriver.share),
      body: `of employees have ${topDriver.text} among the factors pushing their score up.`,
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
              className={`flex min-h-[320px] shrink-0 basis-[86%] select-none flex-col justify-between rounded-2xl p-6 transition-opacity duration-300 ease-out md:min-h-[360px] md:basis-[56%] md:p-10 ${c.tone} ${
                i === index ? "opacity-100" : "opacity-55"
              }`}
            >
              <div className="flex items-start justify-between gap-6">
                <h3 className="max-w-[20ch] text-xl font-medium tracking-[-0.01em] md:text-2xl">{c.question}</h3>
                <span className="tabular shrink-0 rounded-full border border-ink/10 bg-bg/40 px-2.5 py-1 font-mono text-xs text-ink-soft">
                  {String(i + 1).padStart(2, "0")} / {String(cards.length).padStart(2, "0")}
                </span>
              </div>
              <div>
                <p className="tabular text-[clamp(3rem,7vw,5.5rem)] font-semibold leading-none tracking-[-0.04em]">{c.stat}</p>
                <p className="mt-4 max-w-[44ch] text-sm leading-relaxed text-ink-soft md:text-base">{c.body}</p>
              </div>
            </li>
          ))}
        </motion.ul>
      </div>
      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            {cards.map((c, i) => (
              <button
                key={c.question}
                type="button"
                aria-label={`Go to question ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
                className="group relative grid h-11 w-5 place-items-center"
              >
                <span
                  aria-hidden
                  className="block size-1.5 rounded-full bg-haze transition-colors duration-200 group-hover:bg-mist"
                />
                {i === index && (
                  <motion.span
                    aria-hidden
                    layoutId="questions-dot"
                    className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ink"
                    transition={reduce ? { duration: 0 } : { type: "spring", duration: 0.4, bounce: 0.15 }}
                  />
                )}
              </button>
            ))}
          </div>
          <p data-testid="carousel-status" aria-live="polite" className="tabular text-sm text-muted">
            Question {index + 1} of {cards.length}
          </p>
        </div>
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
              className="grid size-11 place-items-center rounded-full border border-line bg-surface/60 transition-transform duration-150 ease-out active:scale-[0.97] enabled:hover:border-ink/30 disabled:opacity-35"
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
    <section id="questions" data-testid="questions" aria-labelledby="questions-title" className="mx-auto max-w-[1400px] scroll-mt-20 px-4 py-24 md:px-8 md:py-32">
      <div className="grid grid-cols-12 gap-y-6">
        <p className="col-span-12 flex items-center gap-2 self-start text-sm text-muted md:col-span-3 md:pt-4">
          <span aria-hidden className="h-px w-6 bg-mist" />
          Insights
        </p>
        <Reveal className="col-span-12 md:col-span-9">
          <h2 id="questions-title" className="max-w-[16ch] text-[clamp(2.25rem,4.4vw,4rem)] font-semibold leading-[1] tracking-[-0.035em]">
            Questions leaders ask, answered with the data.
          </h2>
          <p className="mt-6 max-w-[48ch] text-lg leading-relaxed text-pretty text-muted">
            Live figures from the model behind Retain. Swipe, drag or use the arrows.
          </p>
        </Reveal>
      </div>
      <div className="mt-12 md:mt-16">
        {data && <Track cards={data} />}
        {error && <ErrorState message={error.message} status={error.status} onRetry={retry} />}
        {!data && !error && (
          <div aria-busy="true" aria-label="Loading insights" className="flex gap-4 overflow-hidden">
            <Skeleton className="h-[320px] shrink-0 basis-[86%] md:h-[360px] md:basis-[56%]" />
            <Skeleton className="h-[320px] shrink-0 basis-[86%] opacity-60 md:h-[360px] md:basis-[56%]" />
          </div>
        )}
      </div>
    </section>
  );
}
