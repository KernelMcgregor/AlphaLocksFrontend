/* eslint-disable react-refresh/only-export-components -- vendored uiarc component, kept as published */
// From the uiarc registry (@uiarc/countdown), types stripped for this JS project.
// `npx shadcn add @uiarc/countdown` fails converting the CSS module to JS, so it was added by hand.
"use client";
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./countdown.module.css";
const { spring, stagger } = motionTokens;
const DEFAULT_UNITS = ["days", "hours", "minutes", "seconds"];
const SECONDS = { days: 86400, hours: 3600, minutes: 60, seconds: 1 };
const LIMIT = { days: Infinity, hours: 24, minutes: 60, seconds: 60 };
const NAMES = { days: ["Days", "d", "day"], hours: ["Hours", "h", "hour"], minutes: ["Minutes", "m", "minute"], seconds: ["Seconds", "s", "second"] };
const MAX_TIMEOUT = 2147483647;
const systemClock = () => Date.now();
function zoneOffset(epoch, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(epoch));
  const get = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - Math.floor(epoch / 1e3) * 1e3;
}
function toEpoch(target, timeZone) {
  if (typeof target === "number") return target;
  if (target instanceof Date) return target.getTime();
  const wall = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/.exec(target.trim());
  if (!wall) return Date.parse(target);
  const utc = Date.UTC(+wall[1], +wall[2] - 1, +wall[3], +(wall[4] ?? 0), +(wall[5] ?? 0), +(wall[6] ?? 0));
  if (!timeZone) return utc;
  const guess = utc - zoneOffset(utc, timeZone);
  return utc - zoneOffset(guess, timeZone);
}
function partsFor(seconds, units) {
  return units.map((unit, index) => ({ unit, value: index === 0 ? Math.floor(seconds / SECONDS[unit]) : Math.floor(seconds / SECONDS[unit]) % LIMIT[unit] }));
}
function basesFor(unit, largest, length) {
  return Array.from({ length }, (_, index) => {
    const tens = index === length - 2 && length === 2 && !largest;
    return tens ? unit === "hours" ? 3 : 6 : 10;
  });
}
const subscribeNothing = () => () => {
};
const subscribeVisibility = (notify) => {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
};
function Glyph({ position, digit, base }) {
  const offset = useTransform(position, (current) => ((digit - current) % base + base * 1.5) % base - base / 2);
  const y = useTransform(offset, (current) => `${current}em`);
  const opacity = useTransform(offset, (current) => Math.max(0, 1 - Math.abs(current)));
  const visibility = useTransform(offset, (current) => Math.abs(current) >= 1 ? "hidden" : "visible");
  const filter = useTransform(offset, (current) => Math.abs(current) < 0.02 || Math.abs(current) >= 1 ? "none" : `blur(${(Math.abs(current) * motionTokens.blur.subtle).toFixed(2)}px)`);
  return <motion.span className={styles.glyph} style={{ y, opacity, filter, visibility }}>{digit}</motion.span>;
}
function Wheel({ digit, base, delay, reduced }) {
  const position = useMotionValue(0);
  const wheel = useRef({ digit: 0, target: 0, revealed: false });
  useEffect(() => {
    const state = wheel.current;
    if (state.digit === digit) {
      state.revealed = true;
      return;
    }
    const up = (digit - state.digit + base) % base, down = base - up;
    state.target += down <= up ? -down : up;
    state.digit = digit;
    const first = !state.revealed;
    state.revealed = true;
    if (reduced) position.jump(state.target);
    else animate(position, state.target, first ? { ...spring.smooth, delay } : spring.snappy);
  }, [base, delay, digit, position, reduced]);
  return <motion.span className={styles.wheel} initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={reduced ? { duration: 0 } : spring.morph}>
    <span className={styles.sizer}>0</span>
    {Array.from({ length: base }, (_, value) => <Glyph key={value} position={position} digit={value} base={base} />)}
  </motion.span>;
}
function Countdown({ target, timeZone, units = DEFAULT_UNITS, variant = "large", completeLabel = "Live now", onComplete, label = "Time remaining", clock = systemClock, ref, className }) {
  const root = useRef(null);
  useImperativeHandle(ref, () => root.current);
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const reduced = !!useReducedMotion() && hydrated;
  const end = toEpoch(target, timeZone);
  const valid = Number.isFinite(end);
  const shownUnits = units.length ? [...units].sort((a, b) => SECONDS[b] - SECONDS[a]) : DEFAULT_UNITS;
  const pageVisible = useSyncExternalStore(subscribeVisibility, () => document.visibilityState === "visible", () => true);
  const inView = useInView(root, { amount: 0 });
  const running = pageVisible && inView && valid;
  const [now, setNow] = useState(null);
  const clockRef = useRef(clock);
  useLayoutEffect(() => {
    clockRef.current = clock;
  });
  useEffect(() => {
    if (!running) return;
    let timer;
    const tick = () => {
      const time = clockRef.current();
      setNow(time);
      const left2 = end - time;
      if (left2 > 0) timer = setTimeout(tick, (left2 % 1e3 || 1e3) + 8);
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [end, running]);
  useEffect(() => {
    if (!valid) return;
    const left2 = end - clockRef.current();
    if (left2 <= 0) return;
    const timer = setTimeout(() => setNow(clockRef.current()), Math.min(MAX_TIMEOUT, left2 + 8));
    return () => clearTimeout(timer);
  }, [end, valid]);
  const left = now === null || !valid ? null : Math.max(0, end - now);
  const complete = left === 0;
  const onCompleteRef = useRef(onComplete);
  useLayoutEffect(() => {
    onCompleteRef.current = onComplete;
  });
  const wasRunning = useRef(null);
  useEffect(() => {
    if (left === null) return;
    if (left > 0) {
      wasRunning.current = end;
      return;
    }
    if (wasRunning.current === end) {
      wasRunning.current = null;
      onCompleteRef.current?.();
    }
  }, [end, left]);
  const seconds = left === null ? 0 : Math.ceil(left / 1e3);
  const parts = partsFor(seconds, shownUnits);
  const pending = left === null;
  const compact = variant === "compact";
  const content = useRef(null);
  const width = useMotionValue("auto"), height = useMotionValue("auto");
  useLayoutEffect(() => {
    const node = content.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let first = true;
    const observer = new ResizeObserver(() => {
      const w = node.offsetWidth, h = node.offsetHeight;
      if (first || reduced) {
        width.jump(w);
        height.jump(h);
        first = false;
        return;
      }
      animate(width, w, spring.morph);
      animate(height, h, spring.smooth);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [height, reduced, width]);
  const spoken = complete ? typeof completeLabel === "string" ? completeLabel : "Complete" : pending ? "" : parts.filter((part, index) => part.value > 0 || index === parts.length - 1).filter((part) => seconds < 60 || part.unit !== "seconds").map((part) => `${part.value} ${part.value === 1 ? NAMES[part.unit][2] : `${NAMES[part.unit][2]}s`}`).join(", ");
  const swap = reduced ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: motionTokens.duration.fast } } : { initial: { opacity: 0, scale: 0.92, filter: `blur(${motionTokens.blur.soft}px)` }, animate: { opacity: 1, scale: 1, filter: "blur(0px)" }, exit: { opacity: 0, scale: 0.92, filter: `blur(${motionTokens.blur.soft}px)`, transition: { duration: motionTokens.duration.fast } }, transition: spring.morph };
  return <div ref={root} className={[styles.countdown, className].filter(Boolean).join(" ")} data-variant={variant} data-complete={complete || void 0} data-pending={pending || void 0} role="timer" aria-label={label}>
    <motion.div className={styles.shell} style={{ width, height }}>
      <div ref={content} className={styles.content} aria-hidden="true">
        <AnimatePresence mode="popLayout" initial={false}>
          {complete ? <motion.span key="done" className={styles.done} {...swap}><span className={styles.pulse} />{completeLabel}</motion.span> : <motion.span key="running" className={styles.units} {...swap}>
              {parts.map((part, group) => {
    const text = String(part.value).padStart(2, "0");
    const bases = basesFor(part.unit, group === 0, text.length);
    return <span key={part.unit} className={styles.unit}>
                  {!compact && group > 0 && <span className={styles.colon}>:</span>}
                  <span className={styles.group}>
                    <span className={styles.number}><AnimatePresence initial={false}>
                      {[...text].map((char, index) => <Wheel key={`${part.unit}${text.length - index}`} digit={Number(char)} base={bases[index]} delay={Math.min((group * 2 + index) * stagger.item, 0.3)} reduced={reduced} />)}
                    </AnimatePresence></span>
                    <span className={styles.name}>{NAMES[part.unit][compact ? 1 : 0]}</span>
                  </span>
                </span>;
  })}
            </motion.span>}
        </AnimatePresence>
      </div>
    </motion.div>
    <span className={styles.srOnly}>{spoken}</span>
  </div>;
}
var stdin_default = Countdown;
export {
  Countdown,
  stdin_default as default,
  toEpoch
};
