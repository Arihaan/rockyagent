const { Telegraf, Markup, session } = require('telegraf');
const config = require('../config');
const dbModels = require('../database/models');
const supabase = require('../database/supabase');
const openai = require('../utils/openai');
const cron = require('node-cron');
const wallet = require('../blockchain/wallet');
const fs = require('fs');
const path = require('path');
const founderBot = require('./founderBot');

// Setup logging to file
const logFile = path.join(__dirname, '../../deal_bot_debug.log');
const writeToLog = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFile, logMessage);
  console.log(message);
};

// Initialize bot
const bot = new Telegraf(config.telegram.dealBotToken);

// Log startup
writeToLog('Deal bot module loaded');

// Add session middleware
bot.use(session());

// Get the DAO group ID from config
const DAO_GROUP_ID = config.telegram.daoGroupId;

// Global command handler for debugging
bot.use((ctx, next) => {
  // Log every incoming update
  console.log('⚡ INCOMING UPDATE:', ctx.updateType);
  
  if (ctx.updateType === 'message' && ctx.message?.text?.startsWith('/')) {
    const command = ctx.message.text.split(' ')[0].split('@')[0];
    console.log('⚡ COMMAND DETECTED:', command);
    console.log('⚡ FROM:', ctx.from?.username || 'unknown', 'ID:', ctx.from?.id);
    console.log('⚡ CHAT:', ctx.chat.type, 'ID:', ctx.chat.id);
  }
  
  // Continue processing
  return next();
});

// Middleware to check if message is in DAO group
const isGroupMsg = (ctx, next) => {
  console.log('isGroupMsg middleware called');
  console.log('Chat type:', ctx.chat.type);
  console.log('Chat ID:', ctx.chat.id);
  console.log('DAO_GROUP_ID:', DAO_GROUP_ID);
  
  // TEMPORARILY BYPASS GROUP CHECK
  console.log('⚠️ BYPASSING GROUP CHECK - ALLOWING ALL COMMANDS');
  return next();
  
  /*
  if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
    if (DAO_GROUP_ID && ctx.chat.id.toString() !== DAO_GROUP_ID.toString()) {
      console.log('Command rejected: Not in the configured DAO group');
      return ctx.reply('This command is only available in the main DAO group.');
    }
    console.log('Command accepted: In a valid group chat');
    return next();
  }
  console.log('Command rejected: Not in a group chat');
  ctx.reply('This command is only available in the DAO group.');
  */
};

// Start command
bot.start((ctx) => {
  ctx.reply(`
👋 Welcome to Rocky Deal Bot!

I'm here to help the DAO find the next big thing in crypto. I'll announce new investment opportunities and help you vote on them! 

*Here's what I can do:*
• /deals - Check out all the hot deals in our pipeline
• /leaderboard - See who's contributing the most to our DAO
• /help - Get the full lowdown on my commands

Let's find some unicorns together! 💰✨
  `, { parse_mode: 'Markdown' });
});

// Help command
bot.help((ctx) => {
  ctx.reply(`
🤖 *Rocky's Command Center* 🤖

*For everyone:*
• /deals - See all investment opportunities
• /deal\\_ID - Get the juicy details on a specific deal (replace ID with number)
• /leaderboard - Who's our top contributor?
• /balance - How much ETH do we have to invest?

*For DAO members:*
• Just use the buttons to vote on deals!

Remember, when we approve deals and vote YES, funds automatically move when we hit the threshold!

Let's make some money together! 💸
  `, { parse_mode: 'Markdown' });
});

// --- CRITICAL COMMANDS - REGISTER EARLY ---

// Debug command to show database status
bot.command('dbstatus', async (ctx) => {
  console.log('⚠️ DATABASE STATUS CHECK REQUESTED');
  
  try {
    await ctx.reply('🔍 Checking database status...');
    
    const supabaseClient = (dbModels && dbModels.supabase) ? dbModels.supabase : supabase;
    
    if (!supabaseClient) {
      return ctx.reply('❌ No supabase client available');
    }
    
    // Get all pitches
    const { data: pitches, error } = await supabaseClient
      .from('pitches')
      .select('id, telegram_username, status, announced, created_at');
    
    if (error) {
      console.error('Error fetching pitches:', error);
      return ctx.reply(`❌ Database error: ${error.message}`);
    }
    
    if (!pitches || pitches.length === 0) {
      return ctx.reply('No pitches found in the database.');
    }
    
    // Format message
    let message = '📊 <b>Database Status</b>\n\n';
    message += `<b>Total pitches:</b> ${pitches.length}\n\n`;
    message += '<b>Pitch Details:</b>\n';
    
    pitches.forEach(pitch => {
      const date = new Date(pitch.created_at).toLocaleString();
      message += `\n<b>ID ${pitch.id}</b> by @${pitch.telegram_username || 'unknown'}\n`;
      message += `Status: ${pitch.status}, Announced: ${pitch.announced ? 'Yes' : 'No'}\n`;
      message += `Created: ${date}\n`;
    });
    
    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error in database status command:', error);
    await ctx.reply(`❌ Error checking database: ${error.message}`);
  }
});

