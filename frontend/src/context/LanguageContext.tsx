'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

const STORAGE_KEY = 'medai_lang'

export type Language = 'en' | 'hi'

interface Translations {
  [key: string]: { en: string; hi: string }
}

const translations: Translations = {
  // Navigation
  'nav.home': { en: 'Home', hi: 'होम' },
  'nav.modules': { en: 'Modules', hi: 'मॉड्यूल' },
  'nav.accuracy': { en: 'Accuracy', hi: 'सटीकता' },
  'nav.technology': { en: 'Technology', hi: 'तकनीक' },
  'nav.login': { en: 'Login', hi: 'लॉगिन' },
  'nav.patients': { en: 'Patients', hi: 'मरीज़' },
  'nav.tagline': { en: 'AI-Powered Clinical Intelligence', hi: 'AI-संचालित क्लिनिकल इंटेलिजेंस' },
  'nav.systemMetrics': { en: 'System Metrics', hi: 'सिस्टम मेट्रिक्स' },
  'nav.doctorLogin': { en: 'Doctor Login', hi: 'डॉक्टर लॉगिन' },

  // Hero
  'hero.badge': { en: 'All Systems Operational', hi: 'सभी सिस्टम चालू हैं' },
  'hero.title1': { en: 'Clinical-Grade AI', hi: 'क्लिनिकल-ग्रेड AI' },
  'hero.title2': { en: 'Diagnostic Intelligence', hi: 'डायग्नोस्टिक इंटेलिजेंस' },
  'hero.desc': {
    en: 'A multimodal medical triage platform combining <strong>Computer Vision</strong>, <strong>Random Forest classifiers</strong>, <strong>Explainable AI</strong>, and <strong>Large Language Models</strong> to deliver instant, transparent diagnostic assessments.',
    hi: '<strong>कंप्यूटर विज़न</strong>, <strong>रैंडम फ़ॉरेस्ट क्लासिफायर</strong>, <strong>एक्सप्लेनेबल AI</strong> और <strong>लार्ज लैंग्वेज मॉडल</strong> को जोड़कर तत्काल, पारदर्शी नैदानिक मूल्यांकन देने वाला मल्टीमॉडल मेडिकल ट्राइएज प्लेटफ़ॉर्म।'
  },
  'hero.startDiagnosis': { en: 'Start Diagnosis', hi: 'निदान शुरू करें' },
  'hero.scanSkin': { en: 'Scan Skin Condition', hi: 'त्वचा स्कैन करें' },

  // Modules
  'modules.title': { en: 'Choose Your Analysis', hi: 'अपना विश्लेषण चुनें' },
  'modules.subtitle': { en: 'Diagnostic Modules', hi: 'डायग्नोस्टिक मॉड्यूल' },
  'modules.launch': { en: 'Launch', hi: 'शुरू करें' },
  'modules.count': { en: 'AI-powered clinical modules', hi: 'AI-संचालित क्लिनिकल मॉड्यूल' },

  'mod.symptom.name': { en: 'Smart Symptom Checker', hi: 'स्मार्ट लक्षण परीक्षक' },
  'mod.symptom.desc': { en: 'Interactive 3D body map with Random Forest ML — select symptoms and get instant AI predictions across 41 diseases.', hi: 'रैंडम फ़ॉरेस्ट ML के साथ इंटरैक्टिव 3D बॉडी मैप — लक्षण चुनें और 41 बीमारियों में तत्काल AI भविष्यवाणी प्राप्त करें।' },
  'mod.skin.name': { en: 'Dermatology AI Scanner', hi: 'त्वचा रोग AI स्कैनर' },
  'mod.skin.desc': { en: 'Computer vision skin analysis with Explainable AI saliency maps showing diagnostic attention regions.', hi: 'एक्सप्लेनेबल AI सैलिएंसी मैप के साथ कंप्यूटर विज़न त्वचा विश्लेषण।' },
  'mod.ai.name': { en: 'Clinical AI Consultant', hi: 'क्लिनिकल AI सलाहकार' },
  'mod.ai.desc': { en: 'Context-aware medical Q&A powered by Llama 3 with Retrieval-Augmented Generation from your diagnostic session.', hi: 'Llama 3 द्वारा संचालित संदर्भ-जागरूक चिकित्सा प्रश्नोत्तर।' },
  'mod.mlops.name': { en: 'MLOps Control Center', hi: 'MLOps नियंत्रण केंद्र' },
  'mod.mlops.desc': { en: 'Production-grade model monitoring with data drift detection and continuous learning pipeline.', hi: 'डेटा ड्रिफ्ट डिटेक्शन के साथ प्रोडक्शन-ग्रेड मॉडल मॉनिटरिंग।' },
  'mod.patient.name': { en: 'Patient Management', hi: 'मरीज़ प्रबंधन' },
  'mod.patient.desc': { en: 'Complete patient records and clinical data management with doctor authentication.', hi: 'डॉक्टर प्रमाणीकरण के साथ पूर्ण मरीज़ रिकॉर्ड और क्लिनिकल डेटा प्रबंधन।' },
  'mod.rx.name': { en: 'Prescription Generator', hi: 'प्रिस्क्रिप्शन जनरेटर' },
  'mod.rx.desc': { en: 'Generate professional prescriptions with medicine details, dosage and clinic-branded PDF export.', hi: 'दवा विवरण, खुराक और क्लिनिक-ब्रांडेड PDF निर्यात के साथ पेशेवर प्रिस्क्रिप्शन बनाएं।' },
  'mod.rxqueue.name': { en: 'Prescription Dispatch', hi: 'प्रिस्क्रिप्शन डिस्पैच' },
  'mod.rxqueue.desc': { en: 'Review prescriptions and email them directly to patients.', hi: 'प्रिस्क्रिप्शन की समीक्षा करें और सीधे मरीज़ों को ईमेल करें।' },
  'mod.appointments.name': { en: 'Appointments', hi: 'अपॉइंटमेंट' },
  'mod.appointments.desc': { en: 'Schedule and manage patient appointments with doctors.', hi: 'डॉक्टरों के साथ मरीज़ों की अपॉइंटमेंट शेड्यूल करें।' },
  'mod.reminders.name': { en: 'Medication Reminders', hi: 'दवा अनुस्मारक' },
  'mod.reminders.desc': { en: 'Schedule medication reminders with browser notifications and email alerts.', hi: 'ब्राउज़र सूचनाओं और ईमेल अलर्ट के साथ दवा अनुस्मारक शेड्यूल करें।' },

  // Stats
  'stat.symptomAcc': { en: 'Symptom Model Accuracy', hi: 'लक्षण मॉडल सटीकता' },
  'stat.skinAcc': { en: 'Skin CV Engine Accuracy', hi: 'त्वचा CV इंजन सटीकता' },
  'stat.conditions': { en: 'Diagnosable Conditions', hi: 'निदान योग्य स्थितियाँ' },
  'stat.responseTime': { en: 'Average Response Time', hi: 'औसत प्रतिक्रिया समय' },

  // Common
  'common.back': { en: 'Back', hi: 'वापस' },
  'common.save': { en: 'Save', hi: 'सेव करें' },
  'common.cancel': { en: 'Cancel', hi: 'रद्द करें' },
  'common.delete': { en: 'Delete', hi: 'हटाएं' },
  'common.search': { en: 'Search', hi: 'खोजें' },
  'common.loading': { en: 'Loading...', hi: 'लोड हो रहा है...' },
  'common.noData': { en: 'No data found', hi: 'कोई डेटा नहीं मिला' },
  'common.language': { en: 'Language', hi: 'भाषा' },
  'common.submit': { en: 'Submit', hi: 'जमा करें' },

  // Auth
  'auth.login': { en: 'Sign In', hi: 'साइन इन' },
  'auth.register': { en: 'Register', hi: 'रजिस्टर करें' },
  'auth.email': { en: 'Email', hi: 'ईमेल' },
  'auth.password': { en: 'Password', hi: 'पासवर्ड' },
  'auth.logout': { en: 'Logout', hi: 'लॉगआउट' },

  // Page-specific
  'rx.title': { en: 'Prescription Generator', hi: 'प्रिस्क्रिप्शन जनरेटर' },
  'rx.medicine': { en: 'Medicine Name', hi: 'दवा का नाम' },
  'rx.dosage': { en: 'Dosage', hi: 'खुराक' },
  'rx.duration': { en: 'Duration', hi: 'अवधि' },
  'rx.frequency': { en: 'Frequency', hi: 'आवृत्ति' },
  'rx.add': { en: 'Add Medicine', hi: 'दवा जोड़ें' },
  'rx.diagnosis': { en: 'Diagnosis', hi: 'निदान' },
  'rx.notes': { en: 'Notes', hi: 'टिप्पणियाँ' },
  'rx.download': { en: 'Download Prescription', hi: 'प्रिस्क्रिप्शन डाउनलोड करें' },

  'patient.dashboard': { en: 'Patient Dashboard', hi: 'मरीज़ डैशबोर्ड' },
  'stats.totalPatients': { en: 'Total Patients', hi: 'कुल मरीज़' },

  'footer.disclaimer': { en: 'AI-assisted diagnostic tool for educational purposes. Not a substitute for professional medical advice.', hi: 'शैक्षिक उद्देश्यों के लिए AI-सहायित नैदानिक उपकरण। पेशेवर चिकित्सा सलाह का विकल्प नहीं।' },
}

