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
