const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const neTeaseUtils = require('../utils/neTeaseUtils.js');

// A Map to store active sessions
const activeSessions = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create a NetEase account')
    .addStringOption(option => 
      option.setName('email')
        .setDescription('Your email address')
        .setRequired(true)),
  
  async execute(interaction) {
    // Get the email address from the command options
    const baseEmail = interaction.options.getString('email');
    
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
      content: `Starting account creation process for ${baseEmail}. This might take a moment...`, 
      ephemeral: true 
    });
    
    try {
      // Create a device ID for the session
      const deviceId = neTeaseUtils.generateDeviceId();
      console.log(`Using device ID: ${deviceId}`);
      
      // Step 1: Create ticket
      console.log("Step 1: Creating ticket...");
      const ticketResult = await neTeaseUtils.createTicket(deviceId);
      
      if (ticketResult.code !== 0 || !ticketResult.ticket) {
        await interaction.editReply(`Error creating ticket: ${ticketResult.msg || 'Unknown error'}`);
        return;
      }
      
      const ticket = ticketResult.ticket;
      console.log(`Ticket generated: ${ticket}`);
      
      // Create an array of email variations for Gmail emails
      let emailVariations = [baseEmail];
      if (baseEmail.toLowerCase().includes('@gmail.com')) {
        // Generate up to 5 variations for Gmail addresses
        emailVariations = neTeaseUtils.generateMultipleEmailVariations(baseEmail, 5);
        console.log(`Generated ${emailVariations.length} email variations to try.`);
      }
      
      // Variables to track the process
      let currentEmail = null;
      let username = null;
      let emailResult = null;
      let usernameResult = null;
      let sendResult = null;
      
      // Try each email variation until one works
      for (const email of emailVariations) {
        currentEmail = email;
        console.log(`Trying with email variation: ${currentEmail}`);
        
        // Step 2: Check email availability
        console.log(`Step 2: Checking email availability for ${currentEmail}...`);
        emailResult = await neTeaseUtils.checkEmailAvailability(currentEmail, deviceId, ticket);
        
        if (emailResult.code !== 0) {
          console.log(`Email not available: ${currentEmail}. Trying next variation...`);
          continue;
        }
        
        // Step 3: Generate username and check availability
        console.log("Step 3: Generating username...");
        username = neTeaseUtils.generateUsername();
        console.log(`Generated username: ${username}`);
        
        // Check username availability
        console.log("Step 4: Checking username availability...");
        usernameResult = await neTeaseUtils.checkUsernameAvailability(username, deviceId, ticket);
        
        // If username is not available, try to generate a new one
        if (usernameResult.code !== 0) {
          username = neTeaseUtils.generateUsername() + Math.floor(Math.random() * 1000);
          console.log(`New username generated: ${username}`);
          
          usernameResult = await neTeaseUtils.checkUsernameAvailability(username, deviceId, ticket);
          
          if (usernameResult.code !== 0) {
            console.log("Could not find an available username. Trying next email variation...");
            continue;
          }
        }
        
        // Step 5: Generate password
        console.log("Step 5: Generating password...");
        const password = neTeaseUtils.generatePassword();
        
        // Step 6: Now send verification code
        console.log(`Step 6: Sending verification code to ${currentEmail}...`);
        sendResult = await neTeaseUtils.sendVerificationCode(currentEmail, deviceId, ticket);
        
        if (sendResult.code !== 0) {
          console.log(`Failed to send verification code to ${currentEmail}. Trying next variation...`);
          continue;
        }
        
        console.log(`Verification code sent successfully to ${currentEmail}`);
        
        // Store session information
        const sessionId = interaction.user.id;
        activeSessions.set(sessionId, {
          email: currentEmail,
          username,
          password,
          deviceId,
          ticket,
          createdAt: Date.now()
        });
        
        // Create an embed to show the user the details and prompt for verification code
        const embed = new EmbedBuilder()
          .setColor(0x0099FF)
          .setTitle('NetEase Account Creation')
          .setDescription(`Verification code has been sent to **${currentEmail}**.`)
          .addFields(
            { name: 'Email', value: currentEmail },
            { name: 'Username', value: username },
            { name: 'Password', value: password }
          )
          .setFooter({ text: 'Please check your email and enter the verification code using the button below.' });
        
        // Add a button for the user to enter the verification code
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('verify_code')
              .setLabel('Enter Verification Code')
              .setStyle(ButtonStyle.Primary)
          );
        
        await interaction.editReply({ embeds: [embed], components: [row] });
        
        // Set a timeout to remove the session after 10 minutes
        setTimeout(() => {
          if (activeSessions.has(sessionId)) {
            activeSessions.delete(sessionId);
          }
        }, 10 * 60 * 1000); // 10 minutes
        
        // We found a working email, exit the loop
        return;
      }
      
      // If we get here, all email variations failed
      await interaction.editReply(`Failed to create an account with any email variation. Please try a different email.`);
      
    } catch (error) {
      console.error('Error in account creation process:', error);
      await interaction.editReply(`An unexpected error occurred: ${error.message}. Please try again later.`);
    }
  },
  
  // Making activeSessions accessible to other files
  activeSessions
};