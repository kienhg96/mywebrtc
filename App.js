import React, {Component} from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import WebRTC from 'react-native-webrtc';

const {
	RTCPeerConnection,
	RTCIceCandidate,
	RTCSessionDescription,
	RTCView,
	MediaStream,
	MediaStreamTrack,
	getUserMedia,
} = WebRTC;
const options = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};

export default class App extends Component {
	constructor(props) {
		super(props);
		this.state = {
			streamURL: null
		};
		this._handleCallPress = this._handleCallPress.bind(this);
		this._handleWSMessage = this._handleWSMessage.bind(this);
		this._handleRemoteStream = this._handleRemoteStream.bind(this);

		this.candidateQueue = [];
	}

	componentDidMount() {
		this.ws = new WebSocket('ws://192.168.0.75:8080');
		this.ws.onopen = () => {
			console.log("WebSocket opened");
		}
		this.ws.onclose = () => {
			console.log("WebSocket closed");
		}
		this.ws.onmessage = this._handleWSMessage;
	}

	_handleWSMessage(event) {
		const data = JSON.parse(event.data);
		if (data.type === 'candidate') {
			this._handleCandidate(new RTCIceCandidate(data.candidate));
		} else if (data.type === 'offer') {
			this._handleOffer(new RTCSessionDescription(data.offer));
		} else if (data.type === 'answer') {
			this._handlerAnswer(new RTCSessionDescription(data.answer));
		}
	}

	async _handleCandidate(candidate) {
		try {
			if (!this.pc || !this.pc.remoteDescription) {
				this.candidateQueue.push(candidate);
			} else {
				console.log('Adding ICE candidate');
				await this.pc.addIceCandidate(candidate);
				console.log('Added ICE candidate');
			}
		} catch (err) {
			console.error(err);
		}
	}

	async _handleOffer(offer) {
		const stream = await this.getStream();
		this.localStream = stream;
		const pc = new RTCPeerConnection(options);
		this.pc = pc;
		pc.onicecandidate = ({ candidate }) => {
			if (candidate) {
				this.ws.send(JSON.stringify({
					type: 'candidate',
					candidate: candidate
				}));
			}
		}
		pc.onaddstream = this._handleRemoteStream;
		await pc.setRemoteDescription(offer);
		pc.addStream(stream);
		const answer = await pc.createAnswer();
		await pc.setLocalDescription(answer);
		this.ws.send(JSON.stringify({
			type: 'answer',
			answer
		}));
		console.log("On Created Connection", this.candidateQueue);
		await Promise.all(this.candidateQueue.splice(0).map(async candidate => {
			console.log('Adding ICE candidate');
			await pc.addIceCandidate(candidate);
			console.log('Added ICE candidate');
		}));
	}

	async _handlerAnswer(answer) {
		await this.pc.setRemoteDescription(answer);
		await Promise.all(this.candidateQueue.splice(0).map(async candidate => {
			console.log('Adding ICE candidate');
			await this.pc.addIceCandidate(candidate);
			console.log('Added ICE candidate');
		}));
	}

	async _handleCallPress() {
		if (this._called) {
			return;
		}
		this._called = true;
		try {
			const stream = await this.getStream();
			this.localStream = stream;
			const pc = new RTCPeerConnection(options);
			this.pc = pc;
			pc.onicecandidate = ({ candidate }) => {
				if (candidate) {
					this.ws.send(JSON.stringify({
						type: 'candidate',
						candidate: candidate
					}));
				}
			}
			pc.addStream(stream);
			pc.onaddstream = this._handleRemoteStream;
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);
			this.ws.send(JSON.stringify({
				type: 'offer',
				offer: offer
			}));
		} catch (err) {
			console.error(err);			
		}
	}

	_handleRemoteStream(event) {
		console.log("On Add Remote Stream");
		this.setState({
			streamURL: event.stream.toURL()
			// streamURL: this.localStream.toURL()
		})
	}

	getStream() {
		return new Promise((resolve, reject) => {
			MediaStreamTrack.getSources(sourceInfos => {
				let videoSourceId;
				for (let i = 0; i < sourceInfos.length; i++) {
					const sourceInfo = sourceInfos[i];
					if (sourceInfo.kind === "video" && sourceInfo.facing === "front") {
						videoSourceId = sourceInfo.id;
					}
				}
				getUserMedia({
					audio: true,
					video: {
						mandatory: {
							minWidth: 500,
							minHeight: 300,
							minFrameRate: 30
						},
						facingMode: "user",
						optional: (videoSourceId ? [{sourceId: videoSourceId}] : [])
					}
				}, stream => resolve(stream), err => reject(err));
			});
		})
		
	}

	render() {
		return (
			<View style={styles.container}>
				<View style={styles.content}>
					<TouchableOpacity onPress={this._handleCallPress}>
						<Text>Call</Text>
						<Text>Status : {this.state.streamURL ? this.state.streamURL : "Not Connected"}</Text>
					</TouchableOpacity>
				</View>
				<View style={styles.content}>
					<RTCView style={styles.stream} streamURL={this.state.streamURL} />
				</View>
			</View>
		);
	}
}

const styles = StyleSheet.create({
	container: {
		flex: 1
	},
	content: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center'
	},
	stream: {
		width: 500,
		height: 300
	}
});
