// Initialize Agora client
var client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
const clientRTM = AgoraRTM.createInstance('afb5d696c0e640a0a202e1f1e1cf4b35');

console.log('client', client);
var localTracks = {
  videoTrack: null,
  audioTrack: null
};
var remoteUsers = {};
// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null
};

var remoteTrack = {
  screenTrack: null
};

var sharedVariables = {
  isShareEnabled: true
};
const messageRTM = {
  message: null,
  uid: null
};
let rtmClientChannel;
// Auto-join channel if parameters are in the URL
window.addEventListener('load', function () {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get('appid');
  options.channel = urlParams.get('channel');
  options.token = urlParams.get('token');
  if (options.appid && options.channel) {
    document.getElementById('appid').value = options.appid;
    document.getElementById('token').value = options.token;
    document.getElementById('channel').value = options.channel;
    document.getElementById('join-form').submit();
  }
});

document
  .getElementById('join-form')
  .addEventListener('submit', async function (e) {
    e.preventDefault();
    document.getElementById('join').disabled = true;
    try {
      // const token = fetchToken();
      options.appid = document.getElementById('appid').value;
      options.token = document.getElementById('token').value;
      options.channel = document.getElementById('channel').value;
      await join();
    } catch (error) {
      console.error(error);
    } finally {
      document.getElementById('leave').disabled = false;
    }
  });

document.getElementById('leave').addEventListener('click', function (e) {
  leave();
});

async function join() {
  // Add event listener to play remote tracks when remote user publishes
  client.on('user-published', handleUserPublished);
  client.on('user-unpublished', handleUserUnpublished);
  // Join a channel and create local tracks concurrently
  [options.uid, localTracks.audioTrack, localTracks.videoTrack] =
    await Promise.all([
      // Join the channel
      client.join(options.appid, options.channel, options.token || null),
      // Create local tracks, using microphone and camera
      AgoraRTC.createMicrophoneAudioTrack(),
      AgoraRTC.createCameraVideoTrack()
    ]);
  console.log('clientRTM ', clientRTM);
  const rtmUID = options.uid;
  await clientRTM.login({ uid: rtmUID.toString(), token: null });
  rtmClientChannel = clientRTM.createChannel(options.channel);
  await rtmClientChannel.join();
  rtmClientChannel.on('ChannelMessage', (message, peerId) => {
    console.log('Received message:', message, 'from user:', peerId);
    const msg = message.text.split('-')[0];
    const userId = message.text.split('-')[1];
    messageRTM.message = msg;
    messageRTM.uid = +userId;
  });
  // create localplayer container
  const localPlayerWrapper = document.createElement('div');
  localPlayerWrapper.id = `local-player-wrapper-video`;
  localPlayerWrapper.style.width = '100%';
  localPlayerWrapper.style.flex = 1;

  const localPlayerInnerWrapper = document.createElement('div');
  localPlayerInnerWrapper.setAttribute('class', 'localPlayerInnerWrapper');
  localPlayerInnerWrapper.innerHTML = `
      <p class="local-player-name">localUser(${options.uid})</p>
      <div id="local-player-video" class="local-player-video"></div>
    `;
  localPlayerWrapper.appendChild(localPlayerInnerWrapper);
  document.getElementById('local-player').appendChild(localPlayerWrapper);
  // Play local video track
  localTracks.videoTrack.play('local-player-video');
  // Publish local tracks to channel
  await client.publish(Object.values(localTracks));
  await createPlayerButtons(localTracks, remoteTrack);
  console.log('publish success');
}

