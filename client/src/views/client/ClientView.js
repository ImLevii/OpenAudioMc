import React from "react";
import { TabPage, TabWindow } from "../../components/tabwindow/TabWindow";
import AudioPage from "./pages/audio/AudioPage";
import VoicePage from "./pages/voice/VoicePage";
import ResetLanguageBanner from "../../components/language/ResetLanguageBanner";
import SettingsPage from "./pages/settings/SettingsPage";
import { LoadingSpinnerBox } from "../../components/loading/LoadingSpinnerBox";
import { GrayoutPage } from "../../components/layout/GrayoutPage";
import { connect } from "react-redux";
import { StaticFooter } from "../../components/footer/StaticFooter";
import { InputModal } from "../../components/modal/InputModal";
import DebugPage from "./pages/debug/DebugPage";

import { SpeakerSvg } from "../../components/icons/speaker";
import { MicrophoneSVG } from "../../components/icons/microphone";
import { CogSVG } from "../../components/icons/cog";
import { DebugSVG } from "../../components/icons/debug";

class ClientView extends React.Component {
  render() {
    let { title, message, footer } = this.props.loadingOverlay;

    return (
      <div className="app">
        <div className="wrapper">
          <TabWindow>
            <TabPage
              name="Audio"
              content={<AudioPage />}
              buttonContent={<SpeakerSvg />}
            />
            <TabPage
              hidden={!this.props.voiceState.ready}
              buttonContent={<MicrophoneSVG />}
              name="Voice"
              content={<VoicePage />}
            />
            <TabPage
              name="Settings"
              buttonContent={<CogSVG />}
              content={<SettingsPage />}
            />
            <TabPage
              hidden={!this.props.debugMode}
              buttonContent={<DebugSVG />}
              name="Debug"
              content={<DebugPage />}
            />
          </TabWindow>
        </div>

        {this.props.loadingOverlay.visible && (
          <GrayoutPage>
            <LoadingSpinnerBox
              title={title}
              message={message}
              footer={footer}
            />
          </GrayoutPage>
        )}
        <ResetLanguageBanner />

        {this.props.fixedFooter && (
          <StaticFooter>{this.props.fixedFooter}</StaticFooter>
        )}
        {this.props.inputModal.visible && <InputModal />}
      </div>
    );
  }
}

export default connect(mapStateToProps)(ClientView);

function mapStateToProps(state) {
  return {
    debugMode: state.debug,
    inputModal: state.inputModal,
    fixedFooter: state.fixedFooter,
    loadingOverlay: state.loadingOverlay,
    voiceState: state.voiceState,
  };
}
