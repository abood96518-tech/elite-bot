const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});

const TOKEN = '';

const CLIENT_ID = '1532623342014562305'; 

const GUILD_ID = '1519570369239978104'; 

const POINTS_MANAGER_ROLE_ID = '1525983109269553202'; 

const LOG_CHANNEL_ID = '1526079419041447947';

const RANKS_CONFIG = [
    { pointsRequired: 250, roleId: '1525983961057198281' },
    { pointsRequired: 500, roleId: '1525983943638126632' },
    { pointsRequired: 750, roleId: '1525983987951079464' },  
    { pointsRequired: 1000, roleId: '1525984019672596592' }
];

const userPoints = new Map();

client.once('ready', async (c) => {
    console.log(`[BOT] Connected successfully as: ${c.user.tag}`);

    const commands = [
        new SlashCommandBuilder()
            .setName('اضافة_نقاط')
            .setDescription('إضافة نقاط لعضو مخصص (للمسؤولين فقط)')
            .addUserOption(opt => opt.setName('العضو').setDescription('اختر العضو المراد إضافة نقاط له').setRequired(true))
            .addIntegerOption(opt => opt.setName('النقاط').setDescription('عدد النقاط المراد إضافتها').setRequired(true)),

        new SlashCommandBuilder()
            .setName('خصم_نقاط')
            .setDescription('خصم نقاط من عضو (للمسؤولين فقط)')
            .addUserOption(opt => opt.setName('العضو').setDescription('اختر العضو المراد الخصم منه').setRequired(true))
            .addIntegerOption(opt => opt.setName('النقاط').setDescription('عدد النقاط المراد خصمها').setRequired(true)),

        new SlashCommandBuilder()
            .setName('نقاطي')
            .setDescription('عرض رصيد نقاطك الحالي')
            .addUserOption(opt => opt.setName('العضو').setDescription('اختر عضو لرؤية نقاطه (اختياري)').setRequired(false))
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log('[SLASH] Registering guild commands...');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), 
            { body: commands }
        );
        console.log('✨ تم تسجيل الأوامر بنجاح وتعمل الآن فوراً داخل السيرفر!');
    } catch (error) {
        console.error('[ERROR] Failed to register commands:', error);
    }
});

async function checkAndGrantRank(member, totalPoints, channel) {
    const sortedRanks = [...RANKS_CONFIG].sort((a, b) => b.pointsRequired - a.pointsRequired);

    const targetRank = sortedRanks.find(r => totalPoints >= r.pointsRequired);

    if (targetRank) {
        const hasRole = member.roles.cache.has(targetRank.roleId);
        
        if (!hasRole) {
            const allRankRoleIDs = RANKS_CONFIG.map(r => r.roleId);
            await member.roles.remove(allRankRoleIDs).catch(() => {});
            await member.roles.add(targetRank.roleId).catch(() => {});

            if (channel) {
                const upgradeEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🎉 ترقية تلقائية جديد!')
                    .setDescription(`مبروك للعضو ${member}! تم ترقيته تلقائياً للحصول على الرتبة <@&${targetRank.roleId}> لتخطيه **${totalPoints}** نقطة.`)
                    .setTimestamp();
                await channel.send({ embeds: [upgradeEmbed] });
            }
        }
    }
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, member, guild } = interaction;

    if (commandName === 'اضافة_نقاط') {
        const isManager = member.roles.cache.has(POINTS_MANAGER_ROLE_ID) || member.permissions.has('Administrator');
        if (!isManager) {
            return interaction.reply({ content: '❌ ليس لديك صلاحية مسؤول النقاط لاستخدام هذا الأمر!', ephemeral: true });
        }

        const targetUser = options.getUser('العضو');
        const pointsToAdd = options.getInteger('النقاط');
        const targetMember = await guild.members.fetch(targetUser.id);

        const currentPoints = userPoints.get(targetUser.id) || 0;
        const newTotal = currentPoints + pointsToAdd;
        userPoints.set(targetUser.id, newTotal);

        await interaction.reply({ content: `✅ تم إضافة **${pointsToAdd}** نقطة للعضو ${targetUser}. المجموع الحالي: **${newTotal}** نقطة.`, ephemeral: true });

        const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor('#3b82f6')
                .setTitle('📥 إيداع نقاط')
                .addFields(
                    { name: 'العضو', value: `${targetUser}`, inline: true },
                    { name: 'المسؤول', value: `${member}`, inline: true },
                    { name: 'النقاط المضافة', value: `+${pointsToAdd}`, inline: true },
                    { name: 'مجموع النقاط', value: `${newTotal}`, inline: true }
                )
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
        }

        await checkAndGrantRank(targetMember, newTotal, logChannel);
    }

    if (commandName === 'خصم_نقاط') {
        const isManager = member.roles.cache.has(POINTS_MANAGER_ROLE_ID) || member.permissions.has('Administrator');
        if (!isManager) {
            return interaction.reply({ content: '❌ ليس لديك صلاحية مسؤول النقاط لاستخدام هذا الأمر!', ephemeral: true });
        }

        const targetUser = options.getUser('العضو');
        const pointsToDeduct = options.getInteger('النقاط');
        const targetMember = await guild.members.fetch(targetUser.id);

        const currentPoints = userPoints.get(targetUser.id) || 0;
        const newTotal = Math.max(0, currentPoints - pointsToDeduct);
        userPoints.set(targetUser.id, newTotal);

        await interaction.reply({ content: `✅ تم خصم **${pointsToDeduct}** نقطة من ${targetUser}. المجموع الحالي: **${newTotal}** نقطة.`, ephemeral: true });

        const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor('#ef4444')
                .setTitle('📤 خصم نقاط')
                .addFields(
                    { name: 'العضو', value: `${targetUser}`, inline: true },
                    { name: 'المسؤول', value: `${member}`, inline: true },
                    { name: 'النقاط المخصومة', value: `-${pointsToDeduct}`, inline: true },
                    { name: 'مجموع النقاط', value: `${newTotal}`, inline: true }
                )
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
        }

        await checkAndGrantRank(targetMember, newTotal, logChannel);
    }

    if (commandName === 'نقاطي') {
        const targetUser = options.getUser('العضو') || interaction.user;
        const points = userPoints.get(targetUser.id) || 0;

        const infoEmbed = new EmbedBuilder()
            .setColor('#eab308')
            .setTitle(`📊 رصيد نقاط ${targetUser.username}`)
            .setDescription(`مجموع النقاط الحالي هو: **${points}** نقطة.`)
            .setTimestamp();

        await interaction.reply({ embeds: [infoEmbed] });
    }
});

client.login(TOKEN);