async function leave() {
  for (var trackName in localTracks) {
    var track = localTracks[trackName];
    if (track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }

  // Remove remote users and player views
  remoteUsers = {};
  document.getElementById('remote-playerlist').innerHTML = '';

  // Leave the channel
  await client.leave();

  // document.getElementById('local-player-name').textContent = '';
  document.getElementById('join').disabled = false;
  document.getElementById('leave').disabled = true;
  console.log('client leaves channel success');
}

async function subscribe(user, mediaType) {
  console.log('subscribe success');
  const uid = user.uid;
  // Subscribe to a remote user
  await client.subscribe(user, mediaType);
  const localPlayer = document.getElementById('local-player');
  if (mediaType === 'video') {
    const previous = document.getElementById(`player-wrapper-${uid}`);
    if (previous) {
      previous.remove();
    }
    console.log('initiating player-wrapper');
    const playerWrapper = document.createElement('div');
    playerWrapper.id = `player-wrapper-${uid}`;
    playerWrapper.className = 'remote-players-screen';
    playerWrapper.style.flex = 1;

    const localPlayerInnerWrapper = document.createElement('div');
    localPlayerInnerWrapper.setAttribute('class', 'localPlayerInnerWrapper');
    localPlayerInnerWrapper.innerHTML = `
            <p class="player-name">remoteUser(${uid})</p>
            <div id="player-${uid}" class="remote-player-user"></div>
        `;
    playerWrapper.appendChild(localPlayerInnerWrapper);
    localPlayer.appendChild(playerWrapper);
    console.log('playerWrapper is created', playerWrapper);
    //
    if (Object.keys(remoteUsers).length === 1) {
      localPlayer.style.gridTemplateColumns =
        'minmax(0px, 1fr) minmax(0px, 1fr)';
    } else if (Object.keys(remoteUsers).length > 1) {
      localPlayer.style.gridTemplateColumns =
        'minmax(0px, 1fr) minmax(0px, 1fr) minmax(0px, 1fr)';
    } else if (Object.keys(remoteUsers).length === 0) {
      localPlayer.style.gridTemplateColumns = 'minmax(0px, 1fr)';
    }

    user.videoTrack.play(`player-${uid}`);
  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
  }
}

function handleUserPublished(user, mediaType) {
  console.log('handleUserPublished calling');
  const id = user.uid;
  remoteUsers[id] = user;
  subscribe(user, mediaType);
  if (mediaType === 'video' && user.videoTrack) {
    if (user.videoTrack.getMediaStreamTrack().kind === 'video') {
      console.log('messageRTM', messageRTM);
      if (messageRTM && messageRTM.message === 'startScreenShare') {
        const rtmUID = +messageRTM.uid;
        setTimeout(() => {
          const remotesharingPlayer = document.getElementById(
            `player-wrapper-${rtmUID}`
          );
          console.log('remotesharingPlayer', remotesharingPlayer);
          if (remotesharingPlayer) {
            remotesharingPlayer.style.border = '2px solid red';
            setScreenSharing(rtmUID, true);
          }
        }, 1000);
      }
    }
  }
}

function setScreenSharing(rtmUID, sharing) {
  const localPlayer = document.getElementById('local-player');
  var children = localPlayer.children;
  console.log('sharing ', sharing, rtmUID, children.length);
  if (sharing) {
    console.log('screen sharing ', sharing, children.length);
    localPlayer.style.display = 'flex';
    for (var i = 0; i < children.length; i++) {
      console.log('loop ', i);
      var child = children[i];
      console.log('child', child.id);
      if (child.id === `player-wrapper-${rtmUID}`) {
        child.style.display = 'block'; // or 'inline-block' depending on the child element type
      } else {
        child.style.display = 'none';
      }
    }
  } else {
    console.log('stop screen sharing ', sharing);
    localPlayer.style.display = 'grid';
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      child.style.display = 'block';
    }
  }
}

function handleUserUnpublished(user) {
  setScreenSharing(null, false);
  console.log('handleUserUnpublished calling');
  const id = user.uid;
  delete remoteUsers[id];
  var playerWrapper = document.getElementById(`player-wrapper-${id}`);
  if (playerWrapper) {
    playerWrapper.remove();
  }

  const localPlayer = document.getElementById('local-player');
  if (Object.keys(remoteUsers).length === 1) {
    localPlayer.style.gridTemplateColumns = 'minmax(0px, 1fr) minmax(0px, 1fr)';
  } else if (Object.keys(remoteUsers).length > 1) {
    localPlayer.style.gridTemplateColumns =
      'minmax(0px, 1fr) minmax(0px, 1fr) minmax(0px, 1fr)';
  } else if (Object.keys(remoteUsers).length === 0) {
    localPlayer.style.gridTemplateColumns = 'minmax(0px, 1fr)';
  }
}

const micOn = '<ion-icon name="mic-outline"></ion-icon>';
const micOff = '<ion-icon name="mic-off-outline"></ion-icon>';
const videoOn = '<ion-icon name="videocam-outline"></ion-icon>';
const videoOff = '<ion-icon name="videocam-off-outline"></ion-icon>';
const shareOn = '<ion-icon name="tv-outline"></ion-icon>';
const shareOff = '<ion-icon name="log-out-outline"></ion-icon>';
const callOn = '<ion-icon name="call-outline"></ion-icon>';

