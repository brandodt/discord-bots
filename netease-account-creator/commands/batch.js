const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const neTeaseUtils = require('../utils/neTeaseUtils.js');

// Map to store batch sessions
const batchSessions = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('batch')
    .setDescription('Create multiple NetEase accounts in batch mode')
    .addStringOption(option => 
      option.setName('email')
        .setDescription('Your base email address (Gmail recommended for multiple accounts)')
        .setRequired(true))
    .addIntegerOption(option => 
      option.setName('count')
        .setDescription('Number of accounts to create (1-5)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(5)),
  
  async execute(interaction) {
    const baseEmail = interaction.options.getString('email');
    const count = interaction.options.getInteger('count');
    
    // Validate email format
    if (!neTeaseUtils.validateEmail(baseEmail)) {
      await interaction.reply({ 
        content: 'Invalid email format. Please provide a valid email address.', 
        ephemeral: true 
      });
      return;
    }
    
    // Let the user know we're starting the process
    await interaction.reply({ 
      content: `Starting batch account creation process for ${count} accounts using ${baseEmail} as base email. This might take a moment...`, 
      ephemeral: true 
    });
    
    // Generate email variations - for batch mode, we should create more variations
    // than requested in case some fail
    const additionalVariations = 5; // Create extra variations to try if some fail
    const totalVariations = count + additionalVariations;
    const emailVariations = baseEmail.toLowerCase().includes('@gmail.com')
      ? neTeaseUtils.generateMultipleEmailVariations(baseEmail, totalVariations)
      : [baseEmail]; // Non-Gmail only gets one option
    
    if (emailVariations.length < count) {
      await interaction.editReply(`Could only generate ${emailVariations.length} unique email variations. Proceeding with those.`);
    }
    
    // Initialize batch session
    const batchId = `${interaction.user.id}-${Date.now()}`;
    batchSessions.set(batchId, {
      userId: interaction.user.id,
      baseEmail,
      count: Math.min(count, emailVariations.length),
      emailVariations,
      pendingEmails: [...emailVariations],
      completedEmails: [],
      failedEmails: [],
      sessions: new Map(),
      createdAt: Date.now()
    });
    
    // Process the first email
    await processNextEmail(interaction, batchId);
    
    // Set a timeout to remove the batch session after 30 minutes
    setTimeout(() => {
      if (batchSessions.has(batchId)) {
        batchSessions.delete(batchId);
      }
    }, 30 * 60 * 1000); // 30 minutes
  }
};

async function processNextEmail(interaction, batchId) {
  const batch = batchSessions.get(batchId);
  
  if (!batch || batch.pendingEmails.length === 0) {
    // Either invalid batch or no more emails to process
    return;
  }
  
  // Get next email to process
  const email = batch.pendingEmails.shift();
  
  try {
    // Step 1: Create device ID and ticket
    const deviceId = neTeaseUtils.generateDeviceId();
    const ticketResult = await neTeaseUtils.createTicket(deviceId);
    
    if (ticketResult.code !== 0 || !ticketResult.ticket) {
      console.log(`Error creating ticket for ${email}: ${ticketResult.msg || 'Unknown error'}`);
      batch.failedEmails.push({ email, error: `Error creating ticket: ${ticketResult.msg || 'Unknown error'}` });
      
      // Continue with next email if there are any
      if (batch.pendingEmails.length > 0 && batch.sessions.size < batch.count) {
        await processNextEmail(interaction, batchId);
      } else {
        await updateBatchStatus(interaction, batchId);
      }
      return;
    }
    
    const ticket = ticketResult.ticket;
    
    // Step 2: Check email availability
    const emailResult = await neTeaseUtils.checkEmailAvailability(email, deviceId, ticket);
    
    if (emailResult.code !== 0) {
      console.log(`Email not available: ${email}`);
      batch.failedEmails.push({ email, error: `Email not available: ${emailResult.msg || 'Unknown error'}` });
      
      // If we don't have enough sessions yet and we have more pending emails, try the next one
      if (batch.pendingEmails.length > 0 && batch.sessions.size < batch.count) {
        await processNextEmail(interaction, batchId);
      } else {
        await updateBatchStatus(interaction, batchId);
      }
      return;
    }
    
    // Step 3: Generate username and check availability BEFORE sending verification code
    // This follows the same order as the Python implementation
    let username = neTeaseUtils.generateUsername();
    let usernameResult = await neTeaseUtils.checkUsernameAvailability(username, deviceId, ticket);
    
    // If username is not available, try another one with a random number appended
    if (usernameResult.code !== 0) {
      username = neTeaseUtils.generateUsername() + Math.floor(Math.random() * 1000);
      usernameResult = await neTeaseUtils.checkUsernameAvailability(username, deviceId, ticket);
      
      if (usernameResult.code !== 0) {
        console.log(`Could not find an available username for ${email}`);
        batch.failedEmails.push({ email, error: 'Could not find an available username' });
        
        // If we don't have enough sessions yet and we have more pending emails, try the next one
        if (batch.pendingEmails.length > 0 && batch.sessions.size < batch.count) {
          await processNextEmail(interaction, batchId);
        } else {
          await updateBatchStatus(interaction, batchId);
        }
        return;
      }
    }
    
    // Step 4: Generate password
    const password = neTeaseUtils.generatePassword();
    
    // Step 5: Now send verification code after username check
    const sendResult = await neTeaseUtils.sendVerificationCode(email, deviceId, ticket);
    
    if (sendResult.code !== 0) {
      console.log(`Failed to send verification code to ${email}: ${sendResult.msg || 'Unknown error'}`);
      batch.failedEmails.push({ email, error: `Failed to send verification code: ${sendResult.msg || 'Unknown error'}` });
      
      // If we don't have enough sessions yet and we have more pending emails, try the next one
      if (batch.pendingEmails.length > 0 && batch.sessions.size < batch.count) {
        await processNextEmail(interaction, batchId);
      } else {
        await updateBatchStatus(interaction, batchId);
      }
      return;
    }
    
    console.log(`Verification code sent successfully to ${email}`);
    
    // Store session information
    batch.sessions.set(email, {
      email,
      username,
      password,
      deviceId,
      ticket,
      batchId,
      status: 'pending'
    });
    
    // Update status
    await updateBatchStatus(interaction, batchId);
    
    // Continue processing more emails if we haven't reached the desired count yet
    if (batch.pendingEmails.length > 0 && batch.sessions.size < batch.count) {
      await processNextEmail(interaction, batchId);
    }
  } catch (error) {
    console.error(`Error processing email ${email}:`, error);
    batch.failedEmails.push({ email, error: `Unexpected error: ${error.message}` });
    
    // If we don't have enough sessions yet and we have more pending emails, try the next one
    if (batch.pendingEmails.length > 0 && batch.sessions.size < batch.count) {
      await processNextEmail(interaction, batchId);
    } else {
      await updateBatchStatus(interaction, batchId);
    }
  }
}

async function updateBatchStatus(interaction, batchId) {
  const batch = batchSessions.get(batchId);
  
  if (!batch) {
    return;
  }
  
  // Check if we need to process more emails to reach the desired count
  const neededMoreEmails = batch.sessions.size < batch.count && batch.pendingEmails.length > 0;
  
  if (neededMoreEmails) {
    // Process another email if we don't have enough sessions yet
    await processNextEmail(interaction, batchId);
    return;
  }
  
  // Create an embed to show the batch status
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('NetEase Batch Account Creation')
    .setDescription(`Batch creation process for ${batch.count} accounts using ${batch.baseEmail} as base email.`)
    .addFields(
      { name: 'Total Accounts Requested', value: batch.count.toString() },
      { name: 'Pending Emails', value: batch.pendingEmails.length.toString() },
      { name: 'Pending Verification', value: batch.sessions.size.toString() },
      { name: 'Completed Accounts', value: batch.completedEmails.length.toString() },
      { name: 'Failed Attempts', value: batch.failedEmails.length.toString() }
    );
  
  // List accounts waiting for verification
  if (batch.sessions.size > 0) {
    let verifyText = 'The following accounts need verification codes:\n\n';
    let count = 0;
    
    for (const [email, session] of batch.sessions.entries()) {
      count++;
      verifyText += `${count}. Email: ${email}\n   Username: ${session.username}\n   Password: ${session.password}\n\n`;
      
      if (count >= 5) {
        if (batch.sessions.size > 5) {
          verifyText += `...and ${batch.sessions.size - 5} more\n`;
        }
        break;
      }
    }
    
    embed.addFields({ name: 'Waiting for Verification', value: verifyText });
  }
  
  // Create a button for the user to verify an account
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`batch_verify_${batchId}`)
        .setLabel('Enter a Verification Code')
        .setStyle(ButtonStyle.Primary)
    );
  
  await interaction.editReply({ embeds: [embed], components: [row] });
}

// Export batch sessions map for other files to access
module.exports.batchSessions = batchSessions;