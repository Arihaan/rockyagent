require('dotenv').config();

const founderBot = require('./bots/founderBot');
const dealBot = require('./bots/dealBot');
const investorBot = require('./bots/investorBot');
const supabase = require('./database/supabase');

// Handle termination gracefully
const handleShutdown = () => {
  console.log('Shutting down bots...');
  
  try {
    founderBot.stop();
    dealBot.stop();
    investorBot.stop();
  } catch (error) {
    console.error('Error shutting down bots:', error);
  }
  
  console.log('Shutdown complete');
  process.exit(0);
};

// Register shutdown handlers
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

// Main initialization
const initializeApp = async () => {
  console.log('Starting Rocky agent framework...');
  
  try {
    // Check Supabase connection
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase.from('pitches').select('id').limit(1);
    
    if (error) {
      console.error('Supabase connection failed:', error);
      
      // Create tables if they don't exist
      console.log('Attempting to create required tables...');
      
      // Create pitches table
      await supabase.schema.createTable('pitches', table => {
        table.increments('id');
        table.integer('telegram_id');
        table.string('telegram_username');
        table.text('raw_pitch');
        table.text('summary');
        table.string('status').defaultTo('pending_review');
        table.boolean('announced').defaultTo(false);
        table.string('eth_address');
        table.decimal('eth_amount', 20, 18).defaultTo(0);
        table.timestamps(true, true);
      }).catch(e => console.error('Error creating pitches table:', e));
      
      // Create proposals table
      await supabase.schema.createTable('proposals', table => {
        table.increments('id');
        table.integer('pitch_id').references('pitches.id');
        table.string('title');
        table.text('description');
        table.string('status').defaultTo('voting');
        table.integer('created_by');
        table.string('tx_hash');
        table.timestamps(true, true);
      }).catch(e => console.error('Error creating proposals table:', e));
      
      // Create feedback table
      await supabase.schema.createTable('feedback', table => {
        table.increments('id');
        table.integer('pitch_id').references('pitches.id');
        table.integer('telegram_id');
        table.string('telegram_username');
        table.text('comment');
        table.string('type').defaultTo('feedback');
        table.timestamps(true, true);
      }).catch(e => console.error('Error creating feedback table:', e));
      
      // Create votes table
      await supabase.schema.createTable('votes', table => {
        table.increments('id');
        table.integer('proposal_id').references('proposals.id');
        table.integer('telegram_id');
        table.string('telegram_username');
        table.string('vote');
        table.timestamps(true, true);
      }).catch(e => console.error('Error creating votes table:', e));
      
      // Create members table
      await supabase.schema.createTable('members', table => {
        table.increments('id');
        table.integer('telegram_id').unique();
        table.string('telegram_username');
        table.integer('points').defaultTo(0);
        table.timestamps(true, true);
      }).catch(e => console.error('Error creating members table:', e));
      
      // Create points transactions table
      await supabase.schema.createTable('points_transactions', table => {
        table.increments('id');
        table.integer('telegram_id');
        table.integer('points');
        table.string('reason');
        table.timestamps(true, true);
      }).catch(e => console.error('Error creating points_transactions table:', e));
      
      console.log('Tables created successfully');
    } else {
      console.log('Supabase connection successful');
    }
    
    // Start bots
    console.log('Starting Telegram bots...');
    
    // Check for bot tokens
    if (!process.env.FOUNDER_BOT_TOKEN) {
      console.warn('⚠️ FOUNDER_BOT_TOKEN not set. Founder bot will not start.');
    } else {
      founderBot.start();
    }
    
    if (!process.env.DEAL_BOT_TOKEN) {
      console.warn('⚠️ DEAL_BOT_TOKEN not set. Deal bot will not start.');
    } else {
      dealBot.start();
    }
    
    if (!process.env.INVESTOR_BOT_TOKEN) {
      console.warn('⚠️ INVESTOR_BOT_TOKEN not set. Investor bot will not start.');
    } else {
      investorBot.start();
    }
    
    console.log('Rocky agent framework is running!');
    console.log(`
🤖 Agent Framework Status:
- Founder Bot (Agent 1): ${process.env.FOUNDER_BOT_TOKEN ? '✅ Running' : '❌ Not running'}
- Deal Bot (Agent 2): ${process.env.DEAL_BOT_TOKEN ? '✅ Running' : '❌ Not running'}
- Investor Bot (Agent 3): ${process.env.INVESTOR_BOT_TOKEN ? '✅ Running' : '❌ Not running'}

📊 Database: ${!error ? '✅ Connected' : '❌ Connection issues'}
💰 Blockchain: Connected to Base Sepolia (Chain ID: 84532)
    `);
    
  } catch (error) {
    console.error('Error during initialization:', error);
    process.exit(1);
  }
};

// Start the app
initializeApp(); 