// Admin command to test group messaging
bot.command('testgroup', async (ctx) => {
  console.log('⚠️ TEST GROUP MESSAGE REQUESTED');
  console.log('Chat ID:', ctx.chat.id);
  
  try {
    // Send a test message to the configured group
    if (!DAO_GROUP_ID) {
      return ctx.reply('⚠️ No DAO_GROUP_ID configured. Please set this in .env file.');
    }
    
    try {
      console.log(`Attempting to send test message to group ${DAO_GROUP_ID}`);
      
      // Test simple text message
      await bot.telegram.sendMessage(
        DAO_GROUP_ID,
        'TEST MESSAGE: If you can see this, the bot can send messages to this group.',
      );
      
      await ctx.reply(`✅ Test message sent to group ${DAO_GROUP_ID}`);
    } catch (error) {
      console.error('❌ Error sending test message to group:', error);
      await ctx.reply(`❌ Failed to send message to group ${DAO_GROUP_ID}: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in test group command:', error);
    await ctx.reply('❌ Error processing command');
  }
});

// View leaderboard
bot.command('leaderboard', async (ctx) => {
  console.log('⚠️ LEADERBOARD COMMAND TRIGGERED');
  console.log('Chat ID:', ctx.chat.id);
  
  try {
    console.log('Fetching leaderboard data...');
    
    // First try with the model function
    const members = await dbModels.getLeaderboard();
    console.log('Leaderboard data from models:', JSON.stringify(members));
    
    // If that fails, try a direct query
    if (!members || members.length === 0) {
      console.log('No members found using model, trying direct query...');
      const { data: directMembers, error } = await supabase
        .from('members')
        .select('*')
        .order('points', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error('Error in direct query:', error);
        return ctx.reply('No one has earned points yet. Be the first! 🏆');
      }
      
      console.log('Direct query members:', JSON.stringify(directMembers));
      
      if (!directMembers || directMembers.length === 0) {
        return ctx.reply('No one has earned points yet. Be the first! 🏆');
      }
      
      let message = '🏆 <b>TOP DAO CONTRIBUTORS</b> 🏆\n\n';
      
      directMembers.forEach((member, index) => {
        let medal = '';
        if (index === 0) medal = '🥇';
        else if (index === 1) medal = '🥈';
        else if (index === 2) medal = '🥉';
        else medal = `${index + 1}.`;
        
        // More personality
        let emoji = '';
        if (index === 0) emoji = ' 👑';
        else if (index < 3) emoji = ' 🌟';
        else if (index < 5) emoji = ' 💪';
        
        message += `${medal} @${member.telegram_username}: <b>${member.points} points</b>${emoji}\n`;
      });
      
      message += '\n<i>Earn points by voting on deals and being active in the DAO!</i>';
      
      return ctx.reply(message, { parse_mode: 'HTML' });
    }
    
    // Original code for handling members if found via model
    let message = '🏆 <b>TOP DAO CONTRIBUTORS</b> 🏆\n\n';
    
    members.forEach((member, index) => {
      let medal = '';
      if (index === 0) medal = '🥇';
      else if (index === 1) medal = '🥈';
      else if (index === 2) medal = '🥉';
      else medal = `${index + 1}.`;
      
      // More personality
      let emoji = '';
      if (index === 0) emoji = ' 👑';
      else if (index < 3) emoji = ' 🌟';
      else if (index < 5) emoji = ' 💪';
      
      message += `${medal} @${member.telegram_username}: <b>${member.points} points</b>${emoji}\n`;
    });
    
    message += '\n<i>Earn points by voting on deals and being active in the DAO!</i>';
    
    return ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error in leaderboard command:', error);
    return ctx.reply('Sorry, there was an error fetching the leaderboard.');
  }
});

// Check DAO treasury balance
bot.command('balance', async (ctx) => {
  console.log('⚠️ BALANCE COMMAND TRIGGERED');
  console.log('Chat ID:', ctx.chat.id);
  
  try {
    console.log('Fetching wallet balance...');
    const balance = await wallet.getWalletBalance();
    console.log('Wallet balance:', balance);
    
    return ctx.reply(`
💰 <b>DAO TREASURE CHEST</b> 💰

<b>${balance || '0'} ETH</b> in the vault! 

Wallet: <code>${wallet.daoWallet?.address || 'Not configured'}</code>

${parseFloat(balance) > 5 ? 'We\'re loaded! Let\'s find some deals! 🤑' : 
  parseFloat(balance) > 1 ? 'Looking good! Ready to invest! 👍' : 
  parseFloat(balance) > 0.1 ? 'We could use more funds soon! 👀' : 
  'Our treasury is running low! Time to add more ETH! 😱'}
    `, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error in balance command:', error);
    return ctx.reply('Oops! I dropped the calculator while checking our balance. Can you try again? 🧮');
  }
});

// Admin command to force check for new pitches
bot.command('checkpitches', async (ctx) => {
  console.log('⚠️ MANUAL PITCH CHECK REQUESTED');
  console.log('Chat ID:', ctx.chat.id);
  
  try {
    // Inform user that check is starting
    await ctx.reply('🔍 Manually checking for new pitches...');
    
    // Run the check
    try {
      await checkForNewPitches();
      // Inform user that check is complete
      await ctx.reply('✅ Manual pitch check completed!');
    } catch (checkError) {
      console.error('Error during manual pitch check:', checkError);
      await ctx.reply(`❌ Error during check: ${checkError.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error in manual pitch check command:', error);
    try {
      await ctx.reply('❌ Error processing command');
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
    }
  }
});

// Admin command to reset announcement status for a pitch
bot.command('resetannounce', async (ctx) => {
  console.log('⚠️ RESET ANNOUNCEMENT STATUS REQUESTED');
  
  // Extract the pitch ID from the command
  const text = ctx.message.text.trim();
  const match = text.match(/^\/resetannounce(?:\s+(\d+))?$/);
  const pitchId = match ? match[1] : null;
  
  if (!pitchId) {
    return ctx.reply('❓ Please specify a pitch ID. Example: /resetannounce 1');
  }
  
  try {
    await ctx.reply(`🔄 Resetting announcement status for pitch #${pitchId}...`);
    
    const supabaseClient = (dbModels && dbModels.supabase) ? dbModels.supabase : supabase;
    
    if (!supabaseClient) {
      return ctx.reply('❌ No supabase client available');
    }
    
    // First check if the pitch exists
    const { data: pitch, error: fetchError } = await supabaseClient
      .from('pitches')
      .select('id, status, announced')
      .eq('id', pitchId)
      .single();
    
    if (fetchError) {
      console.error(`Error fetching pitch #${pitchId}:`, fetchError);
      return ctx.reply(`❌ Database error: ${fetchError.message}`);
    }
    
    if (!pitch) {
      return ctx.reply(`❌ Pitch #${pitchId} not found.`);
    }
    
    // Update the pitch to be unannounced
    const { error: updateError } = await supabaseClient
      .from('pitches')
      .update({ announced: false })
      .eq('id', pitchId);
    
    if (updateError) {
      console.error(`Error updating pitch #${pitchId}:`, updateError);
      return ctx.reply(`❌ Failed to update: ${updateError.message}`);
    }
    
    await ctx.reply(`✅ Pitch #${pitchId} has been marked as unannounced.\n\nUse /checkpitches to trigger an immediate check.`);
  } catch (error) {
    console.error('Error in reset announcement command:', error);
    await ctx.reply(`❌ Error: ${error.message}`);
  }
});

// Admin command to manually announce a specific pitch
bot.command('announce', async (ctx) => {
  console.log('⚠️ MANUAL PITCH ANNOUNCEMENT REQUESTED');
  
  // Extract the pitch ID from the command
  const text = ctx.message.text.trim();
  const match = text.match(/^\/announce(?:\s+(\d+))?$/);
  const pitchId = match ? match[1] : null;
  
  if (!pitchId) {
    return ctx.reply('❓ Please specify a pitch ID. Example: /announce 1');
  }
  
  try {
    await ctx.reply(`🔄 Manually announcing pitch #${pitchId}...`);
    
    // Get the pitch details
    const { data: pitch, error } = await supabase
      .from('pitches')
      .select('*')
      .eq('id', pitchId)
      .single();
    
    if (error) {
      console.error(`Error fetching pitch #${pitchId}:`, error);
      return ctx.reply(`❌ Database error: ${error.message}`);
    }
    
    if (!pitch) {
      return ctx.reply(`❌ Pitch #${pitchId} not found.`);
    }
    
    // Extract project name with better hyphen handling
    const projectName = pitch.summary?.split('\n')[0]
      .replace(/\*\*Project Name\*\*:|Project Name:|^\s*-\s*\*\*Project Name\*\*:/, '')
      .replace(/^[-–—]\s*/, '') // Remove any leading dash or hyphen
      .trim() || `Pitch #${pitch.id}`;
    
    // Create announcement message
    const message = `🚨 <b>HOT NEW INVESTMENT ALERT!</b> 🚨

💰 "<b>${projectName}</b>" just dropped their pitch!

This could be the next big thing! Check it out by typing:
/deal_${pitch.id}

Don't miss your chance to vote on this opportunity! 🔥`;
    
    try {
      // Send to the group
      console.log(`Sending announcement for pitch #${pitchId} to group ${DAO_GROUP_ID}`);
      await bot.telegram.sendMessage(DAO_GROUP_ID, message, { parse_mode: 'HTML' });
      
      // Mark as announced
      await supabase
        .from('pitches')
        .update({ announced: true })
        .eq('id', pitchId);
      
      await ctx.reply(`✅ Pitch #${pitchId} has been announced successfully!`);
    } catch (sendError) {
      console.error('Error sending manual announcement:', sendError);
      await ctx.reply(`❌ Error sending announcement: ${sendError.message}`);
    }
  } catch (error) {
    console.error('Error in manual announcement command:', error);
    await ctx.reply(`❌ Error: ${error.message}`);
  }
});

// --- END CRITICAL COMMANDS ---

// View all active deals
bot.command('deals', async (ctx) => {
  try {
    const pitches = await dbModels.getAllPitches();
    
    if (!pitches || pitches.length === 0) {
      return ctx.reply('📭 No deals in the pipeline right now. Check back later!');
    }
    
    const pendingPitches = pitches.filter(p => p.status === 'pending_review');
    const approvedPitches = pitches.filter(p => p.status === 'approved');
    const rejectedPitches = pitches.filter(p => p.status === 'rejected');
    
    let message = '💼 <b>INVESTMENT OPPORTUNITIES</b> 💼\n\n';
    
    // Helper to extract clean project name
    const extractProjectName = (pitch) => {
      return pitch.summary?.split('\n')[0]
        .replace(/\*\*Project Name\*\*:|Project Name:|^\s*-\s*\*\*Project Name\*\*:/, '')
        .replace(/^[-–—]\s*/, '') // Remove any leading dash or hyphen
        .trim() || `Pitch #${pitch.id}`;
    };
    
    if (pendingPitches.length > 0) {
      message += '🔍 <b>Ready For Your Vote:</b>\n';
      pendingPitches.forEach(pitch => {
        const projectName = extractProjectName(pitch);
        message += `• <b>${projectName}</b> - /deal_${pitch.id}\n`;
      });
      message += '\n';
    }
    
    if (approvedPitches.length > 0) {
      message += '✅ <b>Funded Deals:</b>\n';
      approvedPitches.forEach(pitch => {
        const projectName = extractProjectName(pitch);
        message += `• <b>${projectName}</b> - ${pitch.eth_amount} ETH - /deal_${pitch.id}\n`;
      });
      message += '\n';
    }
    
    if (rejectedPitches.length > 0) {
      message += '❌ <b>Rejected Deals:</b>\n';
      rejectedPitches.forEach(pitch => {
        const projectName = extractProjectName(pitch);
        message += `• <b>${projectName}</b> - /deal_${pitch.id}\n`;
      });
    }
    
    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error fetching deals:', error);
    ctx.reply('Oops, I dropped the ball while fetching those deals. Can you try again? 🏀');
  }
});

// View specific deal details
bot.hears(/^\/deal(?:_|\s+)(\d+)$/, async (ctx) => {
  try {
    const pitchId = ctx.match[1];
    const pitch = await dbModels.getPitchById(pitchId);
    
    if (!pitch) {
      return ctx.reply(`Deal with ID ${pitchId} was not found. Did someone send you to a dead end? 🤔`);
    }
    
    // Extract project name with better hyphen handling
    const projectName = pitch.summary?.split('\n')[0]
      .replace(/\*\*Project Name\*\*:|Project Name:|^\s*-\s*\*\*Project Name\*\*:/, '')
      .replace(/^[-–—]\s*/, '') // Remove any leading dash or hyphen
      .trim();
    
    // Format message
    let message = `🚀 <b>PROJECT DETAILS: ${projectName}</b>\n\n`;
    
    // Convert markdown to HTML with emojis for each section
    const summaryLines = pitch.summary.split('\n');
    let htmlSummary = '';
    
    summaryLines.forEach(line => {
      // Remove dash prefix and trim
      let cleanLine = line.replace(/^\s*-\s*/, '').trim();
      if (!cleanLine) return; // Skip empty lines
      
      // Add emojis based on section content
      if (cleanLine.toLowerCase().includes('project name')) {
        htmlSummary += `🏷️ ${formatDealSummary(cleanLine)}\n`;
      } else if (cleanLine.toLowerCase().includes('description') || cleanLine.toLowerCase().includes('one-line')) {
        htmlSummary += `📝 ${formatDealSummary(cleanLine)}\n`;
      } else if (cleanLine.toLowerCase().includes('founder')) {
        htmlSummary += `👥 ${formatDealSummary(cleanLine)}\n`;
      } else if (cleanLine.toLowerCase().includes('funding') || cleanLine.toLowerCase().includes('raising')) {
        htmlSummary += `💰 ${formatDealSummary(cleanLine)}\n`;
      } else if (cleanLine.toLowerCase().includes('traction') || cleanLine.toLowerCase().includes('metrics')) {
        htmlSummary += `📈 ${formatDealSummary(cleanLine)}\n`;
      } else if (cleanLine.toLowerCase().includes('technology') || cleanLine.toLowerCase().includes('product')) {
        htmlSummary += `⚙️ ${formatDealSummary(cleanLine)}\n`;
      } else if (cleanLine.toLowerCase().includes('market') || cleanLine.toLowerCase().includes('competitors')) {
        htmlSummary += `🌎 ${formatDealSummary(cleanLine)}\n`;
      } else if (cleanLine.toLowerCase().includes('value proposition') || cleanLine.toLowerCase().includes('competitive')) {
        htmlSummary += `🏆 ${formatDealSummary(cleanLine)}\n`;
      } else if (cleanLine.toLowerCase().includes('use of funds')) {
        htmlSummary += `💸 ${formatDealSummary(cleanLine)}\n`;
      } else {
        htmlSummary += `${formatDealSummary(cleanLine)}\n`;
      }
    });
    
    message += htmlSummary;
    
    message += `\n<b>💼 Funding Request:</b> ${pitch.eth_amount} ETH`;
    message += `\n<b>🧩 Wallet Address:</b> <code>${pitch.eth_address}</code>`;
    message += `\n<b>🏛️ Status:</b> ${pitch.status}`;
    message += `\n<b>📅 Submitted:</b> ${new Date(pitch.created_at).toLocaleDateString()}`;
    
    // Only show action buttons if the pitch is pending review
    if (pitch.status === 'pending_review') {
      // Add action buttons - simplified to just approve/reject
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('👍 Approve', `approve_${pitchId}`),
          Markup.button.callback('👎 Reject', `reject_${pitchId}`)
        ]
      ]);
      
      await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
    } else {
      // For approved/rejected pitches, just show the status without buttons
      await ctx.reply(message, { parse_mode: 'HTML' });
    }
  } catch (error) {
    console.error('Error fetching deal details:', error);
    ctx.reply('Oops! I fumbled the ball while fetching those details. Can you try again? 🏈');
  }
});

