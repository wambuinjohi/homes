import { createContext, useContext, useState, ReactNode } from "react";

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedUser: any | null;
  impersonatedRole: string | null;
  startImpersonation: (user: any, role: string) => void;
  stopImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export const ImpersonationProvider = ({ children }: { children: ReactNode }) => {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<any | null>(null);
  const [impersonatedRole, setImpersonatedRole] = useState<string | null>(null);

  const startImpersonation = (user: any, role: string) => {
    setImpersonatedUser(user);
    setImpersonatedRole(role);
    setIsImpersonating(true);
  };

  const stopImpersonation = () => {
    setImpersonatedUser(null);
    setImpersonatedRole(null);
    setIsImpersonating(false);
  };

  return (
    <ImpersonationContext.Provider 
      value={{
        isImpersonating,
        impersonatedUser,
        impersonatedRole,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = () => {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error("useImpersonation must be used within an ImpersonationProvider");
  }
  return context;
};