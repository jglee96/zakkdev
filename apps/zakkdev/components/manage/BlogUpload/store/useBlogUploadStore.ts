import { create } from 'zustand';

interface State {
  files: Map<string, File>;
}

const initialState: State = {
  files: new Map<string, File>(),
};

interface Action {
  add: (file: File) => void;
}

export const useBlogUploadStore = create<State & { actions: Action }>()(
  (set, get) => ({
    ...initialState,
    actions: {
      add: (file: File) => {
        get().files.has(file.name);
      },
    },
  })
);
