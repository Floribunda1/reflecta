import { Dispatch, SetStateAction, useCallback, useState } from "react";

export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const stored = window.localStorage.getItem(key);
    if (stored === null) return initialValue;
    try {
      return JSON.parse(stored) as T;
    } catch {
      return initialValue;
    }
  });

  const setStoredValue: Dispatch<SetStateAction<T>> = useCallback(
    (next) => {
      setValue((current) => {
        const resolved = typeof next === "function" ? (next as (value: T) => T)(current) : next;
        window.localStorage.setItem(key, JSON.stringify(resolved));
        return resolved;
      });
    },
    [key],
  );

  return [value, setStoredValue];
}
