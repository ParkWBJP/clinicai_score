"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Locale = 'ko' | 'ja';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocale] = useState<Locale>('ko');

  // Load from localStorage if available, else default to 'ko'
  // In a real app we might check browser language, but requirements say default KO
  useEffect(() => {
    const saved = localStorage.getItem('clinicai-locale');
    if (saved === 'ko' || saved === 'ja') {
      setLocale(saved);
    }
  }, []);

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem('clinicai-locale', newLocale);
  };
  
  // Simple mapping, can be moved to a separate file if it grows
  const t = (key: string) => {
    // This will be connected to the dictionary later
    return key; 
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale: changeLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
