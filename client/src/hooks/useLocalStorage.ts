import { useState, useEffect, useCallback } from "react";

/**
 * Hook para persistência em localStorage com suporte a autosave
 * Funciona 100% offline
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Erro ao ler localStorage[${key}]:`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.error(`Erro ao escrever localStorage[${key}]:`, error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}

/**
 * Hook para autosave com debounce
 */
export function useAutoSave<T>(
  value: T,
  key: string,
  delayMs: number = 500
): void {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error(`Erro ao autosalvar localStorage[${key}]:`, error);
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [value, key, delayMs]);
}
