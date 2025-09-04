const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');

// Bot configuration
const TOKEN = 'YOUR_BOT_TOKEN_HERE';
const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
const GUILD_ID = 'YOUR_GUILD_ID_HERE'; // Optional: for guild-specific commands

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Slash command definitions
const commands = [
    new SlashCommandBuilder()
        .setName('tiktok-user')
        .setDescription('Get TikTok user profile information')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('TikTok username')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('instagram-user')
        .setDescription('Get Instagram user profile information')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Instagram username')
                .setRequired(true)
        )
];

// Function to get TikTok user data using web scraping
async function getTikTokUser(username) {
    try {
        // Remove @ symbol if present
        const cleanUsername = username.replace('@', '');
        
        // Method 1: Try using TikTok's public API endpoint
        try {
            const response = await axios.get(`https://www.tiktok.com/@${cleanUsername}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            // Extract JSON data from the page
            const $ = cheerio.load(response.data);
            const scriptTags = $('script[id="__UNIVERSAL_DATA_FOR_REHYDRATION__"]');
            
            if (scriptTags.length > 0) {
                const jsonData = JSON.parse(scriptTags.first().html());
                const userInfo = jsonData.__DEFAULT_SCOPE__['webapp.user-detail'].userInfo;
                const stats = userInfo.stats;
                const user = userInfo.user;

                return {
                    success: true,
                    data: {
                        username: user.uniqueId,
                        displayName: user.nickname,
                        followers: stats.followerCount,
                        following: stats.followingCount,
                        likes: stats.heartCount,
                        verified: user.verified,
                        bio: user.signature,
                        avatar: user.avatarMedium,
                        profileUrl: `https://www.tiktok.com/@${cleanUsername}`
                    }
                };
            }
        } catch (error) {
            console.log('TikTok scraping method failed, trying alternative...');
        }

        // Method 2: Use a free third-party API (TikTok API by Toolhouse - has free tier)
        try {
            const response = await axios.get(`https://api.tiklydown.eu.org/api/user/info?username=${cleanUsername}`);
            
            if (response.data && response.data.status === 200) {
                const user = response.data.result;
                return {
                    success: true,
                    data: {
                        username: user.unique_id,
                        displayName: user.nickname,
                        followers: user.follower_count,
                        following: user.following_count,
                        likes: user.heart_count,
                        verified: user.verified,
                        bio: user.signature,
                        avatar: user.avatar_300x300?.url_list?.[0] || user.avatar_168x168?.url_list?.[0],
                        profileUrl: `https://www.tiktok.com/@${cleanUsername}`
                    }
                };
            }
        } catch (error) {
            console.log('Alternative TikTok API failed');
        }

        // Fallback: Return basic profile info without stats
        return {
            success: true,
            data: {
                username: cleanUsername,
                displayName: cleanUsername,
                followers: 'N/A',
                following: 'N/A',
                likes: 'N/A',
                verified: false,
                bio: 'Unable to fetch detailed information',
                avatar: null,
                profileUrl: `https://www.tiktok.com/@${cleanUsername}`
            }
        };

    } catch (error) {
        console.error('TikTok Error:', error.message);
        return { success: false, error: 'Failed to fetch TikTok user data' };
    }
}

