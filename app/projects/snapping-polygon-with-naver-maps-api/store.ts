import RBush from "rbush";
import { create } from "zustand";
import { PolygonTreeObject } from "./common";

interface State {
  polygonTree: RBush<PolygonTreeObject>;
}

const initialState: State = {
  polygonTree: new RBush<PolygonTreeObject>(),
};

export const treeStore = create<State>()(() => ({ ...initialState }));
