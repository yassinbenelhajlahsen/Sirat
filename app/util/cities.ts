import topCities from "../../assets/data/cities.json";

export interface City {
  name: string;
  lat: number;
  lng: number;
}
export const cityKey = (c: City) => `${c.name}_${c.lat}_${c.lng}`;

const CITIES: City[] = topCities;
export default CITIES;
