const { Telegraf, Markup, session } = require('telegraf');
const config = require('../config');
const dbModels = require('../database/models');
const openai = require('../utils/openai');

// Initialize bot
const bot = new Telegraf(config.telegram.investorBotToken);

// Add session middleware
bot.use(session());

// Common messages
const WELCOME_MESSAGE = `
✨ *Welcome to Rocky Investor Hub!* ✨

I'm your personal assistant for finding the next unicorn! 🦄

Need to connect with founders? Want to learn more about projects? 
I've got you covered!

*Here's what I can do:*
• /intro <pitchID> - Get a personalized intro to a founder
• /details <pitchID> - Learn about a specific project
• /help - See all my magic tricks

Let's find some gems together! 💎
`;

// Start command
bot.start((ctx) => {
  ctx.reply(WELCOME_MESSAGE, { parse_mode: 'Markdown' });
});

// Help command
bot.help((ctx) => {
  ctx.reply(`
🔮 *Rocky Investor Commands* 🔮

/intro <pitchID> - Get a personalized intro to a founder
/details <pitchID> - See all details about a project
/feedback <pitchID> - Provide feedback on a project
/help - Show this fancy menu

*Pro Tip:* Check the Deal Bot for the latest opportunities!
  `, { parse_mode: 'Markdown' });
});

// Intro generator - NEW FEATURE
bot.command('intro', async (ctx) => {
  const args = ctx.message.text.split(' ');
  
  if (args.length < 2) {
    return ctx.reply('🤔 *Missing Pitch ID*\n\nPlease specify which project you want an intro for.\n\nUsage: `/intro 123`', { parse_mode: 'Markdown' });
  }
  
  const pitchId = args[1];
  
  try {
    await ctx.reply('✍️ *Crafting your personalized introduction...*', { parse_mode: 'Markdown' });
    
    // Get the pitch
    const pitch = await dbModels.getPitchById(pitchId);
    
    if (!pitch) {
      return ctx.reply(`❌ Pitch with ID ${pitchId} was not found. Double-check the ID and try again!`);
    }
    
    // Get investor info
    const userId = ctx.from.id;
    const username = ctx.from.username || `user_${userId}`;
    
    // Create an intro paragraph using OpenAI
    let projectName = pitch.summary?.split('\n')[0].replace(/\*\*Project Name\*\*:|Project Name:|^\s*-\s*\*\*Project Name\*\*:/, '').trim() || `Pitch #${pitch.id}`;
    
    // If we have OpenAI integration set up
    let introMessage = '';
    try {
      // This assumes you have an OpenAI module with a method to generate intros
      introMessage = await openai.generateIntroduction(username, projectName, pitch.summary);
    } catch (aiError) {
      console.error('Error generating introduction with AI:', aiError);
      
      // Fallback template if AI fails
      introMessage = `
Hi there!

I'm @${username}, an investor from the Rocky DAO. I recently came across your project "${projectName}" and I'm really interested in what you're building. 

Your approach to [specific aspect from summary] caught my attention, and I'd love to learn more about your vision and roadmap.

Would you be open to a quick chat about potential synergies?

Looking forward to connecting!
      `;
    }
    
    // Award points for making a connection
    try {
      await dbModels.addPoints(userId, username, 15, 'Generated founder introduction');
    } catch (pointsError) {
      console.error('Error awarding points:', pointsError);
    }
    
    // Send the introduction template
    await ctx.reply(`
📝 *Your Personalized Introduction*

_Copy and paste this message to send to @${pitch.telegram_username}_:

\`\`\`
${introMessage}
\`\`\`

*Founder Contact:* @${pitch.telegram_username}
    `, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true 
    });
    
  } catch (error) {
    console.error('Error generating introduction:', error);
    ctx.reply('😵 *Oops!* Something went wrong generating your introduction. Please try again soon!', { parse_mode: 'Markdown' });
  }
});

