function parseAIJson(response) {
  try {
    return JSON.parse(response);
  } catch (err) {
    console.error("Invalid AI JSON:", err);
    return null;
  }
}
export { parseAIJson };
