//APIs
import React from 'react';
import {
  Dimensions,
  Image,
  Slider,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av'; // expo audio api
import * as FileSystem from 'expo-file-system';
import * as Font from 'expo-font';
import * as Permissions from 'expo-permissions'; // API allow permissions to acess microphone
import * as Icons from './components/Icons';

import { IconButton } from 'react-native-paper';

// Variables 
const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = Dimensions.get('window');
const BACKGROUND_COLOR = '#212121';

const DISABLED_OPACITY = 0.5;

type Props = {};

type State = {
  haveRecordingPermissions: boolean;
  isLoading: boolean;
  isPlaybackAllowed: boolean;
  muted: boolean;
  soundPosition: number | null;
  soundDuration: number | null;
  recordingDuration: number | null;
  shouldPlay: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  fontLoaded: boolean;
  shouldCorrectPitch: boolean;
  volume: number;
  rate: number;
};

// The main class of the App.
export default class App extends React.Component<Props, State> {
  private recording: Audio.Recording | null;
  private sound: Audio.Sound | null;
  private isSeeking: boolean;
  private shouldPlayAtEndOfSeek: boolean;
  private readonly recordingSettings: Audio.RecordingOptions;
  
  // Initialization state (constructor).
  constructor(props: Props) {
    super(props);
    this.recording = null;
    this.sound = null;
    this.isSeeking = false;
    this.shouldPlayAtEndOfSeek = false;
    this.state = {
      haveRecordingPermissions: false,
      isLoading: false,
      isPlaybackAllowed: false,
      muted: false,
      soundPosition: null,
      soundDuration: null,
      recordingDuration: null,
      shouldPlay: false,
      isPlaying: false,
      isRecording: false,
      fontLoaded: false,
      shouldCorrectPitch: true,
      volume: 1.0,
      rate: 1.0,
    };
    this.recordingSettings = Audio.RECORDING_OPTIONS_PRESET_LOW_QUALITY;
  }
  // Set typography and call function for permission.
  componentDidMount() {
    (async () => {
      await Font.loadAsync({
        'cutive-mono-regular': require('./assets/fonts/Roboto-Regular.ttf'),
      });
      this.setState({ fontLoaded: true });
    })();
    this._askForPermissions();
  }

  // request audio recording permissions. 
  private _askForPermissions = async () => {
    const response = await Permissions.askAsync(Permissions.AUDIO_RECORDING);
    this.setState({
      haveRecordingPermissions: response.status === 'granted',
    });
  };

  //  Update status whose values will override the default initial playback status.
  private _updateScreenForSoundStatus = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      this.setState({
        soundDuration: status.durationMillis ?? null,
        soundPosition: status.positionMillis,
        shouldPlay: status.shouldPlay,
        isPlaying: status.isPlaying,
        rate: status.rate,
        muted: status.isMuted,
        volume: status.volume,
        shouldCorrectPitch: status.shouldCorrectPitch,
        isPlaybackAllowed: true,
      });
    } else {
      this.setState({
        soundDuration: null,
        soundPosition: null,
        isPlaybackAllowed: false,
      });
      if (status.error) {
        console.log(`FATAL PLAYER ERROR: ${status.error}`);
      }
    }
  };
  // Function for start Record.
  private _updateScreenForRecordingStatus = (status: Audio.RecordingStatus) => {
    if (status.canRecord) {
      this.setState({
        isRecording: status.isRecording,
        recordingDuration: status.durationMillis,
      });
    } else if (status.isDoneRecording) {
      this.setState({
        isRecording: false,
        recordingDuration: status.durationMillis,
      });
      if (!this.state.isLoading) {
        this._stopRecordingAndEnablePlayback();
      }
    }
  };
  // Function for Playback (return audio recorded).
  private async _stopPlaybackAndBeginRecording() {
    this.setState({
      isLoading: true,
    });
    if (this.sound !== null) {
      await this.sound.unloadAsync();
      this.sound.setOnPlaybackStatusUpdate(null);
      this.sound = null;
    }
    //API to customize the audio experience on iOS and Android.
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: true,
    });
    // setonRecordingStatusUpdate is called while the recording can record
    if (this.recording !== null) {
      this.recording.setOnRecordingStatusUpdate(null);
      this.recording = null;
    }
    
    // A newly constructed instance of Audio.Recording.
    const recording = new Audio.Recording();
    // Loads the recorder into memory and prepares it for recording.
    await recording.prepareToRecordAsync(this.recordingSettings);
    recording.setOnRecordingStatusUpdate(this._updateScreenForRecordingStatus);

    // Begins recording. This method can only be called if the Recording has been prepared.
    this.recording = recording;
    await this.recording.startAsync();
    this.setState({
      isLoading: false,
    });
  }
  // Stop Audio recording and save playback.
  private async _stopRecordingAndEnablePlayback() {
    this.setState({
      isLoading: true,
    });
    if (!this.recording) {
      return;
    }

    try {
      // Stops the recording and deallocates the recorder from memory.
      await this.recording.stopAndUnloadAsync();
    } catch (error) {
      if (error.code === 'E_AUDIO_NODATA') {
        console.log(
          `Stop was called too quickly, no data has yet been received (${error.message})`,
        );
      } else {
        console.log('STOP ERROR: ', error.code, error.name, error.message);
      }
      this.setState({
        isLoading: false,
      });
      return;
    }
    // Get metadata information about a file, directory or external content/asset.
    const info = await FileSystem.getInfoAsync(this.recording.getURI() || '');
    console.log(`FILE INFO: ${JSON.stringify(info)}`);
    // customize the audio experience on iOS and Android.
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: true,
    });

    // Creates and loads a new Sound object to play back the Recording.
    const { sound, status } = await this.recording.createNewLoadedSoundAsync(
      {
        isLooping: true,
        isMuted: this.state.muted,
        volume: this.state.volume,
        rate: this.state.rate,
        shouldCorrectPitch: this.state.shouldCorrectPitch,
      },
      this._updateScreenForSoundStatus,
    );
    this.sound = sound;
    this.setState({
      isLoading: false,
    });
  }
  // Button record once you press the button start to record.
  private _onRecordPressed = () => {
    if (this.state.isRecording) {
      this._stopRecordingAndEnablePlayback();
    } else {
      this._stopPlaybackAndBeginRecording();
    }
  };
  // Button pause record.
  private _onPlayPausePressed = () => {
    if (this.sound != null) {
      if (this.state.isPlaying) {
        this.sound.pauseAsync();
      } else {
        this.sound.playAsync();
      }
    }
  };
  // Button stop record.
  private _onStopPressed = () => {
    if (this.sound != null) {
      this.sound.stopAsync();
    }
  };
  // Callback continuously called while the user is dragging the slider.
  private _onSeekSliderValueChange = (value: number) => {
    if (this.sound != null && !this.isSeeking) {
      this.isSeeking = true;
      this.shouldPlayAtEndOfSeek = this.state.shouldPlay;
      this.sound.pauseAsync();
    }
  };
  // Callback that is called when the user releases the slider, regardless if the value has changed. 
  // The current value is passed as an argument to the callback handler.
  private _onSeekSliderSlidingComplete = async (value: number) => {
    if (this.sound != null) {
      this.isSeeking = false;
      const seekPosition = value * (this.state.soundDuration || 0);
      if (this.shouldPlayAtEndOfSeek) {
        this.sound.playFromPositionAsync(seekPosition);
      } else {
        this.sound.setPositionAsync(seekPosition);
      }
    }
  };
  // Slider position.
  private _getSeekSliderPosition() {
    if (
      this.sound != null &&
      this.state.soundPosition != null &&
      this.state.soundDuration != null
    ) {
      return this.state.soundPosition / this.state.soundDuration;
    }
    return 0;
  }
  // Status timer.
  private _getMMSSFromMillis(millis: number) {
    const totalSeconds = millis / 1000;
    const seconds = Math.floor(totalSeconds % 60);
    const minutes = Math.floor(totalSeconds / 60);

    const padWithZero = (number: number) => {
      const string = number.toString();
      if (number < 10) {
        return '0' + string;
      }
      return string;
    };
    return padWithZero(minutes) + ':' + padWithZero(seconds);
  }
  // Timer of the playback.
  private _getPlaybackTimestamp() {
    if (
      this.sound != null &&
      this.state.soundPosition != null &&
      this.state.soundDuration != null
    ) {
      return `${this._getMMSSFromMillis(
        this.state.soundPosition,
      )} / ${this._getMMSSFromMillis(this.state.soundDuration)}`;
    }
    return '';
  }

  private _getRecordingTimestamp() {
    if (this.state.recordingDuration != null) {
      return `${this._getMMSSFromMillis(this.state.recordingDuration)}`;
    }
    return `${this._getMMSSFromMillis(0)}`;
  }
  // Permission message before start to record.
  render() {
    if (!this.state.fontLoaded) {
      return <View style={styles.emptyContainer} />;
    }
    if (!this.state.haveRecordingPermissions) {
      return (
        <View style={styles.container}>
          <View />
          <Text
            style={[
              styles.noPermissionsText,
              { fontFamily: 'cutive-mono-regular' },
            ]}
          >
            You must enable audio recording permissions in order to use this
            app.
          </Text>
          <View />
        </View>
      );
    }
    // Our layout
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.halfScreenContainer,
            {
              opacity: this.state.isLoading ? DISABLED_OPACITY : 1.0,
            },
          ]}
        >
          <View />
          <View style={styles.recordingContainer}>
            <View />
            <TouchableHighlight
              underlayColor={BACKGROUND_COLOR}
              style={styles.wrapper}
              onPress={this._onRecordPressed}
              disabled={this.state.isLoading}
            >
              <Image style={styles.image} source={Icons.RECORD_BUTTON.module} />
            </TouchableHighlight>

            <View />
          </View>
          <View style={styles.recordingDataContainer}>
            <View />
            <Text
              style={[styles.liveText, { fontFamily: 'cutive-mono-regular' }]}
            >
              {this.state.isRecording ? 'Recording' : ''}
            </Text>
            <View style={styles.recordingDataRowContainer}>
              <Image
                style={[
                  styles.image,
                  { opacity: this.state.isRecording ? 1.0 : 0.0 },
                ]}
                source={Icons.RECORDING.module}
              />

              <Text
                style={[
                  styles.recordingTimestamp,
                  { fontFamily: 'cutive-mono-regular' },
                ]}
              >
                {this._getRecordingTimestamp()}
              </Text>
            </View>
            <View />
          </View>
          <View />
        </View>
        <View
          style={[
            styles.halfScreenContainer,
            {
              opacity:
                !this.state.isPlaybackAllowed || this.state.isLoading
                  ? DISABLED_OPACITY
                  : 1.0,
            },
          ]}
        >
          <View />
          <View style={styles.playbackContainer}>
            <Slider
              style={styles.playbackSlider}
              value={this._getSeekSliderPosition()}
              onValueChange={this._onSeekSliderValueChange}
              onSlidingComplete={this._onSeekSliderSlidingComplete}
              minimumTrackTintColor="#FF3366"
              maximumTrackTintColor="#FFFFFF"
            />
            <Text
              style={[
                styles.playbackTimestamp,
                { fontFamily: 'cutive-mono-regular' },
              ]}
            >
              {this._getPlaybackTimestamp()}
            </Text>
          </View>
          <View style={styles.buttonsContainerBase}>
            <View style={styles.playStopContainer}>
              <TouchableHighlight
                underlayColor={BACKGROUND_COLOR}
                style={styles.wrapper}
                onPress={this._onPlayPausePressed}
                disabled={!this.state.isPlaybackAllowed || this.state.isLoading}
              >
                <Image
                  style={styles.image}
                  source={
                    this.state.isPlaying
                      ? Icons.PAUSE_BUTTON.module
                      : Icons.PLAY_BUTTON.module
                  }
                />
              </TouchableHighlight>
              <TouchableHighlight
                underlayColor={BACKGROUND_COLOR}
                style={styles.wrapper}
                onPress={this._onStopPressed}
                disabled={!this.state.isPlaybackAllowed || this.state.isLoading}
              >
                <Image
                  style={(styles.image, { width: 42, height: 42 })}
                  source={Icons.STOP_BUTTON.module}
                />
              </TouchableHighlight>
            </View>
            <View />
          </View>

          <View />
        </View>
      </View>
    );
  }
}

