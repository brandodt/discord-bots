const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const neTeaseUtils = require('../utils/neTeaseUtils.js');
const { activeSessions } = require('./create.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verify a NetEase account with a verification code')
    .addStringOption(option => 
      option.setName('code')
        .setDescription('The verification code received via email')
        .setRequired(true)),
  
  async execute(interaction) {
    const code = interaction.options.getString('code');
    const userId = interaction.user.id;
    
    // Check if the user has an active session
    if (!activeSessions.has(userId)) {
      await interaction.reply({ 
        content: 'You do not have an active account creation session. Please use the `/create` command first.', 
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
};