// Register direct callback handlers for exact strings
// First, we'll create a helper function to register explicit handlers
const registerExactCallbackHandlers = () => {
  // Get all the pitches and register handlers for them
  supabase
    .from('pitches')
    .select('id')
    .then(({ data }) => {
      if (!data) return;
      
      console.log(`Registering explicit handlers for ${data.length} pitches`);
      
      // For each pitch, register explicit callback handlers
      data.forEach(pitch => {
        const id = pitch.id;
        
        // Approval confirmation
        const confirmApproveCallback = `confirm_approve_${id}`;
        bot.action(confirmApproveCallback, async (ctx) => {
          console.log(`EXACT CONFIRM APPROVE triggered for ${id}`);
          
          try {
            // Same logic as the regex handler
            if (!ctx.session?.pendingApproval || 
                ctx.session.pendingApproval.pitchId !== id.toString() || 
                ctx.session.pendingApproval.userId !== ctx.from.id) {
              await ctx.answerCbQuery('Nice try! But you can only confirm your own votes!');
              return ctx.reply('Nice try! But you can only confirm your own votes! 😉');
            }
            
            const { userId, username } = ctx.session.pendingApproval;
            
            // Skip recording vote in votes table due to foreign key constraints
            // Just award points directly
            await ensureMemberAndAwardPoints(userId, username, config.points.pitchReview, 'Voted YES on pitch');
            
            // Get the pitch
            const pitch = await dbModels.getPitchById(id);
            
            await ctx.editMessageText(`✅ Your vote has been recorded for Deal #${id}!`);
            await ctx.answerCbQuery('Vote recorded successfully!');
            
            // Always proceed to execute the deal since we're not counting votes
            await ctx.reply(`🎉 *THRESHOLD REACHED!* 🎉\n\nDeal #${id} has received enough votes.\nPreparing to execute transaction...`, {
              parse_mode: 'Markdown'
            });
            
            // Execute the transaction
            await executeApprovedDeal(ctx, pitch, username);
          } catch (error) {
            console.error(`Error in exact confirm approve for ${id}:`, error);
            await ctx.answerCbQuery('Error processing vote');
            ctx.reply(`Something went wrong while confirming your vote: ${error.message}. The development team has been notified.`);
          }
        });
        
        // Cancel approval
        const cancelApproveCallback = `cancel_approve_${id}`;
        bot.action(cancelApproveCallback, async (ctx) => {
          console.log(`EXACT CANCEL APPROVE triggered for ${id}`);
          
          try {
            // Clear the pending approval
            if (ctx.session) {
              ctx.session.pendingApproval = null;
            }
            
            await ctx.editMessageText('Vote cancelled! No changes were made. Phew! 😅');
            await ctx.answerCbQuery();
          } catch (error) {
            console.error(`Error in exact cancel approve for ${id}:`, error);
            ctx.reply('Failed to cancel. That\'s weird... 🤔');
          }
        });
        
        // Confirm rejection
        const confirmRejectCallback = `confirm_reject_${id}`;
        bot.action(confirmRejectCallback, async (ctx) => {
          console.log(`EXACT CONFIRM REJECT triggered for ${id}`);
          
          try {
            await dbModels.updatePitchStatus(id, 'rejected');
            
            // Award points to the admin who rejected
            const userId = ctx.from.id;
            const username = ctx.from.username || `user_${userId}`;
            
            // Use our new helper function to ensure the member exists and award points
            await ensureMemberAndAwardPoints(userId, username, config.points.pitchReview, 'Rejected pitch');
            
            await ctx.editMessageText(`Deal #${id} has been rejected by @${username}. Better luck next time! 👎`);
            await ctx.answerCbQuery('Pitch rejected successfully');
            
            // Notify the founder via the Founder Bot
            try {
              // Use the founder bot's notification method
              await founderBot.notifyFounderOfRejection(id);
              console.log(`Founder of pitch #${id} notified about rejection via founder bot`);
            } catch (notifyError) {
              console.error(`Error notifying founder of rejection for ${id}:`, notifyError);
            }
          } catch (error) {
            console.error(`Error in exact confirm reject for ${id}:`, error);
            await ctx.answerCbQuery('Error processing rejection');
            ctx.reply('Something went wrong while rejecting the deal. The crypto gods are not pleased today! 😔');
          }
        });
        
        // Cancel rejection
        const cancelRejectCallback = `cancel_reject_${id}`;
        bot.action(cancelRejectCallback, async (ctx) => {
          console.log(`EXACT CANCEL REJECT triggered for ${id}`);
          
          try {
            await ctx.editMessageText('Rejection cancelled! No changes were made.');
            await ctx.answerCbQuery();
          } catch (error) {
            console.error(`Error in exact cancel reject for ${id}:`, error);
            ctx.reply('Failed to cancel rejection.');
          }
        });
      });
      
      console.log('Finished registering explicit handlers');
    })
    .catch(error => {
      console.error('Error registering explicit handlers:', error);
    });
};

