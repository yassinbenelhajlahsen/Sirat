# Sirat

An Islamic companion app: prayer times, notifications, a prayer and habit tracker, Quran, duas, Qibla and mosques. Works fully signed-out; signing in syncs the user's data across devices.

## Settings and sync

**Synced setting**:
A user choice that follows the user to every signed-in device, where the newest edit wins.
_Avoid_: shared pref, global setting

**Device-only setting**:
A value that describes this device rather than the user's choice (OS permission status, caches, schedule bookkeeping). Never synced.
_Avoid_: local setting

**Prayer settings**:
The user's choice of calculation method, whether to use their location, and their manual city. A synced setting.
_Avoid_: settings (unqualified), location settings

**Effective prayer settings**:
The prayer settings as they apply on this device right now, after accounting for whether this device actually grants location. Never stored.
_Avoid_: resolved settings, derived settings

## Tracker

**Prayer mark**:
The status a user records for one prayer on one day: prayed, late or missed.
_Avoid_: log entry, prayer status cell

**Cleared mark**:
A prayer mark the user has removed. It still counts as an edit, so removing a mark on one device removes it everywhere.
_Avoid_: deletion, unlog

## Ramadan

**Ramadan day**:
A day that falls in Ramadan on the Umm al-Qura calendar, with the day turning at Maghrib.
_Avoid_: fasting day, Ramadan window

**Missed fast**:
A Ramadan day the user marks as not fasted, to make up later.
_Avoid_: qada fast (qada is used for prayers)

## Notifications

**Prayer alert**:
The notification that fires at a prayer's time.
_Avoid_: adhan notification, at-prayer reminder

**Window reminder**:
The notification that fires a set number of minutes before a prayer's time runs out. Fajr's window ends at Sunrise; Isha has none.
_Avoid_: ending-soon alert

**Friday reminder**:
The weekly Friday morning notification that opens Surah Al-Kahf.
_Avoid_: Jumu'ah alert
