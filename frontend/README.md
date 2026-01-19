# Sirat Frontend 📱

React Native + Expo mobile app for Islamic utilities: prayer times, Qibla, Quran, mosques, and notifications.

---

## 🚀 Quick Start

```bash
npm install
npm start
```

### Run on Platforms

```bash
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # Web (limited features)
```

---

## 📁 Structure

```
frontend/
├── app/           # Screens & UI components
├── services/      # Business logic & API calls
├── hooks/         # Custom React hooks
├── context/       # State management
├── assets/        # Images, fonts, sounds, data
├── constants/     # Theme & design tokens
└── util/          # Helper functions
```

---

## 🔧 Configuration

Create a `.env` file:

```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

---

## 🏗️ Tech Stack

- **Framework:** React Native + Expo Router
- **Language:** TypeScript
- **Styling:** NativeWind (Tailwind CSS)
- **State:** React Context + Hooks
- **APIs:** Aladhan (prayer times), Google Maps/Places

---

## � Key Features

- 🕌 Prayer times with location-based calculations
- 🧭 Qibla compass with device sensors
- � Quran reader with audio playback
- � Nearby mosque discovery
- 🔔 Prayer notifications
- 💾 Offline support with AsyncStorage

---

## 📚 Documentation

See [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) for detailed architecture patterns and conventions.