// Call the function to register the handlers when the bot starts
module.exports = {
  bot,
  start: () => {
    console.log('Starting deal bot...');
    
    // Debug output for Telegram bot token
    console.log('Checking bot token...', config.telegram.dealBotToken ? 'Token exists' : 'NO TOKEN FOUND');
    
    // Register the explicit callback handlers for all pitches
    registerExactCallbackHandlers();
    
    // Run an immediate check right away
    console.log('Running initial check immediately...');
    checkForNewPitches();
    
    // Start scheduling checks right away, don't wait for bot.launch() to resolve
    console.log('Scheduling automatic checks every 10 seconds');
    let lastPitchCheckTime = new Date();
    pitchCheckInterval = setInterval(() => {
      // Only log time once per minute or if a new pitch is found
      const now = new Date();
      if (now.getMinutes() !== lastPitchCheckTime.getMinutes()) {
        console.log('\n=== SCHEDULED CHECK AT', now.toLocaleTimeString(), '===');
      }
      lastPitchCheckTime = now;
      checkForNewPitches();
    }, 10000);
    
    // Start the bot with better error handling
    bot.launch()
      .then(() => {
        console.log('Deal bot started SUCCESSFULLY');
      })
      .catch(err => {
        console.error('CRITICAL: Failed to start deal bot:', err);
        // Debug output for troubleshooting
        console.error('Bot token length:', config.telegram.dealBotToken?.length || 'NO TOKEN');
        console.error('DAO Group ID:', DAO_GROUP_ID || 'NOT SET');
      });
  },
  stop: () => {
    console.log('Stopping deal bot...');
    if (pitchCheckInterval) {
      clearInterval(pitchCheckInterval);
      console.log('Automatic checks stopped');
    }
    bot.stop();
  }
};

