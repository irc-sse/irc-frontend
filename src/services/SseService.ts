import { adminChannels, API_URL, MERCURE_URL } from "@/utils/env";
import { useChannelStore } from "@/stores/channel.store";
import axios from "axios";
import { useUserStore } from "@/stores/user.store";
import { ChannelApi } from "@/api/channel/channel";
import { Notyf } from "notyf";
import { ChannelService } from "@/services/ChannelService";
import router from "@/router";

export class SseService {
  private static eventSource: EventSource | undefined = undefined as EventSource | undefined;
  private static notyf = new Notyf({ position: { x: "right", y: "top" } });

  static createChannel = async (channelName: string) => {
    if(ChannelService.findChannelByName(channelName) || adminChannels.includes(channelName)){
      return this.notyf.error(`Le channel ${channelName} existe déjà !`)
    }
    await ChannelApi.createChannel(channelName)
    await router.push('/channel/' + channelName)
  }

  static initSseChannels = () => {
    const channelStore = useChannelStore();

    const eventSource = this.connectToTopic("topics");

    if (eventSource) {
      eventSource.onmessage = (e) => {
        if (channelStore) {
          channelStore.addChannel(JSON.parse(e.data));
        }
      };
    }

  };

  static connectToTopic(topic: string): EventSource | undefined {
    /*Channel SSE */
    const url = new URL(MERCURE_URL);
    url.searchParams.append("topic", topic);
    const eventSource = new EventSource(url, { withCredentials: true });

    /* Fix firefox warning */
    window.addEventListener("beforeunload", () => eventSource.close());
    return eventSource;
  }

  static getChannelMessages() {
    const channelStore = useChannelStore();

    if (this.eventSource) {
      this.eventSource.close();
    }
    this.eventSource = this.connectToTopic(channelStore.currentChannel);

    if (this.eventSource) {
      this.eventSource.onmessage = (e: { data: string }) => {
        if (!channelStore.messages[channelStore.currentChannel]) {
          channelStore.messages[channelStore.currentChannel] = [];
        }
        channelStore.messages[channelStore.currentChannel].push(JSON.parse(e.data).message);
      };
    }
  }

  static leaveChannel(channelName: string){
    if(!ChannelService.findChannelByName(channelName)){
      return this.notyf.error(`Le channel ${channelName} n'existe pas !`)
    }
    this.eventSource?.close()
  }

  static async addChannelMessage(message: string) {
    const channelStore = useChannelStore();
    const userStore = useUserStore();

    await axios.post(API_URL + "/chat/channel/" + channelStore.currentChannel, {
      message: {
        username: userStore.user?.username,
        content: message
      }
    });
  }
}