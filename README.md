# Sirat 📿

**Sirat** is a modern, mobile-first Islamic companion app built with **React Native** and **Expo**.  
It helps users stay connected to their faith with accurate prayer times, Qibla direction, mosque discovery, and daily reminders — all in a clean, minimalist interface.

---

## ✨ Features

- 🕌 **Accurate Prayer Times** – powered by the Aladhan API, adjusted to the user’s precise location
- 🧭 **Qibla Direction** – live compass using device orientation sensors
- 📖 **Quran Reader** – full audio & text with translation, fuzzy surah/juz search, juz jumping, and auto-resume
- 📍 **Nearby Mosques** – integrates Google Maps and Places API for mosque discovery
- 🔔 **Prayer Notifications** – customizable alerts with prayer names and times
- 💾 **Offline Support** – locally cached preferences and last known prayer data

---

## 🛠️ Tech Stack

- **Framework:** React Native + Expo Router
- **Styling:** Tailwind CSS (via NativeWind)
- **APIs:** Aladhan API, Google Maps / Places API
- **Storage:** AsyncStorage for local persistence
- **Core Libraries:**
  - `expo-location` – user geolocation
  - `expo-sensors` – compass heading
  - `expo-notifications` – scheduled reminders
  - `axios` – API data fetching
  - `expo-updates` – over-the-air updates via EAS

---

## 🧭 Architecture

- **Frontend:** Modular React Native components for screens, utilities, and services
- **Logic Layer:** Hooks-based services for location, notifications, and API integration
- **UI Design:** Built for mobile-first responsiveness using TailwindCSS + Safe Area context
- **OTA Updates:** Instant over-the-air JS updates via Expo EAS Updates

---

## 📚 APIs Used

| API                                                                                                      | Purpose                                     |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| [Aladhan API](https://aladhan.com/prayer-times-api)                                                      | Prayer times, calendar, and date conversion |
| [Google Maps / Places API](https://developers.google.com/maps/documentation/places/web-service/overview) | Mosque locations                            |

---

## 🚧 Roadmap

- 🌍 Multilingual support (English, Arabic, French, more)
- ☁️ Backend integration for user profiles and sync
- 📆 Widget & Apple Watch support
- 🎨 Advanced theme customization and user-selected color palettes

---

## 🌐 Learn More

Visit the official landing page for more info and download links:  
👉 [**sirat.dev**](https://sirat.dev)

---


## 🧑‍💻 Author

**Yassin Benelhajlahsen**  
Built with 💚 and a goal to make daily faith practice easier through thoughtful technology.
