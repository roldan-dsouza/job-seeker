import axios from "axios";
import NodeGeocoder from "node-geocoder";

// Set up Node Geocoder with OpenStreetMap (or any other supported provider)
const geocoder = NodeGeocoder({
  provider: "openstreetmap",
});

// Function to get the city name based on IP
export async function getCityFromIP(ip) {
  try {
    // Use a geolocation API to get latitude and longitude from the IP
    const { data } = await axios.get(`https://ipapi.co/${ip}/json/`);
    
    const { latitude, longitude } = data;

    // Use geocoder to get city name from latitude and longitude
    const res = await geocoder.reverse({ lat: latitude, lon: longitude });
    const city = res[0]?.city;

    return city || "City not found";
  } catch (error) {
    console.error("Error fetching city:", error.message);
    throw new Error("Could not fetch city");
  }
}
