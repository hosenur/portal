import { createContext, useContext, useState, useCallback } from "react";

interface BreadcrumbContextValue {
  pageTitle: string | null;
  setPageTitle: (title: string | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pageTitle, setPageTitleState] = useState<string | null>(null);

  const setPageTitle = useCallback((title: string | null) => {
    setPageTitleState(title);
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ pageTitle, setPageTitle }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb() {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error("useBreadcrumb must be used within a BreadcrumbProvider");
  }
  return context;
}

export function useSetPageTitle(title: string | null) {
  const { setPageTitle } = useBreadcrumb();

  useState(() => {
    setPageTitle(title);
    return null;
  });
}
