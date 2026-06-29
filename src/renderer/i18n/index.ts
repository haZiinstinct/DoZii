import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from './de.json'
import en from './en.json'
import es from './es.json'
import fr from './fr.json'
import pt from './pt.json'
import ru from './ru.json'
import ar from './ar.json'
import ja from './ja.json'
import zh from './zh.json'

i18n.use(initReactI18next).init({
  resources: {
    de: { translation: de },
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    pt: { translation: pt },
    ru: { translation: ru },
    ar: { translation: ar },
    ja: { translation: ja },
    zh: { translation: zh }
  },
  lng: 'de',
  // Fehlt ein Key in einer Sprache, faellt er auf Englisch zurueck (statt den
  // rohen Key anzuzeigen). de bleibt zweite Stufe fuer DE-spezifische Begriffe.
  fallbackLng: ['en', 'de'],
  interpolation: {
    escapeValue: false
  }
})

export default i18n
