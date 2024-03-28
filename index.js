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
