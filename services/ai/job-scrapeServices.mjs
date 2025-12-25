// Function to fetch job links specifically
export async function fetchJobLinks(messages) {
  return await fetchFromCloudflare(messages);
}

// Function to fetch salary ranges specifically
export async function fetchSalaryRanges(messages) {
  return await fetchFromCloudflare(messages);
}
