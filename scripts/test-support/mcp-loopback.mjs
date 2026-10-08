const Native = globalThis.WebSocket;
const endpoint = process.env.COMMUNITY_BOARD_QA_RELAY;
if (!/^ws:\/\/127\.0\.0\.1:\d+$/.test(endpoint || ""))
  throw Error("Private loopback relay required");
globalThis.WebSocket = class extends Native {
  constructor(address, protocols) {
    const url = new URL(address);
    if (
      !["nos.lol", "relay.primal.net", "relay.ditto.pub"].includes(url.hostname)
    )
      throw Error("Unexpected relay");
    super(endpoint, protocols);
  }
};
