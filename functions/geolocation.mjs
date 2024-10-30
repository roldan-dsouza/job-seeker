import axios from "axios";
import NodeGeocoder from "node-geocoder";

const geocoder = NodeGeocoder({
  provider: "locationiq",
  apiKey: "YOUR_LOCATIONIQ_API_KEY", // Replace with your actual API key
});

// Function to get the city name based on IP
export async function getCityFromIP(ip) {
  try {
    // Use a geolocation API to get latitude and longitude from the IP
    const { data } = await axios.get(`https://ipapi.co/${ip}/json/`);

    const { latitude, longitude } = data;

    // Use geocoder to get location details from latitude and longitude
    const res = await geocoder.reverse({ lat: latitude, lon: longitude });
    const locationData = res[0] || {};

    // Check for city, then town, then village in the response
    const city =
      locationData.city ||
      locationData.town ||
      locationData.village ||
      "Location not found";

    return city;
  } catch (error) {
    console.error("Error fetching city:", error.message);
    throw new Error("Could not fetch city");
  }
}
