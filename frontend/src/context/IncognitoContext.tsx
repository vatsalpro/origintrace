import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Investigation } from '../types';
import { api } from '../services/api';
import { IncognitoConfirmationModal } from '../components/IncognitoConfirmationModal';
import { IncognitoPrivacyModal } from '../components/IncognitoPrivacyModal';

interface IncognitoContextType {
  isIncognito: boolean;
  incognitoInvestigations: Investigation[];
  activeIncognitoId?: string;
  setActiveIncognitoId: (id: string | undefined) => void;
  enterIncognito: () => void;
  toggleIncognito: () => void;
  requestExitIncognito: () => void;
  confirmExitIncognito: () => Promise<void>;
  cancelExitIncognito: () => void;
  clearIncognitoSession: () => Promise<void>;
  refreshIncognitoInvestigations: () => Promise<void>;
  showExitModal: boolean;
  showPrivacyModal: boolean;
  setShowPrivacyModal: (show: boolean) => void;
}

const IncognitoContext = createContext<IncognitoContextType | undefined>(undefined);

export const IncognitoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isIncognito, setIsIncognito] = useState<boolean>(() => {
    return sessionStorage.getItem('origintrace_incognito') === 'true';
  });
  const [incognitoInvestigations, setIncognitoInvestigations] = useState<Investigation[]>([]);
  const [activeIncognitoId, setActiveIncognitoId] = useState<string | undefined>(undefined);
  const [showExitModal, setShowExitModal] = useState<boolean>(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);

  const refreshIncognitoInvestigations = async () => {
    try {
      const invs = await api.getIncognitoInvestigations();
      setIncognitoInvestigations(invs);
      if (invs.length > 0 && !activeIncognitoId) {
        setActiveIncognitoId(invs[0].id);
      }
    } catch (err) {
      console.warn('Failed to refresh incognito investigations:', err);
    }
  };

  useEffect(() => {
    if (isIncognito) {
      sessionStorage.setItem('origintrace_incognito', 'true');
      refreshIncognitoInvestigations();
    } else {
      sessionStorage.removeItem('origintrace_incognito');
    }
  }, [isIncognito]);

  const enterIncognito = () => {
    setIsIncognito(true);
    refreshIncognitoInvestigations();
  };

  const requestExitIncognito = () => {
    if (incognitoInvestigations.length > 0) {
      setShowExitModal(true);
    } else {
      confirmExitIncognito();
    }
  };

  const confirmExitIncognito = async () => {
    try {
      await api.clearIncognitoSession();
    } catch (err) {
      console.warn('Error clearing incognito session on exit:', err);
    }
    setIncognitoInvestigations([]);
    setActiveIncognitoId(undefined);
    setIsIncognito(false);
    sessionStorage.removeItem('origintrace_incognito');
    setShowExitModal(false);
  };

  const cancelExitIncognito = () => {
    setShowExitModal(false);
  };

  const toggleIncognito = () => {
    if (isIncognito) {
      requestExitIncognito();
    } else {
      enterIncognito();
    }
  };

  const clearIncognitoSession = async () => {
    try {
      await api.clearIncognitoSession();
    } catch (err) {
      console.warn('Error clearing incognito session:', err);
    }
    setIncognitoInvestigations([]);
    setActiveIncognitoId(undefined);
  };

  return (
    <IncognitoContext.Provider
      value={{
        isIncognito,
        incognitoInvestigations,
        activeIncognitoId,
        setActiveIncognitoId,
        enterIncognito,
        toggleIncognito,
        requestExitIncognito,
        confirmExitIncognito,
        cancelExitIncognito,
        clearIncognitoSession,
        refreshIncognitoInvestigations,
        showExitModal,
        showPrivacyModal,
        setShowPrivacyModal,
      }}
    >
      {children}
      <IncognitoConfirmationModal
        isOpen={showExitModal}
        activeCasesCount={incognitoInvestigations.length}
        onConfirm={confirmExitIncognito}
        onCancel={cancelExitIncognito}
      />
      <IncognitoPrivacyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
    </IncognitoContext.Provider>
  );
};

export const useIncognito = (): IncognitoContextType => {
  const context = useContext(IncognitoContext);
  if (!context) {
    throw new Error('useIncognito must be used within an IncognitoProvider');
  }
  return context;
};