// Error handling
bot.catch((err, ctx) => {
  console.error('Telegram error:', err);
  ctx.reply('An error occurred. Please try again later.');
});

// Process deal text for display
const formatDealSummary = (summary) => {
  if (!summary) return '';
  
  // Convert markdown to HTML
  return summary.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                .replace(/\*(.*?)\*/g, '<i>$1</i>')
                .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
};

// Scheduled task to periodically check for new pitches
let isCheckingPitches = false;
let pitchCheckInterval = null;

const checkForNewPitches = async () => {
  // Skip verbose startup message for routine checks
  if (isCheckingPitches) {
    return; // Skip silently without logging
  }
  
  isCheckingPitches = true;
  
  try {
    if (!DAO_GROUP_ID) {
      console.error('ERROR: DAO_GROUP_ID not set! Cannot send announcements without a group ID.');
      return;
    }
    
    // Get pitches that haven't been announced yet
    const { data, error } = await supabase
      .from('pitches')
      .select('*')
      .eq('announced', false)
      .eq('status', 'pending_review');
    
    if (error) {
      console.error('Error fetching unannounced pitches:', error);
      return;
    }
    
    // Only log if we found pitches to announce
    if (!data || data.length === 0) {
      return; // Skip silently if no new pitches
    }
    
    console.log(`=== CHECKING FOR NEW PITCHES ===`);
    console.log(`Found ${data.length} unannounced pitches to process`);
    
    // Process only one pitch at a time to avoid rate limits (the rest will be processed in future checks)
    const pitch = data[0];
    console.log(`Processing pitch #${pitch.id}`);
    
    // Extract project name from summary - improved pattern matching with better dash removal
    const projectName = pitch.summary?.split('\n')[0]
      .replace(/\*\*Project Name\*\*:|Project Name:|^\s*-\s*\*\*Project Name\*\*:/, '')
      .replace(/^[-–—]\s*/, '') // Remove any leading dash or hyphen and following whitespace
      .trim() || `Pitch #${pitch.id}`;
    
    // Convert stored summary to plaintext if it contains markdown
    if (pitch.summary && pitch.summary.includes('**')) {
      const plainSummary = pitch.summary.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
      
      // Update the pitch summary to remove markdown
      await supabase
        .from('pitches')
        .update({ summary: plainSummary })
        .eq('id', pitch.id);
    }
    
    // More exciting announcement message
    const message = `🚨 <b>NEW PITCH ALERT!</b> 🚨

💰 "<b>${projectName}</b>" just dropped their pitch!

This could be the next big thing! Check it out by typing:
/deal_${pitch.id}

Don't miss your chance to vote on this opportunity! 🔥`;
    
    try {
      console.log(`Sending announcement to group ${DAO_GROUP_ID} for pitch #${pitch.id} (${projectName})`);
      const sentMessage = await bot.telegram.sendMessage(DAO_GROUP_ID, message, { parse_mode: 'HTML' });
      
      // Mark as announced
      const { error: updateError } = await supabase
        .from('pitches')
        .update({ announced: true })
        .eq('id', pitch.id);
      
      if (updateError) {
        console.error(`Failed to mark pitch #${pitch.id} as announced:`, updateError);
      } else {
        console.log(`Pitch #${pitch.id} successfully announced and marked as announced`);
      }
    } catch (sendError) {
      console.error(`Error sending announcement for pitch #${pitch.id}:`, sendError);
    }
  } catch (error) {
    console.error('Error in pitch check:', error);
  } finally {
    isCheckingPitches = false;
  }
};

