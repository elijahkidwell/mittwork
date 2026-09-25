import { useEffect, useRef } from "react";

/** Returns a function that runs `fn` once input has been quiet for `ms`. */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  const fnRef = useRef(fn);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );
  const run = useRef((...args: A) => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      fnRef.current(...args);
    }, ms);
  });
  return run.current;
}
