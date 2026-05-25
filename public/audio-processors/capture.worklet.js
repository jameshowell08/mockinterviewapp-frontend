/**
 * Audio Capture Worklet Processor
 * Captures microphone audio and sends Float32 samples to the main thread.
 * Runs in a dedicated audio thread for low-latency processing.
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._bufferSize = 2048;
    this._buffer = new Float32Array(this._bufferSize);
    this._bytesWritten = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input.length) return true;

    const channelData = input[0]; // Mono channel
    if (!channelData) return true;

    for (let i = 0; i < channelData.length; i++) {
      this._buffer[this._bytesWritten++] = channelData[i];

      if (this._bytesWritten >= this._bufferSize) {
        // Send the buffer to the main thread
        this.port.postMessage({
          type: 'audio',
          data: this._buffer.slice()
        });
        this._bytesWritten = 0;
      }
    }

    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