function createPlayerButtons(localTracks, remoteTrack) {
  const localPlayer = document.getElementById('local-player');
  if (localPlayer) {
    const buttonsContainer = document.createElement('div');
    buttonsContainer.classList.add('container');
    buttonsContainer.setAttribute('class', 'buttonsContainer');
    buttonsContainer.setAttribute('id', 'buttonsContainer');
    const micButton = document.createElement('button');
    micButton.setAttribute('class', 'btn btn-primary');
    micButton.innerHTML = micOn;
    const videoButton = document.createElement('button');
    videoButton.setAttribute('class', 'btn btn-warning');
    videoButton.innerHTML = videoOn;
    const shareButton = document.createElement('button');
    shareButton.setAttribute('class', 'btn btn-info');
    shareButton.setAttribute('id', 'share-button');
    shareButton.innerHTML = shareOn;

    const callButton = document.createElement('button');
    callButton.setAttribute('class', 'btn btn-danger');
    callButton.setAttribute('id', 'end-call');
    callButton.innerHTML = callOn;

    buttonsContainer.appendChild(micButton);
    buttonsContainer.appendChild(videoButton);
    buttonsContainer.appendChild(shareButton);
    buttonsContainer.appendChild(callButton);
    document.getElementById('buttonsGroup').appendChild(buttonsContainer);

    if (micButton) {
      let isMicEnabled = true; // Flag to track mic state

      micButton.addEventListener('click', function (event) {
        if (isMicEnabled) {
          micButton.innerHTML = micOff; // Change icon to mic off
          localTracks.audioTrack.setEnabled(false); // Disable mic
        } else {
          micButton.innerHTML = micOn; // Change icon to mic on
          localTracks.audioTrack.setEnabled(true); // Enable mic
        }
        isMicEnabled = !isMicEnabled; // Toggle mic state
      });
    }

    if (videoButton) {
      let isVideoEnabled = true; // Flag to track mic state

      videoButton.addEventListener('click', function (event) {
        //  bottomContainer.style.marginTop='320px'
        if (isVideoEnabled) {
          videoButton.innerHTML = videoOff;
          localTracks.videoTrack.setEnabled(false);
        } else {
          //  bottomContainer.style.marginTop='320px'
          videoButton.innerHTML = videoOn;
          localTracks.videoTrack.setEnabled(true);
        }
        isVideoEnabled = !isVideoEnabled;
      });
    }

    if (shareButton) {
      shareButton.addEventListener('click', async (event) => {
        //    if(this.shareButtonEnable===false){
        //   alert('remote user is already sharing')
        //   return;
        // }
        console.log('share button clicked', sharedVariables.isShareEnabled);
        if (sharedVariables.isShareEnabled) {
          await startScreenShare(localTracks, remoteTrack, options.uid);
          shareButton.innerHTML = shareOff;
          sharedVariables.isShareEnabled = false;
          const message = `startScreenShare-${options.uid}`;
          console.log('rtmClientChannel', rtmClientChannel);
          await rtmClientChannel.sendMessage({ text: message, type: 'text' });
        } else {
          shareButton.innerHTML = shareOn;
          await stopScreenShare();
          sharedVariables.isShareEnabled = true;
        }
      });
    }

    if (callButton) {
      let isCallEnabled = true;

      callButton.addEventListener('click', async (event) => {
        if (isCallEnabled) {
          console.log('end button clicked');
          callButton.innerHTML = callOn;
          const sharePlayer = document.getElementById('share-player');
          if (sharePlayer) {
            remoteUsers = {};
            if (screenShare.screenTrack) {
              console.log('screentrack exists');
              // Unpublish the screen track
              await this.client.unpublish([screenShare.screenTrack]);
              // Close the screen track
              screenShare.screenTrack.close();
            }
            // await this.stopScreenShare();
            sharePlayer.innerHTML = '';
          }
          const buttonsGroup = document.getElementById('buttonsGroup');
          console.log('buttonsGroup', buttonsGroup);
          if (buttonsGroup) {
            buttonsGroup.parentNode.removeChild(buttonsGroup);
          }
          await this.leave();
        }
      });
    }

    const startScreenShare = async (localTracks, remoteTrack, uid) => {
      console.log('localTracks', localTracks);
      // Create a screen track for screen sharing.
      remoteTrack.screenTrack = await AgoraRTC.createScreenVideoTrack();
      await client.unpublish([localTracks.videoTrack]);
      localTracks.videoTrack.close();
      // Replace the video track with the screen track.
      await client.publish([remoteTrack.screenTrack]);
      // Play the screen track.
      remoteTrack.screenTrack.play('remote-playerlist');
      const remotePlayerList = document.getElementById('remote-playerlist');
      if (remotePlayerList) {
        remotePlayerList.style.width = '100%';
        remotePlayerList.style.height = '100%';
        remotePlayerList.style.position = 'absolute';
        remotePlayerList.style.bottom = '0px';
      }
      remoteTrack.screenTrack.on('track-ended', () => {
        console.log('track ended');
        sharedVariables.isShareEnabled = true;
        stopScreenShare(localTracks, remoteTrack, uid);
      });
    };

    const stopScreenShare = async (localTracks, remoteTrack, uid) => {
      // Replace the screen track with the video track.
      const message = `stopScreenShare-${options.uid}`;
      //   await this.sendRTMMessage(message,options.uid);
      console.log('localTracks', localTracks, remoteTrack);
      await client.unpublish([remoteTrack.screenTrack]);
      remoteTrack.screenTrack.close();
      localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();
      await client.publish([localTracks.videoTrack]);
      // Play the video track.
      localTracks.videoTrack.play('local-player-video');
    };
  }
}