// Get project details (replaces the old feedback functionality)
bot.command('details', async (ctx) => {
  const args = ctx.message.text.split(' ');
  
  if (args.length < 2) {
    return ctx.reply('🤔 *Missing Pitch ID*\n\nPlease specify which project you want details for.\n\nUsage: `/details 123`', { parse_mode: 'Markdown' });
  }
  
  const pitchId = args[1];
  
  try {
    // Get the pitch
    const pitch = await dbModels.getPitchById(pitchId);
    
    if (!pitch) {
      return ctx.reply(`❌ Pitch with ID ${pitchId} was not found. Double-check the ID and try again!`);
    }
    
    // Format the pitch summary in a nice way
    const summaryLines = pitch.summary.split('\n');
    
    // Create a nicely formatted message with emojis
    let message = `🚀 *PROJECT DETAILS: ${summaryLines[0].replace(/\*\*Project Name\*\*:|Project Name:|^\s*-\s*\*\*Project Name\*\*:/, '').trim()}*\n\n`;
    
    // Add emojis to key sections
    summaryLines.forEach(line => {
      // Remove dash prefix and trim
      let cleanLine = line.replace(/^\s*-\s*/, '').trim();
      if (!cleanLine) return; // Skip empty lines
      
      if (cleanLine.toLowerCase().includes('project name')) {
        message += `🏷️ ${cleanLine}\n`;
      } else if (cleanLine.toLowerCase().includes('description') || cleanLine.toLowerCase().includes('overview')) {
        message += `📝 ${cleanLine}\n`;
      } else if (cleanLine.toLowerCase().includes('team') || cleanLine.toLowerCase().includes('founder')) {
        message += `👥 ${cleanLine}\n`;
      } else if (cleanLine.toLowerCase().includes('funding') || cleanLine.toLowerCase().includes('raising')) {
        message += `💰 ${cleanLine}\n`;
      } else if (cleanLine.toLowerCase().includes('traction') || cleanLine.toLowerCase().includes('metrics')) {
        message += `📈 ${cleanLine}\n`;
      } else if (cleanLine.toLowerCase().includes('technology') || cleanLine.toLowerCase().includes('product')) {
        message += `⚙️ ${cleanLine}\n`;
      } else if (cleanLine.toLowerCase().includes('problem')) {
        message += `🔍 ${cleanLine}\n`;
      } else if (cleanLine.toLowerCase().includes('solution')) {
        message += `💡 ${cleanLine}\n`;
      } else if (cleanLine.toLowerCase().includes('market')) {
        message += `🌎 ${cleanLine}\n`;
      } else if (cleanLine.toLowerCase().includes('advantage') || cleanLine.toLowerCase().includes('competition') || cleanLine.toLowerCase().includes('value proposition')) {
        message += `🏆 ${cleanLine}\n`;
      } else if (cleanLine.toLowerCase().includes('token') || cleanLine.toLowerCase().includes('equity')) {
        message += `🪙 ${cleanLine}\n`;
      } else if (cleanLine.toLowerCase().includes('use of funds')) {
        message += `💸 ${cleanLine}\n`;
      } else {
        message += `${cleanLine}\n`;
      }
    });
    
    message += `\n💼 *Funding Request:* ${pitch.eth_amount} ETH\n`;
    message += `📅 *Submitted:* ${new Date(pitch.created_at).toLocaleDateString()}\n`;
    message += `🏛️ *Status:* ${pitch.status.replace(/_/g, ' ')}\n\n`;
    
    // Add contact info
    message += `Want to connect? Try /intro ${pitchId} for a personalized introduction!`;
    
    // Get the user's ID and track that they viewed this pitch
    const userId = ctx.from.id;
    const username = ctx.from.username || `user_${userId}`;
    
    // Award points for researching a pitch
    try {
      await dbModels.addPoints(userId, username, 5, 'Viewed pitch details');
    } catch (pointsError) {
      console.error('Error awarding points:', pointsError);
    }
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error fetching pitch details:', error);
    ctx.reply('😵 *Oops!* Something went wrong retrieving the details. Please try again soon!', { parse_mode: 'Markdown' });
  }
});

