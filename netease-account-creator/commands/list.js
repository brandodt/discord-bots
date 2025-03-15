const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const neTeaseUtils = require('../utils/neTeaseUtils.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('List all created NetEase accounts'),
  
  async execute(interaction) {
    // Defer reply to get more time to process
    await interaction.deferReply({ ephemeral: true });
    
    // Get accounts from the file
    const accounts = await neTeaseUtils.getAccounts();
    
    if (accounts.length === 0) {
      await interaction.editReply('No accounts have been created yet.');
      return;
    }
    
    // Create an embed to display accounts
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('NetEase Accounts')
      .setDescription(`Found ${accounts.length} account(s)`)
      .setFooter({ text: 'All account details are stored in accounts.txt' });
    
    // Add accounts to embed (limit to first 10 to avoid reaching Discord's embed limits)
    const displayedAccounts = accounts.slice(0, 10);
    
    for (let i = 0; i < displayedAccounts.length; i++) {
      const account = displayedAccounts[i];
      embed.addFields({
        name: `Account ${i + 1}`,
        value: `Email: ${account.email}\nUsername: ${account.username}\nPassword: ${account.password}`
      });
    }
    
    if (accounts.length > 10) {
      embed.addFields({
        name: 'Note',
        value: `Only showing 10 out of ${accounts.length} accounts. Check accounts.txt for the complete list.`
      });
    }
    
    await interaction.editReply({ embeds: [embed] });
  }
};