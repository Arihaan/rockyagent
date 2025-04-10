# Rocky: AI-Powered Investment DAO Framework

<img width="921" alt="Screenshot 2025-04-10 at 2 56 52 am" src="https://github.com/user-attachments/assets/c350134d-481c-429e-9688-be5fabe96b41" />

Rocky is an agent framework designed for investment DAOs that streamlines processes, crowdsources group knowledge, and accelerates idea execution. The framework consists of three Telegram bots that work together to manage the entire investment process from pitch submission to execution.

## 🤖 Bot Agents

### Agent 1: Founder Bot
- Speaks to inbound founders via Telegram DMs
- Collects and processes pitch submissions
- Uses GPT-4o to structure and summarize pitches
- Provides founders with status updates on their pitches

### Agent 2: Deal Bot
- Shares pitch summaries with DAO members in the group chat
- Facilitates deal discussions and voting
- Manages proposal creation and feedback collection
- Executes approved investment proposals with on-chain transactions
- Shows treasury balance and transaction history
- Implements a points system to reward member contributions

### Agent 3: Investor Bot
- Serves individual DAO members for private interactions
- Allows members to request founder contact information
- Provides personalized AI-generated introductions to founders
- Enables private feedback submission on pitches
- Shows detailed project information

## 📊 Database Structure (Supabase)

- **Pitches**: Stores founder pitches and their current status
- **Proposals**: Contains investment proposals and voting status
- **Feedback**: Tracks member feedback on pitches for founder review
- **Votes**: Records member votes on proposals
- **Members**: Manages member data and points
- **Points Transactions**: Logs all points awarded to members

## 💰 Blockchain Integration

- Connects to Base Sepolia Testnet (Chain ID: 84532)
- Manages DAO treasury wallet
- Executes on-chain transactions when proposals are approved
- Provides transaction verification and explorer links

## 🏆 Points System

Members earn points for various contributions:
- Reviewing pitches: 10 points
- Providing feedback: 15 points
- Viewing pitch details: 5 points
- Generating founder introductions: 15 points
- Voting on proposals: 5 points
- Executing proposals: 50 points

## 🔧 Setup & Installation

### Prerequisites
- Node.js (v14+)
- Supabase account
- Telegram Bot tokens (3 separate bots)
- Base Sepolia wallet with some testnet ETH

### Installation Steps

1. Clone the repository:
   ```
   git clone https://github.com/Arihaan/rockyagent.git
   cd rockyagent
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```
   cp .env.example .env
   ```

4. Set up your environment variables:
   - Telegram Bot Tokens (create 3 bots via [@BotFather](https://t.me/BotFather))
   - Supabase credentials (URL and Key)
   - OpenAI API Key for GPT-4o
   - Private key for DAO wallet (Base Sepolia testnet)
   - DAO_GROUP_ID (your Telegram group ID)

5. Start the application:
   ```
   npm start
   ```

## 📱 Usage

### For Founders
- Start a conversation with the Founder Bot
- Use `/pitch` to submit a new project
- Use `/status` to check on your pitch status
- Use `/feedback` to view investor feedback on your pitches

### For DAO Members
- Use Deal Bot in your DAO group
- View active deals with `/deals`
- Check specific deals with `/deal_ID`
- Vote on deals using approval/rejection buttons
- Check the leaderboard with `/leaderboard`
- Check treasury balance with `/balance`

### For Investors
- Use Investor Bot for personalized interactions
- View project details with `/details ID`
- Generate founder introductions with `/intro ID`
- Provide feedback on projects with `/feedback ID`

## 🛠️ Technical Architecture

- **Node.js** backend for all bot logic
- **Telegraf** framework for Telegram bot interactions
- **Supabase** for database storage
- **OpenAI GPT-4o** for NLP tasks (pitch summarization, feedback analysis)
- **ethers.js** for blockchain interactions

## 📈 Advantages

1. **Streamlined Investment Process**: Automates the collection, sharing, and execution of investment opportunities
2. **Member Incentivization**: Points system rewards active participation and quality contributions
3. **Transparent Decision-Making**: All proposals, votes, and transactions are recorded and accessible
4. **Reduced Operational Overhead**: Bots handle routine tasks, freeing members to focus on evaluation
5. **On-Chain Execution**: Seamless transition from DAO decisions to blockchain transactions
6. **Enhanced Communication**: Feedback system enables founders to improve based on investor insights

## 🔍 Future Enhancements

- Integration with additional blockchains beyond Base
- Smart contract deployment for proposal voting and execution
- Advanced analytics dashboard for DAO performance
- Integration with DeFi protocols for treasury management
- Multi-signature wallet support for enhanced security

## 📄 License

MIT License

## 🙏 Acknowledgements

- Thanks to RockawayX and Imperial College London for providing the hackathon opportunity
- OpenAI for GPT-4o API
- Base for the developer-friendly L2 ecosystem 
