const { Telegraf, Markup, session } = require('telegraf');
const config = require('../config');
const dbModels = require('../database/models');
const openai = require('../utils/openai');
const supabase = require('../database/supabase');

// Initialize bot
const bot = new Telegraf(config.telegram.founderBotToken);

// Add session middleware
bot.use(session());

// Common messages
const WELCOME_MESSAGE = `
🚀 *Welcome to Rocky Founder Portal!* 🚀

I'm your AI-powered concierge, ready to help you connect with our investment DAO.

Got a hot project? Let's get you funded! 💰✨

*Just use /pitch to get started!*

Need to check progress? Try /status to see where things stand.
`;

const PITCH_INSTRUCTIONS = `
🔥 *Ready to WOW our investors?* 🔥

Give us ALL the juicy details about your project:

1️⃣ *Project name* - Make it memorable!
2️⃣ *Elevator pitch* - Hook us in 1-2 sentences
3️⃣ *Team background* - Who are the rockstars?
4️⃣ *Funding stage & amount* - What's your ask?
5️⃣ *Traction metrics* - Show off those numbers!
6️⃣ *Problem you're solving* - What's broken?
7️⃣ *Your solution* - How you're fixing it
8️⃣ *Target market* - Who needs this?
9️⃣ *Competitive edge* - Why you'll win
🔟 *Token/equity details* - What are we getting?
💼 *Ethereum wallet address* - Must be EVM compatible!
💰 *Funding amount* - How much ETH do you need?

Drop it all in ONE message, and let's make magic happen! ✨
`;

// COMMANDS - Register all commands first, before any other handlers
// ----------------------------------------------------------------

// Start command
bot.command('start', (ctx) => {
  console.log("START command triggered");
  ctx.reply(WELCOME_MESSAGE, { parse_mode: 'Markdown' });
});

// Help command
bot.command('help', (ctx) => {
  console.log("HELP command triggered");
  ctx.reply(`
🔍 *Rocky Founder Commands* 🔍

/pitch - Drop your next big idea on us!
/status - See if we're ready to throw money at you
/feedback - Check investor feedback on your pitches
/test - Check if I'm alive (I am!)
/help - Show this fancy menu again

Ready to change the world? Let's go! 🚀
  `, { parse_mode: 'Markdown' });
});

// Pitch submission process
bot.command('pitch', (ctx) => {
  console.log("PITCH command triggered");
  ctx.reply(PITCH_INSTRUCTIONS, { parse_mode: 'Markdown' });
  ctx.session = { ...ctx.session, awaitingPitch: true };
});

// Status check command
bot.command('status', (ctx) => {
  console.log("STATUS COMMAND TRIGGERED");
  ctx.reply("🔍 *Checking your pitch status...*", { parse_mode: 'Markdown' });
  
  try {
    const userId = ctx.from.id;
    console.log("User ID:", userId);
    
    // Query pitches by this user
    supabase
      .from('pitches')
      .select('*')
      .eq('telegram_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        console.log("Supabase query executed");
        
        if (error) {
          console.error('Error fetching pitch status:', error);
          return ctx.reply('Database error: ' + error.message);
        }
        
        console.log("Query result:", data);
        
        if (!data || data.length === 0) {
          return ctx.reply('📭 *Pitch inbox empty!*\n\nYou haven\'t submitted any pitches yet. Use /pitch to drop your big idea!', { parse_mode: 'Markdown' });
        }
        
        // Format all pitches in a nice message
        let message = '📊 *Your Pitch Status*\n\n';
        
        data.forEach((pitch, index) => {
          // Get project name from the summary
          const projectName = pitch.summary?.split('\n')[0].replace(/\*\*Project Name\*\*:|Project Name:|^\s*-\s*\*\*Project Name\*\*:/, '').trim() || `Pitch #${pitch.id}`;
          
          let statusEmoji = '';
          if (pitch.status === 'pending_review') statusEmoji = '⏳';
          else if (pitch.status === 'approved') statusEmoji = '✅';
          else if (pitch.status === 'rejected') statusEmoji = '❌';
          else if (pitch.status === 'needs_info') statusEmoji = '❓';
          else statusEmoji = '🔄';
          
          message += `${statusEmoji} *${projectName}* (ID: ${pitch.id})\n`;
          message += `   Status: *${pitch.status.replace(/_/g, ' ')}*\n`;
          message += `   Submitted: ${new Date(pitch.created_at).toLocaleDateString()}\n`;
          message += `   Funding: ${pitch.eth_amount} ETH\n\n`;
        });
        
        if (data.some(p => p.status === 'approved')) {
          message += '🎉 *Congrats on your funding!* Keep building great things!\n\n';
        } else if (data.some(p => p.status === 'pending_review')) {
          message += '👀 Our investors are looking at your pitch! Stay tuned!\n\n';
        }
        
        ctx.reply(message, { parse_mode: 'Markdown' });
      })
      .catch(err => {
        console.error("Supabase promise error:", err);
        ctx.reply('😵 Error querying database: ' + err.message);
      });
    
  } catch (error) {
    console.error('Top-level error in status command:', error);
    ctx.reply('🙈 *Something went wrong!*\n\nTry again later or ping our support team.', { parse_mode: 'Markdown' });
  }
});

