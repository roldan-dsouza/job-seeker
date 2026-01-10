// Function to create messages for insights
export function createInsightsMessages(formattedText) {
  return [
    {
      role: "system",
      content: `You are a helpful bot helping me to get an overview of my resume. Keep the response limited to 100 words. Based on my resume, don't tell me about the things I have already mentioned, such as my education and internships. Create an overview with insights like salary range, job titles, pay scale, and rate of difficulty to get placed. Your response should sound human. Don't list out the insights specifically, but mend them within the response. Remember that the job should be localized based on the location specified in my resume. Your response is the last response in the conversation, and there are no more questions that should be asked,and remember if it is not a valid resume just send "invalid resume" no other text other than this should be sent in that case`,
    },
    {
      role: "user",
      content: formattedText,
    },
  ];
}

// Function to create messages for job links
export function createJobMessages(formattedText, location) {
  return [
    {
      role: "system",
      content: `Based on the provided text from a resume, generate a list of links to apply for jobs using the skills and locations from my resume. DO NOT respond with anything other than the list of posts, only the links. Also, do not give links where results are none, and if the desired location is in India, then search in naukri.com.`,
    },
    {
      role: "user",
      content: formattedText + ` job location preference ${location}`,
    },
  ];
}

export function createSalaryMessages(formattedText, location) {
  return [
    {
      role: "system",
      content: `Generate a list of jobs along with their corresponding salary ranges (minimum and maximum) per annum based on the provided resume text. Ensure that the salary ranges are relevant to the skills and experience mentioned in the resume. Provide the full annual salary amounts as numbers (e.g., 700000, not 7-8 lakhs), and base the currency code on the job location (e.g., 'INR' for India, 'USD' for the United States).make sure to check the internet to give a accurate amount. 

      The response must strictly follow this JSON format and include nothing else: 
      [
        { 
          "job": "Job Title", 
          "salary": { 
            "min": <full number without currency>, 
            "max": <full number without currency> 
          }, 
          "currency": "<currency code based on location>"
        }, 
        ...
      ]
      
      Do not include any additional explanations, introductory text, or messages. The output should only be in the JSON format above with no extra text.`,
    },
    {
      role: "user",
      content: formattedText + ` job location preference ${location}`,
    },
  ];
}

export const nameLocationJobTitlePrompt = {
  role: "system",
  content: `
Extract only the person's name, city name, and job title from the following resume text.

Return STRICT JSON in this format:
{
  "name": "<person's name>",
  "location": "<city name>",
  "job title": "<specific job title>"
}

Rules:
- job title means the type of job the person can apply for
- return ONLY ONE job title
- do NOT return anything outside JSON
`.trim(),
};

export const skillExperienceLocationPrompt = {
  role: "system",
  content: `
Extract only:
- primary skill (general job name, not framework)
- experience level (beginner | intermediate | senior)
- location (city name, else state)

Return STRICT JSON:
{
  "skills": "<one primary skill>",
  "experience": "<beginner | intermediate | senior>",
  "location": "<city or state>"
}

Rules:
- only ONE skill
- no extra text
`.trim(),
};

export const nameLocationJobTitleExperiencePrompt = {
  role: "system",
  content: `
Extract ONLY the following fields and return STRICT JSON:

{
  "name": "<person's name>",
  "location": "<city>",
  "jobTitle": "<job title>",
  "skills": ["<skills from resume>"],
  "experience": "<beginner | intermediate | senior>"
}

Rules:
- jobTitle = role they can apply for (NOT skill)
- be strict
- no extra output
`.trim(),
};

export const jobDetailsPrompt = {
  role: "system",
  content: `
Extract ONLY the following from the resume text and return STRICT JSON:

{
  "jobTitle": "<eligible job title>",
  "location": "<city>",
  "experience level": "<beginner | intermediate | senior>"
}

Rules:
- Only ONE job title
- No extra text
- JSON only
`.trim(),
};
