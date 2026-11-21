export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
}

export class StorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StorageError';
  }
}

export const RECORD_VERSION = 1;
const ROOT = 'plebstack:';

interface Envelope<T> {
  version: number;
  value: T;
}

export interface RecordStore {
  read<T>(key: string): T | undefined;
  write<T>(key: string, value: T): void;
  remove(key: string): void;
  keys(prefix: string): string[];
}

// A namespace gives each person in one browser their own records; no store reads outside its own.
export function createRecordStore(storage: StorageLike | (() => StorageLike), namespace?: string): RecordStore {
  const PREFIX = namespace ? `${ROOT}${namespace}/` : ROOT;
  const backing = (): StorageLike => {
    try {
      return typeof storage === 'function' ? storage() : storage;
    } catch (error) {
      throw new StorageError('This browser has no storage available.', { cause: error });
    }
  };

  return {
    read<T>(key: string) {
      const raw = backing().getItem(PREFIX + key);
      if (raw === null) return undefined;
      const parsed = JSON.parse(raw) as Envelope<T>;
      if (parsed.version !== RECORD_VERSION) throw new StorageError(`Unknown record version ${parsed.version} for ${key}.`);
      return parsed.value;
    },
    write<T>(key: string, value: T) {
      const raw = JSON.stringify({ version: RECORD_VERSION, value } satisfies Envelope<T>);
      try {
        backing().setItem(PREFIX + key, raw);
      } catch (error) {
        throw new StorageError('Couldn’t save to this browser’s storage.', { cause: error });
      }
    },
    remove(key: string) {
      backing().removeItem(PREFIX + key);
    },
    keys(prefix: string) {
      const store = backing();
      const found: string[] = [];
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (key?.startsWith(PREFIX + prefix)) found.push(key.slice(PREFIX.length));
      }
      return found;
    },
  };
}

export function memoryStorage(): StorageLike & { failWrites: boolean } {
  const items = new Map<string, string>();
  return {
    failWrites: false,
    getItem: key => items.get(key) ?? null,
    setItem(key, value) {
      if (this.failWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      items.set(key, value);
    },
    removeItem: key => { items.delete(key); },
    get length() { return items.size; },
    key: index => [...items.keys()][index] ?? null,
  };
}