// Helper function to ensure a member is in the database and award points
const ensureMemberAndAwardPoints = async (telegramId, telegramUsername, points, reason) => {
  try {
    if (!telegramId || !telegramUsername) {
      console.error('Cannot award points: Missing user ID or username');
      return false;
    }
    
    // Check if member exists
    const { data: existingMember } = await supabase
      .from('members')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();
    
    // If member doesn't exist, create them
    if (!existingMember) {
      console.log(`Creating new member: ${telegramUsername} (${telegramId})`);
      await supabase
        .from('members')
        .insert({
          telegram_id: telegramId,
          telegram_username: telegramUsername,
          points: points // Initial points
        });
    } else {
      // Update member points - don't use supabase.raw which is causing errors
      const newPoints = (existingMember.points || 0) + points;
      console.log(`Updating points for ${telegramUsername}: ${existingMember.points || 0} + ${points} = ${newPoints}`);
      
      await supabase
        .from('members')
        .update({
          points: newPoints,
          telegram_username: telegramUsername // Update username in case it changed
        })
        .eq('telegram_id', telegramId);
    }
    
    // Add points transaction
    await supabase
      .from('points_transactions')
      .insert({
        telegram_id: telegramId,
        points: points,
        reason: reason
      });
    
    console.log(`Awarded ${points} points to ${telegramUsername} for ${reason}`);
    return true;
  } catch (error) {
    console.error('Error awarding points:', error);
    return false;
  }
};

// Helper function to execute an approved deal - this needs to be before using it
const executeApprovedDeal = async (ctx, pitch, approver) => {
  try {
    // Validate ETH address and amount
    if (!pitch.eth_address || !pitch.eth_address.startsWith('0x')) {
      return ctx.reply('❌ Cannot execute: Invalid Ethereum address for the founder.');
    }
    
    if (!pitch.eth_amount || pitch.eth_amount <= 0) {
      return ctx.reply('❌ Cannot execute: Invalid funding amount.');
    }
    
    // Check if DAO has enough balance
    const balance = await wallet.getWalletBalance();
    if (parseFloat(balance) < parseFloat(pitch.eth_amount)) {
      return ctx.reply(`❌ Cannot execute: Treasury only has ${balance} ETH, but needs ${pitch.eth_amount} ETH.`);
    }
    
    await ctx.reply(`
⏳ <b>Executing Deal #${pitch.id}</b>

Rocky is sending ${pitch.eth_amount} ETH to ${pitch.eth_address}
This may take a moment... blockchain things, ya know? ⛓️
    `, { parse_mode: 'HTML' });
    
    // Send the requested ETH amount to the founder's address
    const txResult = await wallet.sendTransaction(pitch.eth_address, pitch.eth_amount);
    
    // Update pitch status
    await dbModels.updatePitchStatus(pitch.id, 'approved');
    
    // Get project name with better hyphen handling
    const projectName = pitch.summary?.split('\n')[0]
      .replace(/\*\*Project Name\*\*:|Project Name:|^\s*-\s*\*\*Project Name\*\*:/, '')
      .replace(/^[-–—]\s*/, '') // Remove any leading dash or hyphen
      .trim() || `Pitch #${pitch.id}`;
    
    // Award points to the approver - simplified approach with direct user info
    // Extract the user id from context or use a default if needed
    const userId = ctx.from?.id;
    const username = approver || ctx.from?.username || 'unknown';
    
    // Log what we're attempting
    console.log(`Attempting to award points to user ${username} (ID: ${userId}) for approving deal #${pitch.id}`);
    
    // Make sure we have a user ID - if ctx.from is missing, try to extract from session
    if (userId) {
      console.log(`Awarding ${config.points.executeProposal || 50} points to ${username} (${userId})`);
      const pointsResult = await ensureMemberAndAwardPoints(
        userId, 
        username, 
        config.points.executeProposal || 50, 
        `Executed deal #${pitch.id}`
      );
      console.log('Points award result:', pointsResult);
    } else if (ctx.session?.pendingApproval?.userId) {
      console.log(`Using session data to award points to ${ctx.session.pendingApproval.username} (${ctx.session.pendingApproval.userId})`);
      const pointsResult = await ensureMemberAndAwardPoints(
        ctx.session.pendingApproval.userId,
        ctx.session.pendingApproval.username,
        config.points.executeProposal || 50,
        `Executed deal #${pitch.id}`
      );
      console.log('Points award result:', pointsResult);
    } else {
      console.warn('No user ID available to award points');
    }
    
    // Send confirmation to the group
    await ctx.reply(`
🎉 <b>DEAL APPROVED & EXECUTED!</b> 🎉

<b>${projectName}</b> has received funding of ${pitch.eth_amount} ETH! 

Transaction Hash: <code>${txResult.txHash}</code>
View on Explorer: <a href="https://sepolia.basescan.org/tx/${txResult.txHash}">BaseScan</a>

Thanks to @${username} for making this happen! 
    `, { 
      parse_mode: 'HTML',
      disable_web_page_preview: true 
    });
    
    // Notify the founder via the Founder Bot
    try {
      // Use the founder bot's notification method
      await founderBot.notifyFounderOfApproval(pitch.id, txResult.txHash, pitch.eth_amount);
      console.log(`Founder of pitch #${pitch.id} notified about approval via founder bot`);
    } catch (notifyError) {
      console.error('Error notifying founder:', notifyError);
    }
    
    return true;
  } catch (error) {
    console.error('Error executing deal:', error);
    ctx.reply(`
❌ <b>Transaction Failed</b>

There was an error sending the funds:
${error.message || 'Unknown error'}

Our tech team has been notified. Please try again soon!
    `, { parse_mode: 'HTML' });
    
    return false;
  }
};

