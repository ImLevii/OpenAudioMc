import GainController from "mediastream-gain";
import {AudioCableMiddleware} from "./AudioCableMiddleware";
import {getGlobalState, setGlobalState, store} from "../../../../state/store";
import {WorldModule} from "../../world/WorldModule";
import {VoiceModule} from "../VoiceModule";
import {RtcPacket} from "../peers/protocol";
import {Hark} from "../../../util/hark";
import {makeid} from "../../../util/random";
import {feedDebugValue} from "../../debugging/DebugService";
import {DebugStatistic} from "../../debugging/DebugStatistic";

let micVolumeListeners = {};

export function addMicVolumeListener(callback) {
    let id = makeid(10);
    micVolumeListeners[id] = callback;
    return id;
}

export function removeMicVolumeListener(id) {
    delete micVolumeListeners[id];
}

function invokeMicVolumeListeners(volume, isActive) {
    for (let id in micVolumeListeners) {
        micVolumeListeners[id](volume, isActive);
    }
}

export class MicrophoneProcessor {

    constructor(stream) {
        this.stream = stream;
        this.startedTalking = null;
        this.shortTriggers = 0;
        this.isStreaming = false;
        this.isMuted = false;

        this.harkEvents = new Hark(this.stream)
        this.gainController = new GainController(stream);
        this.gainController.on();

        this.loadDefaults();
        this.monitoringVolume = 100;
        this.longSessions = 0;

        this.inputStreamSource = stream;

        let lastMonitoringState = false;
        this.lastAutoAdjustmentsState = false;
        let lastStateMuted = false;
        this.enableMonitoringCheckbox = () => {
            throw new Error("Not implemented")
        };

        let onSettingsChange = () => {
            let {settings} = store.getState();
            if (settings.voicechatMonitoringEnabled !== lastMonitoringState) {
                lastMonitoringState = settings.voicechatMonitoringEnabled;
                this.enableMonitoringCheckbox(lastMonitoringState);
            }

            if (settings.microphoneSensitivity !== this.lastAutoAdjustmentsState) {
                this.lastAutoAdjustmentsState = settings.microphoneSensitivity;
                this.updateSensitivity(this.lastAutoAdjustmentsState);
            }

            if (settings.voicechatMuted !== lastStateMuted) {
                lastStateMuted = settings.voicechatMuted;
                if (lastStateMuted) {
                    this.onMute();
                } else {
                    this.onUnmute();
                }
            }
        }
        onSettingsChange = onSettingsChange.bind(this);
        store.subscribe(onSettingsChange)

        this.setupTrackProcessing(stream)

        // automatically check through a task how long the current speech is
        this.checkLoop = setInterval(() => {
            if (!this.isSpeaking) return;
            let timeActive = new Date().getTime() - this.startedTalking;
            let secondsTalked = (timeActive / 1000);

            if (secondsTalked > 10) {
                this.longSessions++;
                this.startedTalking = new Date().getTime();
            }

            if (this.longSessions > 1) {
                this.decreaseSensitivity()
                this.longSessions = 0;
                this.startedTalking = new Date().getTime();
            }

        }, 500);


        let lowestVolume = 0;
        let volumeChangeI = 0;
        this.harkEvents.on('volume_change', (volume, threshold) => {
            volumeChangeI++;
            if (volumeChangeI % 5 !== 0) return;

            if (volume < lowestVolume && lowestVolume > -Infinity && volume > -Infinity) {
                lowestVolume = volume;
            }
            let output = Math.abs(volume - lowestVolume);
            // only once every 500 times
            if (volumeChangeI > 100) {
                feedDebugValue(DebugStatistic.MICROPHONE_LOUDNESS, output);
                volumeChangeI = 0;
            }

            invokeMicVolumeListeners(output, volume >= threshold)
        })

        this.hookListeners();
        onSettingsChange(); // init self
    }

    updateSensitivity(toPositive) {
        let target = -Math.abs(toPositive)
        console.log("Updating sensitivity to", target)
        this.harkEvents.setThreshold(target)
        this.currentThreshold = this.harkEvents.getThreshold();

        // update global state, but first update self to prevent infinite loop
        this.lastAutoAdjustmentsState = toPositive;
        setGlobalState({settings: {microphoneSensitivity: toPositive}})
    }

