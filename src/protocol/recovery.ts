import type { RecoveryOperation } from '../domain/models';
import type { RecoveryStore } from './client';
import type { RecordStore } from './storage';

const PREFIX = 'operation:';

export function createRecoveryStore(store: RecordStore): RecoveryStore {
  const all = () => store.keys(PREFIX).flatMap(key => store.read<RecoveryOperation>(key) ?? []);
  return {
    async saveBeforeDispatch(operation) {
      if (operation.status !== 'prepared') throw new Error('Only a prepared operation is saved before dispatch.');
      if (store.read(PREFIX + operation.id)) throw new Error(`Operation ${operation.id} is already saved.`);
      store.write(PREFIX + operation.id, operation);
    },
    async get(operationId) {
      return store.read<RecoveryOperation>(PREFIX + operationId);
    },
    async listUnresolved() {
      return all().filter(operation => operation.status !== 'confirmed');
    },
    async saveResult(operation) {
      if (!store.read(PREFIX + operation.id)) throw new Error(`Operation ${operation.id} was never saved before dispatch.`);
      store.write(PREFIX + operation.id, operation);
    },
  };
}
