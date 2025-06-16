import { Text, View, SafeAreaView } from "react-native";

export default function Qibla() {
  return (
   <SafeAreaView style={{ flex: 1}}>
     
         <View
             style={{
               alignItems: "flex-start",  
               justifyContent: "flex-start",
               paddingTop: 10,
               paddingLeft: 20,
             }}
           >
           <Text style= {{color: "white", fontFamily: "SFProDisplay-Bold", fontSize: 45}}>Qibla</Text>
     
         </View> 
             </SafeAreaView>

  );
}