// Test command to verify command handling works
bot.command('test', (ctx) => {
  console.log("TEST COMMAND TRIGGERED");
  ctx.reply("🔌 *Connection test successful!*\n\nI'm alive and ready to help founders change the world! 🌍", { parse_mode: 'Markdown' });
});

// Command to check feedback on pitches
bot.command('feedback', async (ctx) => {
  console.log("FEEDBACK command triggered");
  ctx.reply("🔍 *Checking investor feedback on your pitches...*", { parse_mode: 'Markdown' });
  
  try {
    const userId = ctx.from.id;
    console.log("User ID:", userId);
    
    // First, get all pitches by this user
    const { data: pitches, error: pitchError } = await supabase
      .from('pitches')
      .select('id, summary, created_at')
      .eq('telegram_id', userId)
      .order('created_at', { ascending: false });
    
    if (pitchError) {
      console.error('Error fetching user pitches:', pitchError);
      return ctx.reply('Database error: ' + pitchError.message);
    }
    
    if (!pitches || pitches.length === 0) {
      return ctx.reply('📭 *No pitches found!*\n\nYou haven\'t submitted any pitches yet. Use /pitch to drop your big idea!', { parse_mode: 'Markdown' });
    }
    
    // Initialize message
    let message = '💬 *Investor Feedback on Your Pitches*\n\n';
    let hasFeedback = false;
    
    // For each pitch, get the feedback
    for (const pitch of pitches) {
      // Extract project name
      const projectName = pitch.summary?.split('\n')[0].replace(/\*\*Project Name\*\*:|Project Name:|^\s*-\s*\*\*Project Name\*\*:/, '').trim() || `Pitch #${pitch.id}`;
      
      // Get feedback for this pitch
      const feedback = await dbModels.getFeedbackByPitchId(pitch.id);
      
      if (feedback && feedback.length > 0) {
        hasFeedback = true;
        message += `📝 *${projectName}* (ID: ${pitch.id})\n`;
        message += `   Submitted: ${new Date(pitch.created_at).toLocaleDateString()}\n\n`;
        
        // Add feedback items
        feedback.forEach((item, index) => {
          message += `   *Feedback #${index + 1}:*\n`;
          message += `   ${item.comment.replace(/\n/g, '\n   ')}\n\n`;
        });
        
        message += '   --------------------------\n\n';
      }
    }
    
    if (!hasFeedback) {
      message += 'No feedback has been received on your pitches yet. Keep promoting your ideas!\n\n';
      message += 'As investors review your pitches, their feedback will appear here.\n';
    } else {
      message += 'Use this valuable feedback to improve your project and increase your chances of success!\n';
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error retrieving feedback:', error);
    ctx.reply('🙈 *Something went wrong!*\n\nTry again later or ping our support team.', { parse_mode: 'Markdown' });
  }
});

// OTHER HANDLERS - Only after all commands are registered
// -------------------------------------------------------

// Handle pitch submissions
bot.on('text', async (ctx) => {
  // Ignore command messages (this check may not be needed now, but keep for safety)
  if (ctx.message.text.startsWith('/')) {
    console.log("Text handler ignoring command message:", ctx.message.text);
    return;
  }
  
  console.log("Text handler processing message:", ctx.message.text.substring(0, 20) + "...");
  
  // Only process if we're awaiting a pitch or in the context of a conversation about one
  if (ctx.session?.awaitingPitch) {
    try {
      const pitchText = ctx.message.text;
      
      // Check if pitch is long enough
      if (pitchText.length < 100) {
        return ctx.reply('🤏 *That\'s a bit short!*\n\nWe need more details to properly evaluate your project. Please follow the guidelines for a comprehensive pitch.', { parse_mode: 'Markdown' });
      }

      // Use OpenAI to extract wallet address and funding amount
      const pitchDetails = await openai.extractPitchDetails(pitchText);
      
      // Validate extracted information
      if (!pitchDetails.valid) {
        return ctx.reply(`
❌ *Missing Information Alert!* ❌

We couldn't find all the required details in your pitch.

${pitchDetails.message || ''}

*Please make sure to include:*
1. Your Ethereum wallet address (starting with 0x)
2. The amount of ETH you're requesting

For example: "We are requesting 5 ETH to be sent to our treasury at 0x123abc..."
        `, { parse_mode: 'Markdown' });
      }

      // Use OpenAI to summarize and structure the pitch
      const summarizedPitch = await openai.summarizePitch(pitchText);
      
      // Convert from Markdown to plaintext
      const plainSummary = summarizedPitch.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
      
      // Store in database
      const userId = ctx.from.id;
      const username = ctx.from.username || `user_${userId}`;
      
      const pitchData = {
        telegram_id: userId,
        telegram_username: username,
        raw_pitch: pitchText,
        summary: plainSummary,
        status: 'pending_review',
        eth_address: pitchDetails.eth_address,
        eth_amount: pitchDetails.eth_amount
      };
      
      const savedPitch = await dbModels.createPitch(pitchData);
      
      // Reset session state
      ctx.session.awaitingPitch = false;
      
      // Thank the user and provide next steps
      await ctx.reply(`
🎉 *Pitch Submitted Successfully!* 🎉

*Pitch ID:* ${savedPitch.id}

We've recorded your funding request for *${pitchDetails.eth_amount} ETH* to be sent to:
\`${pitchDetails.eth_address}\`

*What happens next?*
• Our DAO members will review your pitch
• You'll receive notifications about status changes
• You can check anytime with /status

Hang tight while we find you some funding! 💰
      `, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error('Error processing pitch:', error);
      ctx.reply('😱 *Oops, something went wrong!*\n\nOur system had a hiccup processing your pitch. Please try again in a few minutes.', { parse_mode: 'Markdown' });
    }
  } else {
    // General response if not in pitch mode
    ctx.reply(`
👋 *Hey there!*

Looking to submit a pitch? Just use /pitch to get started!

Need a refresher on commands? Try /help
    `, { parse_mode: 'Markdown' });
  }
});

// Notification methods (to be called by deal bot)
const notifyFounderOfApproval = async (pitchId, txHash, amount) => {
  try {
    console.log(`Notifying founder of pitch ${pitchId} approval`);
    
    // Get the pitch details
    const pitch = await dbModels.getPitchById(pitchId);
    
    if (!pitch) {
      console.error(`Cannot notify founder: Pitch ${pitchId} not found`);
      return;
    }
    
    // Get the founder's Telegram ID
    const founderId = pitch.telegram_id;
    
    if (!founderId) {
      console.error(`Cannot notify founder: No Telegram ID for pitch ${pitchId}`);
      return;
    }
    
    // Extract project name
    const projectName = pitch.summary?.split('\n')[0].replace(/\*\*Project Name\*\*:|Project Name:|^\s*-\s*\*\*Project Name\*\*:/, '').trim() || `Pitch #${pitch.id}`;
    
    // Check if there's feedback available
    const feedback = await dbModels.getFeedbackByPitchId(pitchId);
    const hasFeedback = feedback && feedback.length > 0;
    
    // Send notification
    await bot.telegram.sendMessage(founderId, `
🎉 *CONGRATULATIONS!* 🎉

Your project "${projectName}" has been approved for funding!

💰 ${amount} ETH has been sent to your wallet!
🧾 Transaction Hash: \`${txHash}\`
🔍 View on Explorer: [BaseScan](https://sepolia.basescan.org/tx/${txHash})

${hasFeedback ? '💬 *You have received investor feedback!* Check it out with /feedback\n\n' : ''}
What's next?
• Use the funds to build something amazing
• Keep the DAO updated on your progress
• Consider joining our founder community

Thank you for being part of our ecosystem! 🚀
    `, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
    
    console.log(`Successfully notified founder ${founderId} about pitch ${pitchId} approval`);
    return true;
  } catch (error) {
    console.error('Error notifying founder:', error);
    return false;
  }
};

const notifyFounderOfRejection = async (pitchId) => {
  try {
    // Get the pitch details
    const pitch = await dbModels.getPitchById(pitchId);
    if (!pitch || !pitch.telegram_id) {
      console.error(`Cannot notify founder: no pitch found with ID ${pitchId} or missing telegram_id`);
      return false;
    }
    
    // Extract project name
    const projectName = pitch.summary?.split('\n')[0].replace(/\*\*Project Name\*\*:|Project Name:|^\s*-\s*\*\*Project Name\*\*:/, '').trim() || `Pitch #${pitch.id}`;
    
    // Send notification to the founder
    await bot.telegram.sendMessage(pitch.telegram_id, `
🔴 *PITCH UPDATE: NOT APPROVED* 🔴

We've completed our review of your pitch for *${projectName}*.

Unfortunately, the DAO has decided not to fund this project at this time.

This doesn't mean your idea isn't valuable! We encourage you to:
• Refine your pitch based on any feedback received
• Consider reapplying with updates in the future
• Connect with other investors in our network

Keep building! The right funding will come. 💪
    `, { parse_mode: 'Markdown' });
    
    console.log(`Sent rejection notification to founder of pitch #${pitchId}`);
    return true;
  } catch (error) {
    console.error('Error notifying founder of rejection:', error);
    return false;
  }
};

// Error handling
bot.catch((err, ctx) => {
  console.error('Telegram error:', err);
  ctx.reply('🔥 *Uh oh!* Something went wrong. Please try again later.', { parse_mode: 'Markdown' });
});

module.exports = {
  bot,
  start: () => {
    bot.launch()
      .then(() => {
        console.log('Founder bot started. Commands registered:');
        console.log('- /start');
        console.log('- /help');
        console.log('- /pitch');
        console.log('- /status');
        console.log('- /test');
        console.log('- /feedback');
      })
      .catch(err => {
        console.error('Failed to start founder bot:', err);
      });
  },
  stop: () => {
    bot.stop();
  },
  // Export notification methods so they can be called by the deal bot
  notifyFounderOfApproval,
  notifyFounderOfRejection
}; 