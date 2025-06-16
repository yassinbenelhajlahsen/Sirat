import { Text, View, SafeAreaView, ScrollView } from "react-native";

const prayerTimes = [
  { label: "Fajr", time: "3:45 AM" },
  { label: "Sunrise", time: "5:24 AM" },
  { label: "Dhuhr", time: "12:57 PM" },
  { label: "Asr", time: "4:57 PM" },
  { label: "Maghrib", time: "8:29 PM" },
  { label: "Isha", time: "10:09 PM" },
];

const nearbyMosques = [
  { name: "Ar-Rahman", address: "333 86th St, Brooklyn, NY 11209" },
  {
    name: "Islamic Society of Bay Ridge",
    address: "6807 5th Ave, Brooklyn, NY 11220",
  },
  {
    name: "Maryam Mosque",
    address: "7307 5th Ave, Brooklyn, NY 11209",
  },
];

let today = new Date();

export default function Home() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0c3605" }}>
      <ScrollView
         contentContainerStyle={{
    paddingTop: 10,
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 40, 
  }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            color: "white",
            fontFamily: "SFProDisplay-Bold",
            fontSize: 45,
          }}
        >
          Home
        </Text>

        <Text
          style={{
            color: "white",
            textAlign: "center",
            width: "100%",
            marginTop: 50,
            fontFamily: "SFProDisplay-Semibold",
            fontSize: 25,
          }}
        >
          Today's Prayer Times
        </Text>
        <Text
          style={{
            color: "white",
            textAlign: "center",
            width: "100%",
            marginTop: 20,
            fontFamily: "SFProDisplay-Semibold",
            fontSize: 22,
          }}
        >
          {today.toDateString()}
        </Text>
        <Text
          style={{
            color: "white",
            textAlign: "center",
            width: "100%",
            marginTop: 10,
            fontFamily: "SFProDisplay-Semibold",
            fontSize: 22,
          }}
        >
          Dhuʻl-Hijjah 19, 1446 AH{" "}
          {/* using mock date for now, will update when API is integrated */}
        </Text>

        {prayerTimes.map(({ label, time }, index) => (
          <View
            key={label}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              width: "100%",
              marginTop: index === 0 ? 40 : 20,
            }}
          >
            <Text
              style={{
                color: "white",
                fontFamily: "SFProDisplay-Regular",
                fontSize: 25,
              }}
            >
              {label}
            </Text>
            <Text
              style={{
                color: "white",
                fontFamily: "SFProDisplay-Regular",
                fontSize: 25,
              }}
            >
              {time}
            </Text>
          </View>
        ))}

        <Text
          style={{
            color: "white",
            textAlign: "center",
            width: "100%",
            marginTop: 50,
            fontFamily: "SFProDisplay-Semibold",
            fontSize: 25,
          }}
        >
          Nearby Mosques
        </Text>
        {nearbyMosques.map(({ name, address }, index) => (
          <View
            key={name}
            style={{
              width: "100%",
              marginTop: index === 0 ? 40 : 20,
            }}
          >
            <Text
              style={{
                color: "white",
                fontFamily: "SFProDisplay-Regular",
                fontSize: 22,
              }}
            >
              {name}
            </Text>
            <Text
              style={{
                color: "white",
                fontFamily: "SFProDisplay-Regular",
                fontSize: 18,
                marginTop: 4,
                opacity: 0.85,
              }}
            >
              {address}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
