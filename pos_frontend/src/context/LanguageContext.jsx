import { createContext, useContext, useState, useEffect } from 'react';
import ar from '../translations/ar';
import en from '../translations/en';

const LanguageContext = createContext();

const translations = {
  ar,
  en,
};

export const LanguageProvider = ({ children }) => {
  // Get initial language from localStorage or default to 'ar'
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('language');
    return saved || 'ar';
  });

  // Get translation object based on current language
  const t = translations[language];

  // Change language and save to localStorage
  const changeLanguage = (newLang) => {
    if (translations[newLang]) {
      setLanguage(newLang);
      localStorage.setItem('language', newLang);
      
      // Update document direction and lang attribute
      document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = newLang;
    }
  };

  // Set initial direction on mount
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const value = {
    language,
    changeLanguage,
    t,
    isRTL: language === 'ar',
    isArabic: language === 'ar',
    isEnglish: language === 'en',
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
