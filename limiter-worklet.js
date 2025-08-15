class PeakLimiter extends AudioWorkletProcessor {
    static get parameterDescriptors() { return []; }
    constructor(options) {
        super();
        const p = (options && options.processorOptions) || {};
        this.lookahead = Math.max(1, Math.round((p.lookaheadMs || 5) * sampleRate / 1000));
        this.ceilingDb = (p.ceilingDb !== undefined) ? p.ceilingDb : -1;
        this.ceilingLin = Math.pow(10, this.ceilingDb / 20);
        this.bufferL = new Float32Array(this.lookahead);
        this.bufferR = new Float32Array(this.lookahead);
        this.idx = 0;
        this.port.onmessage = (e) => {
            const msg = e.data || {};
            if (msg.type === 'config' && typeof msg.ceilingDb === 'number') {
                this.ceilingDb = msg.ceilingDb;
                this.ceilingLin = Math.pow(10, this.ceilingDb / 20);
            }
        };
    }
    process(inputs, outputs) {
        const input = inputs[0], output = outputs[0];
        if (!input || !input[0] || !output) return true;
        const inL = input[0], inR = input[1] || input[0];
        const outL = output[0], outR = output[1] || output[0];
        for (let i = 0; i < inL.length; i++) {
            this.bufferL[this.idx] = inL[i];
            this.bufferR[this.idx] = inR[i];
            let peak = 0;
            for (let k = 0; k < this.lookahead; k++) {
                const j = (this.idx + k) % this.lookahead;
                const a = Math.abs(this.bufferL[j]), b = Math.abs(this.bufferR[j]);
                if (a > peak) peak = a;
                if (b > peak) peak = b;
            }
            const g = peak > this.ceilingLin ? (this.ceilingLin / peak) : 1.0;
            const readIdx = (this.idx + 1) % this.lookahead;
            outL[i] = this.bufferL[readIdx] * g;
            outR[i] = this.bufferR[readIdx] * g;
            this.idx = readIdx;
        }
        return true;
    }
}
registerProcessor('peak-limiter', PeakLimiter);