// Function to get Instagram user data using web scraping
async function getInstagramUser(username) {
    try {
        // Remove @ symbol if present
        const cleanUsername = username.replace('@', '');
        
        // Method 1: Try Instagram's public endpoints
        try {
            const response = await axios.get(`https://www.instagram.com/${cleanUsername}/`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            
            // Look for JSON data in script tags
            const scripts = $('script[type="application/ld+json"]');
            let userData = null;

            scripts.each((i, script) => {
                try {
                    const jsonData = JSON.parse($(script).html());
                    if (jsonData['@type'] === 'Person' || jsonData.mainEntityOfPage) {
                        userData = jsonData;
                        return false; // break loop
                    }
                } catch (e) {
                    // Continue to next script tag
                }
            });

            if (userData) {
                return {
                    success: true,
                    data: {
                        username: cleanUsername,
                        displayName: userData.name || cleanUsername,
                        followers: userData.interactionStatistic?.find(stat => 
                            stat.interactionType === 'https://schema.org/FollowAction'
                        )?.userInteractionCount || 'N/A',
                        following: 'N/A',
                        posts: 'N/A',
                        verified: false,
                        bio: userData.description || '',
                        avatar: userData.image?.[0] || null,
                        profileUrl: `https://www.instagram.com/${cleanUsername}/`
                    }
                };
            }
        } catch (error) {
            console.log('Instagram scraping method failed, trying alternative...');
        }

        // Method 2: Use Instagram Basic Display API alternative (free service)
        try {
            // This is a hypothetical free service - you might need to find an actual one
            const response = await axios.get(`https://api.instagram.com/v1/users/search?q=${cleanUsername}&access_token=YOUR_FREE_TOKEN`);
            // Process response...
        } catch (error) {
            console.log('Alternative Instagram API failed');
        }

        // Fallback: Return basic profile info
        return {
            success: true,
            data: {
                username: cleanUsername,
                displayName: cleanUsername,
                followers: 'N/A',
                following: 'N/A',
                posts: 'N/A',
                verified: false,
                bio: 'Unable to fetch detailed information',
                avatar: null,
                profileUrl: `https://www.instagram.com/${cleanUsername}/`
            }
        };

    } catch (error) {
        console.error('Instagram Error:', error.message);
        return { success: false, error: 'Failed to fetch Instagram user data' };
    }
}

// Format number with commas
function formatNumber(num) {
    if (num === 'N/A' || num === null || num === undefined) return 'N/A';
    
    if (typeof num === 'string') return num;
    
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Bot ready event
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'tiktok-user') {
        await interaction.deferReply();
        
        const username = interaction.options.getString('username');
        const result = await getTikTokUser(username);

        if (!result.success) {
            await interaction.editReply({
                content: `❌ Error: ${result.error}`
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle(`${result.data.displayName} (@${result.data.username})`)
            .setURL(result.data.profileUrl)
            .addFields(
                { name: '👥 Followers', value: formatNumber(result.data.followers), inline: true },
                { name: '➕ Following', value: formatNumber(result.data.following), inline: true },
                { name: '❤️ Likes', value: formatNumber(result.data.likes), inline: true }
            )
            .setFooter({ text: 'TikTok Profile', iconURL: 'https://cdn-icons-png.flaticon.com/512/3046/3046126.png' })
            .setTimestamp();

        if (result.data.avatar) {
            embed.setThumbnail(result.data.avatar);
        }

        if (result.data.verified) {
            embed.setTitle(`${result.data.displayName} (@${result.data.username}) ✅`);
        }

        if (result.data.bio && result.data.bio !== 'Unable to fetch detailed information') {
            embed.setDescription(result.data.bio);
        }

        await interaction.editReply({ embeds: [embed] });

    } else if (commandName === 'instagram-user') {
        await interaction.deferReply();
        
        const username = interaction.options.getString('username');
        const result = await getInstagramUser(username);

        if (!result.success) {
            await interaction.editReply({
                content: `❌ Error: ${result.error}`
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0xE4405F)
            .setTitle(`${result.data.displayName} (@${result.data.username})`)
            .setURL(result.data.profileUrl)
            .addFields(
                { name: '👥 Followers', value: formatNumber(result.data.followers), inline: true },
                { name: '➕ Following', value: formatNumber(result.data.following), inline: true },
                { name: '📸 Posts', value: formatNumber(result.data.posts), inline: true }
            )
            .setFooter({ text: 'Instagram Profile', iconURL: 'https://cdn-icons-png.flaticon.com/512/2111/2111463.png' })
            .setTimestamp();

        if (result.data.avatar) {
            embed.setThumbnail(result.data.avatar);
        }

        if (result.data.verified) {
            embed.setTitle(`${result.data.displayName} (@${result.data.username}) ✅`);
        }

        if (result.data.bio && result.data.bio !== 'Unable to fetch detailed information') {
            embed.setDescription(result.data.bio);
        }

        await interaction.editReply({ embeds: [embed] });
    }
});

// Register slash commands
async function registerCommands() {
    try {
        console.log('Started refreshing application (/) commands.');

        const rest = new REST({ version: '10' }).setToken(TOKEN);

        // For guild commands (faster for testing)
        if (GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: commands }
            );
            console.log('Successfully reloaded guild application (/) commands.');
        } else {
            // For global commands (takes up to 1 hour to update)
            await rest.put(
                Routes.applicationCommands(CLIENT_ID),
                { body: commands }
            );
            console.log('Successfully reloaded global application (/) commands.');
        }
    } catch (error) {
        console.error(error);
    }
}

// Start the bot
registerCommands();
client.login(TOKEN);