// Approve a deal
bot.action(/approve_(\d+)/, async (ctx) => {
  console.log('APPROVE action triggered for ID:', ctx.match[1]);
  try {
    const pitchId = ctx.match[1];
    const userId = ctx.from.id;
    const username = ctx.from.username || `user_${userId}`;
    
    // Store in session that this user wants to approve this pitch
    ctx.session = { 
      ...ctx.session, 
      pendingApproval: { pitchId, userId, username }
    };
    
    // Use simple button callbacks
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Yes', `yes_${pitchId}`),
        Markup.button.callback('❌ No', `no_${pitchId}`)
      ]
    ]);
    
    await ctx.reply(`🚨 *CONFIRMATION NEEDED* 🚨\n\nYou're about to vote YES on Deal #${pitchId}.\n\nThis will count toward the approval threshold and may trigger automatic fund transfer!\n\nAre you sure?`, {
      parse_mode: 'Markdown',
      ...keyboard
    });
    
    // Answer the callback query to remove loading state
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error setting up approval:', error);
    ctx.reply('Hmm, something went wrong while processing your vote. Try again?');
  }
});

// Reject a deal
bot.action(/reject_(\d+)/, async (ctx) => {
  console.log('REJECT action triggered for ID:', ctx.match[1]);
  try {
    const pitchId = ctx.match[1];
    const userId = ctx.from.id;
    const username = ctx.from.username || `user_${userId}`;
    
    // Store in session that this user wants to reject this pitch
    ctx.session = { 
      ...ctx.session, 
      pendingRejection: { pitchId, userId, username }
    };
    
    // Use simple button callbacks WITH COMPLETELY DIFFERENT PREFIXES
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Yes', `REJECT_YES_${pitchId}`),
        Markup.button.callback('❌ No', `REJECT_NO_${pitchId}`)
      ]
    ]);
    
    await ctx.reply(`🚨 *CONFIRMATION NEEDED* 🚨\n\nYou're about to REJECT Deal #${pitchId}.\n\nThis cannot be undone!\n\nAre you sure?`, {
      parse_mode: 'Markdown',
      ...keyboard
    });
    
    // Answer the callback query to remove loading state
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error setting up rejection:', error);
    ctx.reply('Something went wrong while processing your rejection. Try again?');
  }
});

// Yes for approval
bot.action(/yes_(\d+)/, async (ctx) => {
  console.log('YES action triggered');
  try {
    const pitchId = ctx.match[1];
    
    if (!ctx.session?.pendingApproval || ctx.session.pendingApproval.pitchId !== pitchId) {
      await ctx.answerCbQuery('Error: No pending approval found');
      return;
    }
    
    const { userId, username } = ctx.session.pendingApproval;
    console.log(`Processing YES vote from user ${username} (${userId}) for pitch #${pitchId}`);
    
    // Skip recording vote in votes table due to foreign key constraints
    // Just award points directly - with more logging
    console.log(`Awarding ${config.points.pitchReview} points to ${username} (${userId}) for voting YES`);
    const pointsResult = await ensureMemberAndAwardPoints(
      userId, 
      username, 
      config.points.pitchReview, 
      `Voted YES on pitch #${pitchId}`
    );
    console.log('Points award result:', pointsResult);
    
    // Get the pitch
    const pitch = await dbModels.getPitchById(pitchId);
    
    await ctx.editMessageText(`✅ Your vote has been recorded for Deal #${pitchId}!`);
    await ctx.answerCbQuery('Vote recorded successfully!');
    
    // Always proceed to execute the deal since we're not counting votes
    await ctx.reply(`🎉 *THRESHOLD REACHED!* 🎉\n\nDeal #${pitchId} has received enough votes.\nPreparing to execute transaction...`, {
      parse_mode: 'Markdown'
    });
    
    // Execute the transaction
    await executeApprovedDeal(ctx, pitch, username);
  } catch (error) {
    console.error('Error in yes action:', error);
    await ctx.answerCbQuery('Error processing vote');
    ctx.reply(`Something went wrong with your vote: ${error.message}. The development team has been notified.`);
  }
});

// No for approval
bot.action(/no_(\d+)/, async (ctx) => {
  console.log('NO action triggered');
  try {
    const pitchId = ctx.match[1];
    
    // Clear the pending approval
    if (ctx.session) {
      ctx.session.pendingApproval = null;
    }
    
    await ctx.editMessageText(`Vote cancelled for Deal #${pitchId}! No changes were made.`);
    await ctx.answerCbQuery('Cancelled');
  } catch (error) {
    console.error('Error in no action:', error);
    await ctx.answerCbQuery('Error cancelling');
  }
});

// Yes for rejection - COMPLETELY DIFFERENT PATTERN
bot.action(/REJECT_YES_(\d+)/, async (ctx) => {
  console.log('REJECT YES action triggered with FULL prefix');
  try {
    const pitchId = ctx.match[1];
    
    if (!ctx.session?.pendingRejection || ctx.session.pendingRejection.pitchId !== pitchId) {
      await ctx.answerCbQuery('Error: No pending rejection found');
      return;
    }
    
    const { userId, username } = ctx.session.pendingRejection;
    
    await dbModels.updatePitchStatus(pitchId, 'rejected');
    
    // Award points to the admin who rejected
    await ensureMemberAndAwardPoints(userId, username, config.points.pitchReview, 'Rejected pitch');
    
    await ctx.editMessageText(`Deal #${pitchId} has been rejected by @${username}. Better luck next time! 👎`);
    await ctx.answerCbQuery('Pitch rejected successfully');
    
    // Notify the founder via the Founder Bot
    try {
      await founderBot.notifyFounderOfRejection(pitchId);
      console.log(`Founder of pitch #${pitchId} notified about rejection via founder bot`);
    } catch (notifyError) {
      console.error('Error notifying founder of rejection:', notifyError);
    }
  } catch (error) {
    console.error('Error in reject yes action:', error);
    await ctx.answerCbQuery('Error processing rejection');
    ctx.reply('Something went wrong while rejecting the deal. Try again?');
  }
});

// No for rejection - COMPLETELY DIFFERENT PATTERN
bot.action(/REJECT_NO_(\d+)/, async (ctx) => {
  console.log('REJECT NO action triggered with FULL prefix');
  try {
    const pitchId = ctx.match[1];
    
    // Clear the pending rejection
    if (ctx.session) {
      ctx.session.pendingRejection = null;
    }
    
    await ctx.editMessageText(`Rejection cancelled for Deal #${pitchId}! No changes were made.`);
    await ctx.answerCbQuery('Cancelled');
  } catch (error) {
    console.error('Error in reject no action:', error);
    await ctx.answerCbQuery('Error cancelling');
  }
});

