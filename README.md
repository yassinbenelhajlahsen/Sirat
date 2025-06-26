# Sirat 📿

**Sirat** is a mobile-first Islamic utility app built with React Native and Expo. It helps users practice their faith with tools like prayer time reminders, Qibla direction, nearby mosque discovery, and more.

---

## ✨ Features

- 🕌 Accurate prayer times using Aladhan API
- 🧭 Qibla direction compass using device sensors
- 📍 Mosque locator via Google Maps API and geolocation
- 🔔 Local Adhan notifications (planned)
- 📖 Daily Ayah and Hadith feed (planned)
- 🌙 Offline-friendly UI with theme support (planned)

---

## 🛠️ Tech Stack

- **React Native** + **Expo**
- **Tailwind CSS** (via NativeWind)
- **Axios** – API calls
- **expo-location** – get user location
- **expo-sensors** – for compass heading
- **expo-notifications** – for scheduled prayer alerts
- **AsyncStorage** – for saving preferences

---

### 📸 Screenshots


<details>
  <summary>(click to expand)</summary>

  ### Today's Prayer Times
  <img src="screenshots/homePrayerTimes.png" width="400"/>

  ### Nearby Mosques 
  <img src="screenshots/homeMasjid.png" width="400"/>

  ### Functional Qibla  
  <img src="screenshots/qibla.png" width="400"/>
</details>


---

## 📚 APIs Used

Aladhan API – prayer times & calender

Google Maps / Places API – mosque locator

---

## 🚧 Planned Features

Push notifications with custom Adhan audio

Bookmarking Ayahs and Hadiths and saving progress, adding a backend

Full Quran/Hadith browser with search

Multilingual support (EN, AR, FR, etc.)