// Style:
//Background
const styles = StyleSheet.create({
  emptyContainer: {
    alignSelf: 'stretch',
    backgroundColor: BACKGROUND_COLOR,
  },
  container: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: BACKGROUND_COLOR,
  },
  noPermissionsText: {
    textAlign: 'center',
  },
  wrapper: {},
  halfScreenContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: DEVICE_HEIGHT / 2.0,
    maxHeight: DEVICE_HEIGHT / 2.0,
  },

  //Position Button Record.
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: Icons.RECORD_BUTTON.height,
    maxHeight: Icons.RECORD_BUTTON.height,
  },
  recordingDataContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: Icons.RECORD_BUTTON.height,
    maxHeight: Icons.RECORD_BUTTON.height,
    minWidth: Icons.RECORD_BUTTON.width * 3.0,
    maxWidth: Icons.RECORD_BUTTON.width * 3.0,
  },
  recordingDataRowContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: Icons.RECORDING.height,
    maxHeight: Icons.RECORDING.height,
  },
  playbackContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: Icons.THUMB_1.height * 2.0,
    maxHeight: Icons.THUMB_1.height * 2.0,
  },
  playbackSlider: {
    alignSelf: 'stretch',
    height: 80,
  },
  liveText: {
    color: '#f2f2f2',
    fontSize: 15,
  },
  recordingTimestamp: {
    paddingLeft: 20,
    color: '#f2f2f2',
    fontSize: 15,
  },
  playbackTimestamp: {
    textAlign: 'right',
    alignSelf: 'stretch',
    paddingRight: 20,
    marginTop: -20,
    color: '#f2f2f2',
    fontSize: 15,
  },
  image: {
    backgroundColor: BACKGROUND_COLOR,
  },
  textButton: {
    padding: 10,
  },
  buttonsContainerBase: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 70,
    justifyContent: 'space-between',
  },
  buttonsContainerTopRow: {
    alignSelf: 'stretch',
    paddingRight: 20,
  },
  playStopContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: ((Icons.PLAY_BUTTON.width + Icons.STOP_BUTTON.width) * 3.0) / 2.0,
    maxWidth: ((Icons.PLAY_BUTTON.width + Icons.STOP_BUTTON.width) * 3.0) / 2.0,
  },

  buttonsContainerBottomRow: {
    maxHeight: Icons.THUMB_1.height,
    alignSelf: 'stretch',
    paddingRight: 20,
    paddingLeft: 20,
  },
  timestamp: {
    fontFamily: 'cutive-mono-regular',
  },
});
