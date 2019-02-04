class OpenAudioMc {

    constructor() {
        //load cookies
        const hueOptions = {
            "userid": Cookies.get("hueid"),
            "group": Cookies.get("huegroup")
        };

        this.log("Enabling the web client for " + window.navigator.userAgent);
        this.debugPrint("starting.");
        this.timeService = new TimeService();
        this.messages = new Messages(this);
        this.userInterfaceModule = new UserInterfaceModule(this);
        this.hueModule = new HueModule(this, hueOptions);
        this.mediaManager = new MediaManager(this);
        this.socketModule = new SocketModule(this, "https://craftmendserver.eu");
        new Handlers(this);
        this.messages.apply();
    }

    log(message) {
        console.log("[OpenAudioMc] " + message);
    }

    getMessages() {
        return this.messages;
    }

    getTimeService() {
        return this.timeService;
    }

    debugPrint(message) {
        this.log(message);
    }

    getMediaManager() {
        return this.mediaManager;
    }

    getHueModule() {
        return this.hueModule;
    }

    getUserInterfaceModule() {
        return this.userInterfaceModule;
    }

}

//enable
let  openAudioMc = null;

function enable() {
    if (openAudioMc == null) {
        openAudioMc = new OpenAudioMc();
    }
}
