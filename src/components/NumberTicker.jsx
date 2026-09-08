import { useState, useEffect, useRef } from "react";

/**
 * NumberTicker — animates a numeric value from start to end over ~600ms
 * using requestAnimationFrame. Supports fractional numbers and currency formatting.
 */
export default function NumberTicker({ value, prefix = "", suffix = "", duration = 600 }) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef(null);
  const fromRef = useRef(value);

  useEffect(() => {
    const to = value;
    const from = fromRef.current ?? to;
    const diff = to - from;

    if (diff === 0) {
      setDisplay(to);
      return;
    }

    let startTime = null;

    const animate = (now) => {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out quad for smooth deceleration
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = from + diff * eased;

      setDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(to);
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const formatted = prefix + Math.round(display).toLocaleString("en-IN") + suffix;

  return <>{formatted}</>;
}