// =====================================================================
// Flat English -> Hindi phrase map. Used by tp() helper to translate
// arbitrary strings without needing a registered key. Covers common UI
// chrome across feature pages so we don't have to refactor everything.
// =====================================================================
const phrases: Record<string, string> = {
  // Generic UI
  'Back to Dashboard': 'डैशबोर्ड पर वापस',
  'Back': 'वापस',
  'Dashboard': 'डैशबोर्ड',
  'Save': 'सेव करें',
  'Saving...': 'सेव हो रहा है...',
  'Cancel': 'रद्द करें',
  'Delete': 'हटाएं',
  'Edit': 'संपादित करें',
  'Add': 'जोड़ें',
  'Close': 'बंद करें',
  'Send': 'भेजें',
  'Sending...': 'भेज रहे हैं...',
  'Search': 'खोजें',
  'Refresh': 'रिफ्रेश',
  'Loading...': 'लोड हो रहा है...',
  'Submit': 'जमा करें',
  'Submitting...': 'जमा हो रहा है...',
  'Yes': 'हाँ',
  'No': 'नहीं',
  'Optional': 'वैकल्पिक',
  'Required': 'आवश्यक',
  'Status': 'स्थिति',
  'Date': 'तारीख',
  'Time': 'समय',
  'Name': 'नाम',
  'Notes': 'टिप्पणियाँ',
  'Action': 'क्रिया',
  'Actions': 'क्रियाएँ',
  'Active': 'सक्रिय',
  'Inactive': 'निष्क्रिय',
  'Total': 'कुल',
  'Today': 'आज',
  'No results found': 'कोई परिणाम नहीं मिला',
  'No data available': 'कोई डेटा उपलब्ध नहीं',
  'Try again': 'पुनः प्रयास करें',
  'Continue': 'जारी रखें',
  'Confirm': 'पुष्टि करें',
  'Logout': 'लॉगआउट',

  // Patient page
  'Patient Management': 'मरीज़ प्रबंधन',
  'Add New Patient': 'नया मरीज़ जोड़ें',
  'Search patients...': 'मरीज़ खोजें...',
  'Total Patients': 'कुल मरीज़',
  'New Patients Today': 'आज के नए मरीज़',
  'Active Appointments': 'सक्रिय अपॉइंटमेंट',
  'Phone': 'फोन',
  'Blood Group': 'रक्त समूह',
  'Registered': 'पंजीकृत',
  'Allergies': 'एलर्जी',
  'Age': 'उम्र',
  'Gender': 'लिंग',
  'Male': 'पुरुष',
  'Female': 'महिला',
  'Other': 'अन्य',
  'New Prescription': 'नया प्रिस्क्रिप्शन',

  // Symptom Checker
  'Smart Symptom Checker': 'स्मार्ट लक्षण परीक्षक',
  'Symptom Checker': 'लक्षण परीक्षक',
  'Selected Symptoms': 'चयनित लक्षण',
  'Search symptoms...': 'लक्षण खोजें...',
  'Predict Disease': 'बीमारी का पूर्वानुमान करें',
  'Predict': 'पूर्वानुमान करें',
  'Analyzing...': 'विश्लेषण हो रहा है...',
  'AI is analyzing...': 'AI विश्लेषण कर रहा है...',
  'Top Predictions': 'शीर्ष भविष्यवाणियाँ',
  'Confidence': 'विश्वास स्तर',
  'Severity': 'गंभीरता',
  'Recommendation': 'सिफारिश',
  'Clear All': 'सब हटाएं',
  'Add Symptom': 'लक्षण जोड़ें',
  'Body Map': 'बॉडी मैप',
  'Dropdown': 'ड्रॉपडाउन',
  '3D Body Map': '3D बॉडी मैप',

  // Skin Analyzer
  'Dermatology AI Scanner': 'त्वचा रोग AI स्कैनर',
  'Skin Analyzer': 'त्वचा विश्लेषक',
  'Upload Image': 'छवि अपलोड करें',
  'Take Photo': 'फोटो लें',
  'Drop image here or click to upload': 'यहाँ छवि छोड़ें या अपलोड करने के लिए क्लिक करें',
  'Analyzing image...': 'छवि का विश्लेषण हो रहा है...',
  'Analysis Result': 'विश्लेषण परिणाम',
  'Attention Heatmap': 'ध्यान हीटमैप',
  'Choose Image': 'छवि चुनें',
  'Re-upload': 'पुनः अपलोड करें',

  // AI Assistant
  'Clinical AI Consultant': 'क्लिनिकल AI सलाहकार',
  'AI Assistant': 'AI सहायक',
  'Ask a medical question...': 'चिकित्सा प्रश्न पूछें...',
  'AI is thinking...': 'AI सोच रहा है...',
  'Type your question...': 'अपना प्रश्न लिखें...',
  'Clear chat': 'चैट साफ़ करें',
  'New conversation': 'नई बातचीत',

  // Medication Reminders
  'Medication Reminders': 'दवा अनुस्मारक',
  'Patient Reminders': 'मरीज़ अनुस्मारक',
  'Patient': 'मरीज़',
  'Select patient to view their reminders': 'अनुस्मारक देखने के लिए मरीज़ चुनें',
  'Active Reminders': 'सक्रिय अनुस्मारक',
  'Add Reminder': 'अनुस्मारक जोड़ें',
  'New Reminder': 'नया अनुस्मारक',
  'Medicine': 'दवा',
  'Dose': 'खुराक',
  'Time(s)': 'समय',
  'Send test email': 'परीक्षण ईमेल भेजें',
  'Email alerts': 'ईमेल अलर्ट',
  'Browser notifications': 'ब्राउज़र सूचनाएं',
  'Select a patient to view their reminders.': 'अनुस्मारक देखने के लिए मरीज़ चुनें।',
  'Frequency': 'आवृत्ति',
  'Once daily': 'दिन में एक बार',
  'Twice daily': 'दिन में दो बार',
  'Three times daily': 'दिन में तीन बार',
  'Four times daily': 'दिन में चार बार',
  'Every morning': 'हर सुबह',
  'Every night': 'हर रात',
  'After food': 'भोजन के बाद',
  'Before food': 'भोजन से पहले',

  // Prescriptions
  'Prescription Dispatch': 'प्रिस्क्रिप्शन डिस्पैच',
  'Prescriptions': 'प्रिस्क्रिप्शन',
  'My Prescriptions': 'मेरे प्रिस्क्रिप्शन',
  'Pending Dispatch': 'लंबित डिस्पैच',
  'Sent': 'भेजा गया',
  'Send to Patient': 'मरीज़ को भेजें',
  'Save & Send to Patient': 'सेव करें और मरीज़ को भेजें',
  'Sent to Patient': 'मरीज़ को भेजा गया',
  'Download PDF': 'PDF डाउनलोड करें',
  'Diagnosis': 'निदान',
  'Delivered': 'पहुँचाया गया',
  'Bounced': 'बाउंस हुआ',
  'No email': 'कोई ईमेल नहीं',
  'Not yet sent': 'अभी तक नहीं भेजा',
  'Mock mode': 'मॉक मोड',
  'No prescriptions yet': 'अभी तक कोई प्रिस्क्रिप्शन नहीं',
  'Dosage': 'खुराक',
  'Duration': 'अवधि',
  'Instructions': 'निर्देश',
  'Add Medicine': 'दवा जोड़ें',
  'Save & Send to Reception': 'सेव करें और रिसेप्शन को भेजें',
  'Patient Name': 'मरीज़ का नाम',
  'Select patient': 'मरीज़ चुनें',
  'Prescription Generator': 'प्रिस्क्रिप्शन जनरेटर',
  'Diagnosis (e.g., Viral Fever)': 'निदान (जैसे, वायरल बुखार)',
  'Notes (optional)': 'टिप्पणियाँ (वैकल्पिक)',

  // Appointments
  'Appointments': 'अपॉइंटमेंट',
  'Book Appointment': 'अपॉइंटमेंट बुक करें',
  'New Appointment': 'नई अपॉइंटमेंट',
  'Doctor': 'डॉक्टर',
  'Reason': 'कारण',
  'Scheduled': 'निर्धारित',
  'Completed': 'पूर्ण',
  'Cancelled': 'रद्द',
  'Upcoming': 'आगामी',
  'Past': 'पिछले',
  'No appointments yet': 'अभी तक कोई अपॉइंटमेंट नहीं',
  'Slot': 'स्लॉट',
  'Reschedule': 'पुनः शेड्यूल करें',

  // MLOps
  'MLOps Dashboard': 'MLOps डैशबोर्ड',
  'MLOps Control Center': 'MLOps नियंत्रण केंद्र',
  'Live Model Performance': 'लाइव मॉडल प्रदर्शन',
  'User Feedback': 'उपयोगकर्ता प्रतिक्रिया',
  'Trained': 'प्रशिक्षित',
  'Not Trained': 'अप्रशिक्षित',
  'Validation Accuracy': 'सत्यापन सटीकता',
  'Data Drift': 'डेटा ड्रिफ्ट',
  'Predictions': 'भविष्यवाणियाँ',
  'Retrain Model': 'मॉडल पुनः प्रशिक्षित करें',

  // Login
  'Sign In': 'साइन इन',
  'Sign Up': 'साइन अप',
  'Email': 'ईमेल',
  'Password': 'पासवर्ड',
  "Don't have an account?": 'खाता नहीं है?',
  'Already have an account?': 'पहले से खाता है?',
  'Welcome back': 'वापसी पर स्वागत है',
  'Create your account': 'अपना खाता बनाएं',
  'I am a': 'मैं हूँ',
}

interface LanguageContextType {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string) => string
  tp: (text: string) => string
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key: string) => key,
  tp: (text: string) => text,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('en')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null
    if (saved === 'en' || saved === 'hi') setLangState(saved)
  }, [])

  const setLang = (next: Language) => {
    setLangState(next)
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY, next) } catch {}
    }
  }

  const t = (key: string): string => {
    return translations[key]?.[lang] || key
  }

  // tp = "translate phrase". Pass any English string. If lang is Hindi
  // and the phrase is in our flat dictionary, returns the Hindi version.
  // Otherwise returns the original input untouched.
  const tp = (text: string): string => {
    if (lang === 'en' || !text) return text
    return phrases[text.trim()] || text
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tp }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