    decreaseSensitivity() {
        if (!getGlobalState().settings.automaticSensitivity) return;
        let current = Math.abs(this.currentThreshold);
        current -= 5;
        this.updateSensitivity(current)
    }

    onMute() {
        this.isMuted = true;
        if (this.isSpeaking) {
            this.shouldStream(false);
        }
    }

    onUnmute() {
        this.isMuted = false;
        if (this.isSpeaking) {
            this.shouldStream(true);
        }
    }

    onSpeakStart() {
        if (this.isMuted) return;
        this.shouldStream(true);
    }

    onSpeakEnd() {
        if (this.isMuted) return;
        this.shouldStream(false);
    }

    stop() {
        this.harkEvents.stop()
        clearInterval(this.checkLoop)
    }

    shouldStream(state) {
        if (state) {
            // create start rtc notification
            if (!this.isStreaming) {
                this.isStreaming = true;
                if (VoiceModule.isReady()) {
                    VoiceModule.peerManager.sendMetaData(
                        new RtcPacket()
                            .setEventName("DISTRIBUTE_RTP")
                            .serialize()
                    )
                }
            }

            setGlobalState({voiceState: {isSpeaking: true}})

            clearTimeout(this.haltRtpTask);
            // this.gainController.on();
        } else {
            this.haltRtpTask = setTimeout(() => {
                if (VoiceModule.isReady()) {
                    this.isStreaming = false;
                    VoiceModule.peerManager.sendMetaData(
                        new RtcPacket()
                            .setEventName("HALT_RTP")
                            .serialize()
                    )
                }
            }, 500);

            setGlobalState({voiceState: {isSpeaking: false}})
            // this.gainController.off();
        }
    }

    loadDefaults() {
        let presetVolume = getGlobalState().settings.microphoneSensitivity;
        if (presetVolume != null) {
            presetVolume = parseInt(presetVolume)
            this.harkEvents.setThreshold(presetVolume)
        }
        this.currentThreshold = this.harkEvents.getThreshold();
        this.isSpeaking = false;
        this.harkEvents.setInterval(5)
    }

    hookListeners() {
        this.harkEvents.on('speaking', () => {
            this.isSpeaking = true;
            this.startedTalking = new Date().getTime();
            this.setMonitoringVolume(this.monitoringVolume)

            // set talking UI
            this.onSpeakStart()
        });

        this.harkEvents.on('stopped_speaking', () => {
            this.isSpeaking = false;

            // set talking UI
            this.onSpeakEnd()
            this.monitoringGainnode.gain.value = 0;

            // how long did I talk for?
            let timeActive = new Date().getTime() - this.startedTalking;
            let secondsTalked = (timeActive / 1000);
            if (secondsTalked < 1.5) {
                this.shortTriggers++;
                if (this.shortTriggers > 25) {
                    this.decreaseSensitivity();
                    this.shortTriggers = 0;
                }
            } else {
                this.shortTriggers = 0;
            }
        });
    }

    setMonitoringVolume(vol) {
        this.monitoringVolume = vol;
        this.monitoringGainnode.gain.value = (vol / 100);
    }

    setupTrackProcessing(stream) {
        const ctx = WorldModule.player.audioCtx;
        this.monitoringAudio = new Audio();
        this.monitoringAudio.muted = true;
        this.monitoringAudio.autoplay = true
        this.monitoringAudio.volume = 1
        this.output = ctx.createMediaStreamDestination()

        this.monitoringAudio.srcObject = this.output.stream;
        this.monitoringGainnode = ctx.createGain();

        this.enableMonitoringCheckbox = (allow) => {
            console.log("Allow monitoring?", allow)
            if (allow) {
                this.monitoringAudio.muted = false;
            } else {
                this.monitoringAudio.muted = true;
            }
        }
        this.enableMonitoringCheckbox = this.enableMonitoringCheckbox.bind(this);

        let src = ctx.createMediaStreamSource(this.inputStreamSource)

        let shiftMiddleware = new AudioCableMiddleware()
        shiftMiddleware.link(ctx, src, this.output)
        this.monitoringAudio.play()
            .then(() => {
                console.log("Playing monitoring audio")
            })
            .catch((e) => {
                console.log("Error playing monitoring audio", e)
            });

    }

}
