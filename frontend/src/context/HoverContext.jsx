import React, { createContext, useContext, useMemo, useState } from "react";

const HoverContext = createContext({ hovered: null, setHovered: () => {} });

export function HoverProvider({ children }) {
  const [hovered, setHovered] = useState(null);
  const value = useMemo(() => ({ hovered, setHovered }), [hovered]);
  return <HoverContext.Provider value={value}>{children}</HoverContext.Provider>;
}

export function useHover() {
  return useContext(HoverContext);
}