// Add a simple command to reset a deal for testing
bot.command('resetdeal', async (ctx) => {
  // Extract the pitch ID from the command
  const text = ctx.message.text.trim();
  const match = text.match(/^\/resetdeal(?:\s+(\d+))?$/);
  const pitchId = match ? match[1] : null;
  
  if (!pitchId) {
    return ctx.reply('❓ Please specify a deal ID. Example: /resetdeal 1');
  }
  
  try {
    await ctx.reply(`🔄 Resetting deal #${pitchId} to pending status...`);
    
    // Update the pitch status back to pending_review
    const { error } = await supabase
      .from('pitches')
      .update({ 
        status: 'pending_review',
        announced: true // Keep it announced so it doesn't get announced again
      })
      .eq('id', pitchId);
    
    if (error) {
      console.error(`Error resetting deal #${pitchId}:`, error);
      return ctx.reply(`❌ Failed to reset: ${error.message}`);
    }
    
    await ctx.reply(`✅ Deal #${pitchId} has been reset to pending status! You can now vote on it again.`);
  } catch (error) {
    console.error('Error in reset deal command:', error);
    await ctx.reply(`❌ Error: ${error.message}`);
  }
});

// Test command to check database and points system
bot.command('testpoints', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || `user_${userId}`;
    
    await ctx.reply(`🧪 Testing points system...\nUser: @${username} (ID: ${userId})`);
    
    // Test direct database insertion
    await ctx.reply('Step 1: Testing direct insertion to members table...');
    
    // First try to delete any existing test record (ignore errors)
    try {
      await supabase
        .from('members')
        .delete()
        .eq('telegram_id', userId);
      console.log('Cleaned up existing member record');
    } catch (cleanupError) {
      console.log('No existing record to clean up or error:', cleanupError);
    }
    
    // Insert directly
    const { data: insertData, error: insertError } = await supabase
      .from('members')
      .insert({
        telegram_id: userId,
        telegram_username: username,
        points: 100
      })
      .select();
    
    if (insertError) {
      await ctx.reply(`❌ Direct insert failed: ${insertError.message}\nCode: ${insertError.code}`);
    } else {
      await ctx.reply(`✅ Direct insert successful! ID: ${insertData[0]?.id || 'unknown'}`);
    }
    
    // Test points transaction
    await ctx.reply('Step 2: Testing points transaction insertion...');
    const { data: txData, error: txError } = await supabase
      .from('points_transactions')
      .insert({
        telegram_id: userId,
        points: 100,
        reason: 'Test transaction'
      })
      .select();
    
    if (txError) {
      await ctx.reply(`❌ Transaction insert failed: ${txError.message}\nCode: ${txError.code}`);
    } else {
      await ctx.reply(`✅ Transaction insert successful! ID: ${txData[0]?.id || 'unknown'}`);
    }
    
    // Test helper function
    await ctx.reply('Step 3: Testing helper function...');
    const helperResult = await ensureMemberAndAwardPoints(
      userId,
      username,
      50,
      'Testing points helper'
    );
    
    await ctx.reply(`Helper function result: ${helperResult ? '✅ Success' : '❌ Failed'}`);
    
    // Final check
    await ctx.reply('Step 4: Checking database for member record...');
    const { data: finalCheck, error: checkError } = await supabase
      .from('members')
      .select('*')
      .eq('telegram_id', userId)
      .single();
    
    if (checkError) {
      await ctx.reply(`❌ Final check failed: ${checkError.message}`);
    } else if (finalCheck) {
      await ctx.reply(`✅ Member found! Current points: ${finalCheck.points}`);
    } else {
      await ctx.reply('❌ Member not found in final check!');
    }
    
    await ctx.reply('Test completed! Try running /leaderboard now');
    
  } catch (error) {
    console.error('Error in testpoints command:', error);
    await ctx.reply(`❌ Test error: ${error.message}`);
  }
});

// Check database tables command
bot.command('dbcheck', async (ctx) => {
  try {
    await ctx.reply('🔍 Checking database tables and permissions...');
    
    // Check members table
    await ctx.reply('Checking members table...');
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('count')
      .limit(1);
    
    if (membersError) {
      await ctx.reply(`❌ Members table error: ${membersError.message}`);
    } else {
      await ctx.reply(`✅ Members table exists and is accessible`);
    }
    
    // Check points_transactions table
    await ctx.reply('Checking points_transactions table...');
    const { data: transactions, error: txError } = await supabase
      .from('points_transactions')
      .select('count')
      .limit(1);
    
    if (txError) {
      await ctx.reply(`❌ Points transactions table error: ${txError.message}`);
    } else {
      await ctx.reply(`✅ Points transactions table exists and is accessible`);
    }
    
    // Check PostgreSQL version
    await ctx.reply('Checking database connection information...');
    const { data: versionData, error: versionError } = await supabase
      .rpc('get_db_info');
    
    if (versionError) {
      await ctx.reply(`❌ Cannot get database info: ${versionError.message}`);
      await ctx.reply('Note: The get_db_info function may not exist, which is expected');
    } else {
      await ctx.reply(`Database info: ${JSON.stringify(versionData)}`);
    }
    
    // Check if the user's session context can insert
    await ctx.reply('Testing insert privileges...');
    const testData = {
      telegram_id: ctx.from.id,
      telegram_username: ctx.from.username || `user_${ctx.from.id}`,
      points: 1
    };
    
    const { data: insertTest, error: insertError } = await supabase
      .from('members')
      .upsert(testData)
      .select();
    
    if (insertError) {
      await ctx.reply(`❌ Insert test failed: ${insertError.message}`);
    } else {
      await ctx.reply(`✅ Insert test succeeded: ${JSON.stringify(insertTest)}`);
    }
    
    await ctx.reply('Database check completed');
  } catch (error) {
    console.error('Error in dbcheck command:', error);
    await ctx.reply(`❌ Database check error: ${error.message}`);
  }
});
