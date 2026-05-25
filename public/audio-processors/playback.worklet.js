/**
 * PCM Playback Worklet Processor
 * Receives Float32 audio chunks from the main thread and plays them back
 * through a queued buffer system for smooth, continuous playback.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._queue = [];
    this._currentBuffer = null;
    this._currentOffset = 0;

    this.port.onmessage = (event) => {
      if (event.data === 'interrupt') {
        // Clear all queued audio (barge-in support)
        this._queue = [];
        this._currentBuffer = null;
        this._currentOffset = 0;
      } else if (event.data instanceof Float32Array) {
        this._queue.push(event.data);
      }
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || !output.length) return true;

    const outputChannel = output[0];

    for (let i = 0; i < outputChannel.length; i++) {
      // Get next buffer if current is exhausted
      if (!this._currentBuffer || this._currentOffset >= this._currentBuffer.length) {
        if (this._queue.length > 0) {
          this._currentBuffer = this._queue.shift();
          this._currentOffset = 0;
        } else {
          // No data available, output silence
          outputChannel[i] = 0;
          continue;
        }
      }

      outputChannel[i] = this._currentBuffer[this._currentOffset++];
    }

    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
