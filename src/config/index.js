require('dotenv').config();

module.exports = {
  telegram: {
    founderBotToken: process.env.FOUNDER_BOT_TOKEN,
    dealBotToken: process.env.DEAL_BOT_TOKEN,
    investorBotToken: process.env.INVESTOR_BOT_TOKEN,
    daoGroupId: process.env.DAO_GROUP_ID,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
  },
  blockchain: {
    daoPrivateKey: process.env.DAO_PRIVATE_KEY,
    baseSepolia: {
      rpc: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
      chainId: 84532,
    },
  },
  points: {
    pitchReview: 10,
    provideFeedback: 20,
    submitProposal: 30,
    voteOnProposal: 5,
  }
}; 