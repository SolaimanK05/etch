import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  /** Target value to count up to */
  target: number | null;
  /** Number of decimal places */
  decimals?: number;
  /** Placeholder when target is null */
  placeholder?: string;
}

/**
 * CountUp — motion #15.
 * Counts up to `target` using ~50ms ticks with 30% easing per tick.
 */
export function CountUp({ target, decimals = 2, placeholder = "—" }: CountUpProps) {
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef<number | null>(target);

  useEffect(() => {
    targetRef.current = target;
    if (target === null) {
      shownRef.current = 0;
      setShown(0);
      return;
    }

    function tick() {
      const tgt = targetRef.current;
      if (tgt === null) return;
      const diff = tgt - shownRef.current;
      if (Math.abs(diff) < Math.pow(10, -(decimals + 1))) {
        shownRef.current = tgt;
        setShown(tgt);
        return;
      }
      shownRef.current = shownRef.current + diff * 0.3;
      setShown(shownRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setTimeout(tick, 50);
      });
    }

    tick();

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, decimals]);

  if (target === null) return <>{placeholder}</>;
  return <>{shown.toFixed(decimals)}</>;
}
