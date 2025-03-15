// Import required modules
const { Client, GatewayIntentBits, Collection, REST, Routes, SlashCommandBuilder, EmbedBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import utilities
const neTeaseUtils = require('./utils/neTeaseUtils.js');

// Create a new Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Command collection
client.commands = new Collection();

// Load commands
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  // Set a new item in the Collection
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// Configure REST API
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Register commands
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);
    
    // For global commands
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );
    
    console.log(`Successfully reloaded application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();

// When the client is ready, run this code
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Import necessary modules for button interactions
const { activeSessions } = require('./commands/create.js');
const { batchSessions } = require('./commands/batch.js');

// Handling interactions
client.on('interactionCreate', async interaction => {
  try {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        
        const errorEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('Error')
          .setDescription('There was an error while executing this command!');
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
        } else {
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
      }
    } 
    // Handle button interactions
    else if (interaction.isButton()) {
      // Handle verification code button
      if (interaction.customId === 'verify_code') {
        const userId = interaction.user.id;
        
        // Check if the user has an active session
        if (!activeSessions.has(userId)) {
          await interaction.reply({ 
            content: 'You do not have an active account creation session or your session has expired. Please use the `/create` command again.', 
            ephemeral: true 
          });
          return;
        }
        
        // Create a modal for verification code
        const modal = new ModalBuilder()
          .setCustomId('verification_modal')
          .setTitle('Verification Code');
        
        // Add input fields to the modal
        const codeInput = new TextInputBuilder()
          .setCustomId('verificationCode')
          .setLabel('Enter the verification code from your email')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('e.g. 123456');
        
        const actionRow = new ActionRowBuilder().addComponents(codeInput);
        modal.addComponents(actionRow);
        
        // Show the modal to the user
        await interaction.showModal(modal);
      }
      // Handle batch verification button
      else if (interaction.customId.startsWith('batch_verify_')) {
        const batchId = interaction.customId.replace('batch_verify_', '');
        
        // Check if the batch exists
        if (!batchSessions.has(batchId)) {
          await interaction.reply({ 
            content: 'This batch session has expired or does not exist. Please start a new batch.',
            ephemeral: true 
          });
          return;
        }
        
        // Check if the user owns this batch
        const batch = batchSessions.get(batchId);
        if (batch.userId !== interaction.user.id) {
          await interaction.reply({ 
            content: 'You do not have permission to verify accounts in this batch.',
            ephemeral: true 
          });
          return;
        }
        
        // Create a modal for batch verification
        const modal = new ModalBuilder()
          .setCustomId(`batch_verification_modal_${batchId}`)
          .setTitle('Batch Verification');
        
        // Add input fields to the modal
        const emailInput = new TextInputBuilder()
          .setCustomId('batchEmail')
          .setLabel('Enter the email to verify')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('e.g. user@gmail.com');
        
        const codeInput = new TextInputBuilder()
          .setCustomId('batchVerificationCode')
          .setLabel('Enter the verification code from your email')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('e.g. 123456');
        
        const emailRow = new ActionRowBuilder().addComponents(emailInput);
        const codeRow = new ActionRowBuilder().addComponents(codeInput);
        modal.addComponents(emailRow, codeRow);
        
        // Show the modal to the user
        await interaction.showModal(modal);
      }
    }
    // Handle modal submissions
    else if (interaction.isModalSubmit()) {
      // Handle single account verification
      if (interaction.customId === 'verification_modal') {
        const userId = interaction.user.id;
        const code = interaction.fields.getTextInputValue('verificationCode');
        
        // Check if the user has an active session
        if (!activeSessions.has(userId)) {
          await interaction.reply({ 
            content: 'Your session has expired. Please use the `/create` command again.', 
            ephemeral: true 
          });
          return;
        }
        
        // Get the session information
        const session = activeSessions.get(userId);
        
        // Let the user know we're verifying
        await interaction.reply({ 
          content: 'Verifying your account...', 
          ephemeral: true 
        });
        
        // Verify and register the account
        const registerResult = await neTeaseUtils.verifyAndRegister(
          session.email, 
          code, 
          session.username, 
          session.password, 
          session.deviceId, 
          session.ticket
        );
        
        // If registration was successful
        if (registerResult.code === 0) {
          // Save the account information
          await neTeaseUtils.saveAccountInfo(session.email, session.username, session.password);
          
          // Create a success embed
          const successEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Account Created Successfully')
            .setDescription('Your NetEase account has been created!')
            .addFields(
              { name: 'Email', value: session.email },
              { name: 'Username', value: session.username },
              { name: 'Password', value: session.password }
            )
            .setFooter({ text: 'Account details have been saved to accounts.txt' });
          
          await interaction.editReply({ embeds: [successEmbed], ephemeral: true });
          
          // Remove the session
          activeSessions.delete(userId);
        } else {
          // Create a failure embed
          const failureEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Account Creation Failed')
            .setDescription(`Failed to create account: ${registerResult.msg || 'Unknown error'}`)
            .setFooter({ text: 'Please try again or use a different email address' });
          
          await interaction.editReply({ embeds: [failureEmbed], ephemeral: true });
        }
      }
      // Handle batch verification
      else if (interaction.customId.startsWith('batch_verification_modal_')) {
        const batchId = interaction.customId.replace('batch_verification_modal_', '');
        const email = interaction.fields.getTextInputValue('batchEmail');
        const code = interaction.fields.getTextInputValue('batchVerificationCode');
        
        // Check if the batch exists
        if (!batchSessions.has(batchId)) {
          await interaction.reply({ 
            content: 'This batch session has expired or does not exist. Please start a new batch.',
            ephemeral: true 
          });
          return;
        }
        
        const batch = batchSessions.get(batchId);
        
        // Check if the email exists in the batch sessions
        if (!batch.sessions.has(email)) {
          await interaction.reply({ 
            content: `Email ${email} is not part of this batch or has already been processed.`,
            ephemeral: true 
          });
          return;
        }
        
        // Get the session information
        const session = batch.sessions.get(email);
        
        // Let the user know we're verifying
        await interaction.reply({ 
          content: `Verifying account for ${email}...`, 
          ephemeral: true 
        });
        
        // Verify and register the account
        const registerResult = await neTeaseUtils.verifyAndRegister(
          session.email, 
          code, 
          session.username, 
          session.password, 
          session.deviceId, 
          session.ticket
        );
        
        // If registration was successful
        if (registerResult.code === 0) {
          // Save the account information
          await neTeaseUtils.saveAccountInfo(session.email, session.username, session.password);
          
          // Create a success embed
          const successEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Account Created Successfully')
            .setDescription(`Account for ${email} has been created!`)
            .addFields(
              { name: 'Email', value: session.email },
              { name: 'Username', value: session.username },
              { name: 'Password', value: session.password }
            )
            .setFooter({ text: 'Account details have been saved to accounts.txt' });
          
          await interaction.editReply({ embeds: [successEmbed], ephemeral: true });
          
          // Move from sessions to completed
          batch.completedEmails.push(email);
          batch.sessions.delete(email);
          
          // Update batch status
          if (batch.pendingEmails.length === 0 && batch.sessions.size === 0) {
            // Batch is complete
            const completeEmbed = new EmbedBuilder()
              .setColor(0x00FF00)
              .setTitle('Batch Account Creation Complete')
              .setDescription(`Created ${batch.completedEmails.length} out of ${batch.count} accounts.`)
              .addFields(
                { name: 'Successful Accounts', value: batch.completedEmails.length.toString() },
                { name: 'Failed Accounts', value: batch.failedEmails.length.toString() }
              )
              .setFooter({ text: 'All account details have been saved to accounts.txt' });
            
            await interaction.followUp({ embeds: [completeEmbed], ephemeral: true });
            
            // Remove the batch session
            batchSessions.delete(batchId);
          } else {
            // Batch is still in progress
            await updateBatchStatus(interaction, batchId);
          }
        } else {
          // Create a failure embed
          const failureEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Account Creation Failed')
            .setDescription(`Failed to create account for ${email}: ${registerResult.msg || 'Unknown error'}`)
            .setFooter({ text: 'Please try again or use a different email' });
          
          await interaction.editReply({ embeds: [failureEmbed], ephemeral: true });
          
          // Move from sessions to failed
          batch.failedEmails.push({ email, error: registerResult.msg || 'Unknown error' });
          batch.sessions.delete(email);
          
          // Update batch status
          await updateBatchStatus(interaction, batchId);
        }
      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
  }
});

// Function to update batch status for modals
async function updateBatchStatus(interaction, batchId) {
  const batch = batchSessions.get(batchId);
  
  if (!batch) {
    return;
  }
  
  // Create an embed to show the batch status
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('NetEase Batch Account Creation - Update')
    .setDescription(`Batch creation process for ${batch.count} accounts using ${batch.baseEmail} as base email.`)
    .addFields(
      { name: 'Total Accounts', value: batch.count.toString() },
      { name: 'Pending Emails', value: batch.pendingEmails.length.toString() },
      { name: 'Pending Verification', value: batch.sessions.size.toString() },
      { name: 'Completed Accounts', value: batch.completedEmails.length.toString() },
      { name: 'Failed Accounts', value: batch.failedEmails.length.toString() }
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
  
  await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });
}

// Login to Discord
client.login(process.env.DISCORD_TOKEN);