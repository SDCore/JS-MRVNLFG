import { Message, TextableChannel, EmbedOptions, VoiceChannel, User } from "eris";
import moment from "moment-timezone";
import humanizeDuration from "humanize-duration";
import { eventsEvent } from "../types";
import { resolveMember, resolveUser } from "../../../utils";

export const EventReactionAddOrganizerEvt = eventsEvent({
  event: "messageReactionAdd",

  async listener(meta) {
    const pluginData = meta.pluginData;
    const cfg = pluginData.config.get();
    const msg = (await pluginData.client.getMessage(meta.args.message.channel.id, meta.args.message.id)) as Message;
    const emoji = meta.args.emoji;
    const reactor = await resolveMember(pluginData.client, pluginData.guild, meta.args.userID);

    if (msg.channel.id === cfg.organizer_channel) {
      const participant = await pluginData.state.guildEventParticipants.getByRequestId(msg.id);
      if (participant.accepted != null) return;

      const evt = await pluginData.state.guildEvents.findByEventId(participant.event_id, true);
      if (!evt) return;

      const usr = (await resolveUser(pluginData.client, participant.user_id)) as User;
      let embed: EmbedOptions = {
        fields: [],
      };

      if (emoji.name === "👎") {
        embed = {
          fields: [],
        };
        embed.author = { name: usr.username, icon_url: usr.avatarURL };
        embed.title = `User was denied from this event by ${reactor.username}#${reactor.discriminator}:`;
        embed.description = `Event Name: **${evt.title}**\nEvent by: <@${evt.creator_id}>`;
        embed.color = 0xf02f22;
        await msg.removeReactions();
        await msg.edit({ embed });
        pluginData.state.guildEventParticipants.setAcceptedForEventIdAndUserId(evt.id, participant.user_id, false);
        return;
      }

      const vc = pluginData.guild.channels.get(evt.voice_id) as VoiceChannel;
      await vc.editPermission(participant.user_id, 1048576, 0, "member");

      embed.author = { name: reactor.username, icon_url: reactor.avatarURL };
      embed.title = `You have been accepted to the event \`${evt.title}\`!`;
      embed.description =
        evt.description + `\n\nPlease be in the voice channel named \`${evt.id}\` at the specified time!`;
      embed.color = 0x16d94d;
      (await usr.getDMChannel()).createMessage({ embed });

      await msg.removeReactions();
      embed = {
        fields: [],
      };
      embed.author = { name: usr.username, icon_url: usr.avatarURL };
      embed.title = `User was accepted to this event by ${reactor.username}#${reactor.discriminator}:`;
      embed.description = `Event Name: **${evt.title}**\nEvent by: <@${evt.creator_id}>`;
      embed.color = 0x16d94d;
      await msg.edit({ embed });
      pluginData.state.guildEventParticipants.setAcceptedForEventIdAndUserId(evt.id, participant.user_id, true);
    }
  },
});

export const EventReactionAddAnnouncementEvt = eventsEvent({
  event: "messageReactionAdd",

  async listener(meta) {
    const pluginData = meta.pluginData;
    const cfg = pluginData.config.get();
    const msg = meta.args.message as Message;
    const emoji = meta.args.emoji;
    const reactor = await resolveMember(pluginData.client, pluginData.guild, meta.args.userID);

    if (emoji.name !== "👍") return;
    if (msg.channel.id === cfg.events_announce_channel) {
      const event = await pluginData.state.guildEvents.getEventForAnnounceId(msg.id);
      if (!event) return;

      const participant = await pluginData.state.guildEventParticipants.getByEventAndUserId(event.id, reactor.id);
      if (participant) return;

      const organizerChan = pluginData.guild.channels.get(cfg.organizer_channel) as TextableChannel;

      const embed: EmbedOptions = {
        fields: [],
      };
      embed.author = { name: reactor.username, icon_url: reactor.avatarURL };
      embed.title = `A user wants to join this event:`;
      embed.description = `Event Name: **${event.title}**\nEvent by: <@${event.creator_id}>`;
      embed.fields.push({
        name: "Account Age:",
        value: humanizeDuration(moment().valueOf() - reactor.createdAt, {
          largest: 2,
          round: true,
        }),
        inline: true,
      });
      embed.fields.push({
        name: "Joined at:",
        value: humanizeDuration(moment().valueOf() - reactor.joinedAt, {
          largest: 2,
          round: true,
        }),
        inline: true,
      });
      embed.color = 0xe9ed07;

      const askMsg = await organizerChan.createMessage({ embed });
      pluginData.state.guildEventParticipants.add(event.id, reactor.id, askMsg.id, null);
      askMsg.addReaction("👍");
      askMsg.addReaction("👎");
    }
  },
});
