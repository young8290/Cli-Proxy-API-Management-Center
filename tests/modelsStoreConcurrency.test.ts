import { beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { modelsApi } from '../src/services/api/models';
import { useModelsStore } from '../src/stores/useModelsStore';
import type { ModelInfo } from '../src/utils/models';

const model = (name: string): ModelInfo => ({ name });

describe('models store concurrency', () => {
  beforeEach(() => {
    useModelsStore.setState({ models: [], loading: false, error: null, cache: null });
  });

  test('keeps the newest request when model responses finish out of order', async () => {
    let resolveFirst!: (models: ModelInfo[]) => void;
    let resolveSecond!: (models: ModelInfo[]) => void;
    const firstResponse = new Promise<ModelInfo[]>((resolve) => {
      resolveFirst = resolve;
    });
    const secondResponse = new Promise<ModelInfo[]>((resolve) => {
      resolveSecond = resolve;
    });
    const fetchSpy = spyOn(modelsApi, 'fetchModels').mockImplementation((apiBase) =>
      apiBase === 'https://old.example' ? firstResponse : secondResponse
    );

    try {
      const first = useModelsStore.getState().fetchModels('https://old.example', undefined, true);
      const second = useModelsStore.getState().fetchModels('https://new.example', undefined, true);

      resolveSecond([model('new-model')]);
      await second;
      resolveFirst([model('old-model')]);
      await first;

      expect(useModelsStore.getState().models).toEqual([model('new-model')]);
      expect(useModelsStore.getState().cache?.apiBase).toBe('https://new.example');
      expect(useModelsStore.getState().loading).toBe(false);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test('does not let a request from a cleared connection repopulate the store', async () => {
    let resolveRequest!: (models: ModelInfo[]) => void;
    const response = new Promise<ModelInfo[]>((resolve) => {
      resolveRequest = resolve;
    });
    const fetchSpy = spyOn(modelsApi, 'fetchModels').mockImplementation(() => response);

    try {
      const request = useModelsStore.getState().fetchModels('https://old.example', undefined, true);
      useModelsStore.getState().clearCache();
      resolveRequest([model('stale-model')]);
      await request;

      expect(useModelsStore.getState().models).toEqual([]);
      expect(useModelsStore.getState().cache).toBeNull();
      expect(useModelsStore.getState().loading).toBe(false);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
