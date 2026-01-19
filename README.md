# Sirat 📿 - Mono-Repo

**Sirat** is a modern, mobile-first Islamic companion app providing prayer times, Qibla direction, Quran reading with audio, mosque discovery, and AI-powered dua search.

---

## 🏗️ Repository Structure

This is a **mono-repo** with strict separation between frontend and backend:

```
/
├── frontend/      → React Native + Expo mobile app
├── backend/       → Node.js API server (dua service)
├── docs/          → Documentation website
├── .github/       → CI/CD workflows & GitHub config
├── .gitignore     → Git ignore rules
└── README.md      → This file
```

---

## 🚀 Quick Start

### Frontend (Mobile App)

```bash
cd frontend
npm install
npm start
```

See detailed instructions: [`frontend/README.md`](./frontend/README.md)

### Backend (API Server)

```bash
cd backend
npm install
npm run dev
```

See detailed instructions: [`backend/README.md`](./backend/README.md)

---

## ✨ Features

- 🕌 **Accurate Prayer Times** – Aladhan API with precise location-based calculations
- 🧭 **Qibla Direction** – Live compass using device orientation sensors
- 📖 **Quran Reader** – Full audio & text with translation, bookmarks, and auto-resume
- 📍 **Nearby Mosques** – Google Maps/Places API integration
- 🔔 **Prayer Notifications** – Customizable alerts for each prayer
- 💾 **Offline Support** – Cached preferences and prayer data
- 🤲 **AI-Powered Dua Search** – GPT-4 powered dua discovery and recommendations
- 🗓️ **Islamic Calendar** – Hijri date support with prayer schedules

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React Native + Expo Router
- **Language:** TypeScript
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **State Management:** React Context + Hooks
- **Storage:** AsyncStorage
- **Key Libraries:**
  - `expo-location` – GPS & geolocation
  - `expo-sensors` – Compass heading
  - `expo-notifications` – Local notifications
  - `expo-audio` – Audio playback
  - `expo-router` – File-based navigation

### Backend
- **Runtime:** Node.js 18+
- **Language:** TypeScript
- **Framework:** Express.js
- **AI Integration:** OpenAI GPT-4 API
- **Deployment:** Railway

---

## 🧭 Architecture Overview

### Frontend
- **Service Layer:** Modular services for prayer times, notifications, Quran data, and location
- **Context Providers:** Global state management for audio playback and settings
- **Expo Router:** File-based routing with tab navigation
- **Offline-First:** AsyncStorage caching for core functionality

### Backend
- **RESTful API:** Express-based endpoints for dua search
- **AI Service:** OpenAI integration for intelligent dua recommendations
- **Static Assets:** Pre-loaded dua database with metadata

---

## 📚 APIs & Services

| Service                                                                  | Purpose                                     |
| ------------------------------------------------------------------------ | ------------------------------------------- |
| [Aladhan API](https://aladhan.com/prayer-times-api)                      | Prayer times, calendar, date conversion     |
| [Google Maps/Places](https://developers.google.com/maps)                 | Mosque locations & map integration          |
| [OpenAI GPT-4](https://platform.openai.com/)                             | Dua search & recommendations                |
| [Expo Updates](https://docs.expo.dev/eas-update/introduction/)           | OTA updates for mobile app                  |

---

## 🔧 Environment Variables

### Frontend (`frontend/.env`)

```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### Backend (`backend/.env`)

```env
OPENAI_API_KEY=your_openai_api_key
PORT=3000
NODE_ENV=development
```

---

## 🚧 Roadmap

- [ ] 🌍 Multilingual support (English, Arabic, French)
- [ ] ☁️ User profiles and cloud sync
- [ ] 📆 Home screen widgets (iOS & Android)
- [ ] ⌚ Apple Watch companion app
- [ ] 🎨 Theme customization with user-selected palettes
- [ ] 📊 Prayer statistics and tracking
- [ ] 🤝 Community features (shared duas, mosque reviews)

---

## 🌐 Links

- **Website:** [sirat.dev](https://sirat.dev)
- **Documentation:** [`docs/`](./docs/)
- **Frontend README:** [`frontend/README.md`](./frontend/README.md)
- **Backend README:** [`backend/README.md`](./backend/README.md)

---

## 🧑‍💻 Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (for frontend)
- iOS Simulator (macOS) or Android Emulator (for mobile testing)

### Project Setup

```bash
# Clone repository
git clone https://github.com/yassinbenelhajlahsen/Sirat.git
cd Sirat

# Setup frontend
cd frontend
npm install
npm start

# Setup backend (in new terminal)
cd ../backend
npm install
npm run dev
```

---

## 📝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is private and proprietary. All rights reserved.

---

## 🧑‍💻 Author

**Yassin Benelhajlahsen**  
Built with 💚 to make daily faith practice easier through thoughtful technology.

- GitHub: [@yassinbenelhajlahsen](https://github.com/yassinbenelhajlahsen)
- Website: [sirat.dev](https://sirat.dev)

---

## 🙏 Acknowledgments

- Aladhan API for prayer time calculations
- OpenAI for GPT-4 API
- Expo team for the amazing React Native framework
- The Muslim developer community for inspiration and feedback
