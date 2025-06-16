import { Text, View, SafeAreaView } from "react-native";
export default function Settings() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0c3605" }}>
     
         <View
             style={{
               alignItems: "flex-start",  
               justifyContent: "flex-start",
               paddingTop: 10,
               paddingLeft: 20,
             }}
           >
           <Text style= {{color: "white", fontFamily: "SFProDisplay-Bold", fontSize: 45}}> Settings </Text>
     
         </View> 
             </SafeAreaView>
  );
}
