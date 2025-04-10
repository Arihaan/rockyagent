const OpenAI = require('openai');
const config = require('../config');

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

// Summarize pitch from founder
const summarizePitch = async (pitchText) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an AI analyst for Rocky, an investment DAO. Your task is to summarize founder pitches into clear, structured formats. 
        Format the summary with these sections: 
        - Project Name
        - One-line Description
        - Founders
        - Funding Round & Details
        - Technology/Product
        - Market & Competitors
        - Unique Value Proposition
        - Traction & Metrics
        - Use of Funds
        
        Keep the summary concise but comprehensive, highlighting the most important aspects for investors.`
      },
      {
        role: 'user',
        content: pitchText
      }
    ],
    temperature: 0.3,
    max_tokens: 800,
  });

  return response.choices[0].message.content;
};

// Extract wallet address and funding amount from pitch
const extractPitchDetails = async (pitchText) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an AI analyst for Rocky, an investment DAO. Extract the following information from the founder's pitch:
        1. Ethereum wallet address (should start with 0x)
        2. Requested funding amount in ETH

        Return a JSON object with the following format:
        {
          "eth_address": "0x...", // The wallet address, or null if not found
          "eth_amount": X, // The amount in ETH as a number, or null if not found
          "valid": true/false, // Whether both values were found and are valid
          "message": "" // Optional explanation if values are invalid
        }
        
        For the address to be valid, it must start with 0x followed by 40 hexadecimal characters.
        For the amount to be valid, it must be a positive number.
        
        If the information is not clearly stated, do your best to infer it. If no valid information can be found, set the respective fields to null.`
      },
      {
        role: 'user',
        content: pitchText
      }
    ],
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: "json_object" }
  });

  try {
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Error parsing JSON from OpenAI response:', error);
    return {
      eth_address: null,
      eth_amount: null,
      valid: false,
      message: "Failed to parse pitch details"
    };
  }
};

// Analyze feedback and generate a consensus
const analyzeFeedback = async (feedbackList) => {
  const feedbackText = feedbackList.map(fb => `Member ${fb.telegram_username}: ${fb.comment}`).join('\n\n');
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an AI analyst for Rocky, an investment DAO. Your task is to analyze member feedback on a potential investment and generate a consensus summary. 
        Identify:
        - Common positive points
        - Common concerns/risks
        - Overall sentiment (positive, neutral, negative)
        - Areas needing further clarification
        - Recommendation based on feedback consensus
        
        Be objective and fair in your analysis.`
      },
      {
        role: 'user',
        content: feedbackText
      }
    ],
    temperature: 0.3,
    max_tokens: 800,
  });

  return response.choices[0].message.content;
};

// Generate investment thesis
const generateInvestmentThesis = async (pitchSummary, feedbackSummary) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an AI analyst for Rocky, an investment DAO. Your task is to create a comprehensive investment thesis based on a pitch summary and member feedback. 
        Include these sections:
        - Company Overview
        - Market Analysis
        - Product/Technology Assessment
        - Team Evaluation
        - Competitive Landscape
        - Investment Terms Analysis
        - Risk Assessment
        - Growth Potential
        - Recommendation (Invest/Pass/Need More Info)
        
        Be thorough but concise. Back up your points with evidence from the pitch and feedback.`
      },
      {
        role: 'user',
        content: `Pitch Summary:\n${pitchSummary}\n\nFeedback Summary:\n${feedbackSummary}`
      }
    ],
    temperature: 0.3,
    max_tokens: 1200,
  });

  return response.choices[0].message.content;
};

// Generate a personalized introduction from investor to founder
const generateIntroduction = async (investorUsername, projectName, projectSummary) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an AI writing assistant for Rocky, an investment DAO. Your task is to create a personalized, warm introduction message from an investor to a founder.
        
        The introduction should:
        - Be conversational and friendly, not overly formal
        - Mention specific aspects of the project that impressed the investor
        - Express genuine interest in learning more
        - Suggest a potential meeting or call
        - Be concise (150-200 words maximum)
        - Sound natural and authentic, like a real investor would write
        - Include a specific question about the project's technology, roadmap, or vision
        
        Tailor the message to sound like it's coming from the investor, mentioning their username.`
      },
      {
        role: 'user',
        content: `Please write an introduction message from investor @${investorUsername} to the founder of "${projectName}". 
        
        Project summary:
        ${projectSummary}`
      }
    ],
    temperature: 0.7, // Higher temperature for more creative, unique messages
    max_tokens: 400,
  });

  return response.choices[0].message.content;
};

module.exports = {
  summarizePitch,
  extractPitchDetails,
  analyzeFeedback,
  generateInvestmentThesis,
  generateIntroduction,
}; 