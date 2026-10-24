import { createContext, useContext } from "react";
import type { Data, Session } from "../domain/model";
export interface Store {
  data: Data;
  update: (fn: (d: Data) => Data) => Promise<boolean>;
  go: (page: string) => void;
  play: (id: string, workout?: boolean) => void;
  demo: boolean;
  setDemo: (v: boolean) => void;
  notify: (v: string) => void;
  openResult: (s: Session) => void;
}
export const Context = createContext<Store>(null!);
export const useStore = () => useContext(Context);