// Feedback command
bot.command('feedback', async (ctx) => {
  const args = ctx.message.text.split(' ');
  
  if (args.length < 2) {
    return ctx.reply('🤔 *Missing Pitch ID*\n\nPlease specify which project you want to provide feedback for.\n\nUsage: `/feedback 123`', { parse_mode: 'Markdown' });
  }
  
  const pitchId = args[1];
  
  try {
    // Get the pitch
    const pitch = await dbModels.getPitchById(pitchId);
    
    if (!pitch) {
      return ctx.reply(`❌ Pitch with ID ${pitchId} was not found. Double-check the ID and try again!`);
    }
    
    // Extract project name
    const projectName = pitch.summary?.split('\n')[0].replace(/\*\*Project Name\*\*:|Project Name:|^\s*-\s*\*\*Project Name\*\*:/, '').trim() || `Pitch #${pitch.id}`;
    
    // Store in session that we're awaiting feedback for this pitch
    ctx.session = { 
      ...ctx.session, 
      awaitingFeedback: true,
      feedbackPitchId: pitchId,
      feedbackProjectName: projectName
    };
    
    await ctx.reply(`
💬 *Provide Feedback for "${projectName}"*

Please write your feedback in a single message. Your insights will be shared with the founder to help improve their project.

Some things you might want to address:
• What you liked about the project
• Areas for improvement
• Questions you have
• Suggestions for growth

Your feedback will be anonymous to other investors but visible to the founder.
    `, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error initiating feedback:', error);
    ctx.reply('😵 *Oops!* Something went wrong. Please try again soon!', { parse_mode: 'Markdown' });
  }
});

// Handle feedback text
bot.on('text', async (ctx) => {
  // Ignore command messages
  if (ctx.message.text.startsWith('/')) {
    return;
  }
  
  // Only process if we're awaiting feedback
  if (ctx.session?.awaitingFeedback && ctx.session?.feedbackPitchId) {
    try {
      const feedbackText = ctx.message.text;
      const pitchId = ctx.session.feedbackPitchId;
      const projectName = ctx.session.feedbackProjectName;
      
      // Check if feedback is too short
      if (feedbackText.length < 10) {
        return ctx.reply('✏️ That feedback seems a bit short. Please provide more detailed feedback to be helpful to the founder.', { parse_mode: 'Markdown' });
      }
      
      // Get user info
      const userId = ctx.from.id;
      const username = ctx.from.username || `user_${userId}`;
      
      // Store feedback in database
      const feedbackData = {
        pitch_id: pitchId,
        telegram_id: userId,
        telegram_username: username,
        comment: feedbackText
      };
      
      await dbModels.addFeedback(feedbackData);
      
      // Clear session
      ctx.session.awaitingFeedback = false;
      ctx.session.feedbackPitchId = null;
      ctx.session.feedbackProjectName = null;
      
      // Award points for giving feedback
      try {
        await dbModels.addPoints(userId, username, 15, 'Provided feedback on pitch');
      } catch (pointsError) {
        console.error('Error awarding points:', pointsError);
      }
      
      await ctx.reply(`
✅ *Feedback Submitted!*

Thank you for sharing your insights on "${projectName}"!

Your feedback will help the founder improve their project and increase their chances of success.

You've earned 15 points for contributing to the DAO ecosystem! 🎉
      `, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error('Error processing feedback:', error);
      ctx.reply('😵 *Oops!* Something went wrong while saving your feedback. Please try again soon!', { parse_mode: 'Markdown' });
    }
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Telegram error:', err);
  ctx.reply('🔥 *Uh oh!* Something went wrong. Please try again later.', { parse_mode: 'Markdown' });
});

module.exports = {
  bot,
  start: () => {
    bot.launch().then(() => {
      console.log('Investor bot started');
    }).catch(err => {
      console.error('Failed to start investor bot:', err);
    });
  },
  stop: () => {
    bot.stop();
  }
}; 