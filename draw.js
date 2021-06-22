import { Chart } from "./chart.js";

// Really weird way to draw an arrow, using a shape
const arrowUp = [
    [0.5, 0],
    [1, 0.5],
    [0.8232, 0.6768],
    [0.625, 0.4786],
    [0.625, 1],
    [0.375, 1],
    [0.375, 0.4786],
    [0.1768, 0.6768],
    [0, 0.5],
    [0.5, 0],
];

const arrowLeft = arrowUp.map((c) => [c[1], c[0]]);
const arrowDown = arrowUp.map((c) => [c[0], 1 - c[1]]);
const arrowRight = arrowLeft.map((c) => [1 - c[0], c[1]]);
const arrows = [arrowLeft, arrowDown, arrowUp, arrowRight];
const arrowFillStyles = ["#C24B99", "#00FFFF", "#12FA05", "#F9393F"];
const arrowStrokeStyles = ["#3C1F56", "#1542B7", "#0A4447", "#651038"];

class Draw {
    constructor(canvas) {
        this.canvas = canvas;

        this.ctx = this.canvas.getContext("2d");

        this.canvasBg = document.createElement("canvas");
        this.ctxBg = this.canvasBg.getContext("2d");

        this.stepsPerSection = 16;

        this._playbackSection = 0;

        this.waveformStyles = {
            voices: "#8a28fb",
            instrumental: "#FAAE41",
            background: "#1b1921",
        };

        this.dpr = window.devicePixelRatio;

        let mqString = `(resolution: ${this.dpr}dppx)`;
        window.matchMedia(mqString).addEventListener("change", this._updatePixelRatio);

        this.update();
        this.events = {};
    }

    addListener(event, callback) {
        // Check if the callback is not a function
        if (typeof callback !== "function") {
            console.error(
                `The listener callback must be a function, the given type is ${typeof callback}`
            );
            return false;
        }
        // Check if the event is not a string
        if (typeof event !== "string") {
            console.error(`The event name must be a string, the given type is ${typeof event}`);
            return false;
        }

        // Create the event if not exists
        if (this.events[event] === undefined) {
            this.events[event] = {
                listeners: [],
            };
        }

        this.events[event].listeners.push(callback);
    }

    removeListener(event, callback) {
        if (this.events[event] === undefined) {
            return false;
        }

        this.events[event].listeners = this.events[event].listeners.filter((listener) => {
            return listener.toString() !== callback.toString();
        });
    }

    dispatch(event, details) {
        if (this.events[event] === undefined) {
            return false;
        }
        this.events[event].listeners.forEach((listener) => {
            listener(details);
        });
    }

    _updatePixelRatio() {
        this.dpr = window.devicePixelRatio;
        // this.update();
    }

    _computeSizes() {
        const { width, height } = this.canvas;

        this.cellSize = height / this.stepsPerSection;

        this.singleChartWidth = this.cellSize * 4;
        this.chartSeparatorWidth = this.cellSize * 0.5;

        this.chartWidth = this.singleChartWidth * 2 + this.chartSeparatorWidth;
        this.chartPosX = width - this.chartWidth;

        // this.waveAmplitude = height / 3;
        this.waveAmplitude = (width - (this.chartWidth + this.chartSeparatorWidth * 3)) / 2;

        if (this.waveAmplitude > height / 3) {
            this.waveAmplitude = height / 3;
        }

        this.waveVoicePosX = this.chartPosX - this.chartSeparatorWidth - this.waveAmplitude;
        this.waveInstPosX = this.chartPosX - this.chartSeparatorWidth * 2 - this.waveAmplitude * 2;

        this.instTrack = 0;
        this.voiceTrack = 1;

        this.focusGradient = this.ctxBg.createLinearGradient(0, 0, 0, height);
        this.focusGradient.addColorStop(1, "rgba(255,255,255,0.25");
        this.focusGradient.addColorStop(0, "rgba(255,255,255,0.1)");

        if (this.chart) {
            this._updatePixelsPerSecond();
            this._resizeWaveforms();
        }
    }

    _drawBg(section) {
        // console.log("bg update");
        let { width, height } = this.canvas;
        this.ctxBg.clearRect(0, 0, width, height);

        this.ctxBg.fillStyle = "#121218";
        this.ctxBg.fillRect(0, 0, width, height);

        // Chart checkered grid
        for (let i = 0; i < 2; i++) {
            let offsetX = this.chartPosX + i * (this.singleChartWidth + this.chartSeparatorWidth);
            for (let j = 0; j < this.stepsPerSection; j++) {
                for (let k = 0; k < 4; k++) {
                    this.ctxBg.beginPath();
                    this.ctxBg.fillStyle = (j + k) % 2 == 0 ? "#121218" : "#1b1921";

                    let x = offsetX + this.cellSize * k;
                    let y = this.cellSize * j;

                    this.ctxBg.fillRect(x, y, this.cellSize, this.cellSize);
                }
            }
        }

        // Horizontal lines
        this.ctxBg.fillStyle = this.waveformStyles.background;
        this.ctxBg.fillRect(this.waveVoicePosX, 0, this.waveAmplitude, height);
        this.ctxBg.fillRect(this.waveInstPosX, 0, this.waveAmplitude, height);

        this.ctxBg.lineWidth = this.dpr;

        this.ctxBg.strokeStyle = "rgba(255,255,255,0.2)";
        this.ctxBg.setLineDash([this.cellSize / 5, this.cellSize / 5]);

        this.ctxBg.beginPath();

        for (let i = 1; i <= this.stepsPerSection - 1; i++) {
            this.ctxBg.moveTo(this.waveInstPosX, this.cellSize * i);
            this.ctxBg.lineTo(this.chartPosX - this.chartSeparatorWidth, this.cellSize * i);
        }

        this.ctxBg.stroke();
        this.ctxBg.setLineDash([]);

        if (this.chart) {
            this._drawSectionNotes(section);

            // waveform cannot be drawn without chart data
            if (this.waveformVoice)
                this._drawWaveform(this.waveformVoice, this.voiceTrack, section);
            if (this.waveformInstrumental)
                this._drawWaveform(this.waveformInstrumental, this.instTrack, section);
        }

        this.ctx.clearRect(0, 0, width, height);
        this.ctx.drawImage(this.canvasBg, 0, 0);
    }

    setChart(chart) {
        this.chart = chart;
        this._updatePixelsPerSecond();
    }

    _updatePixelsPerSecond() {
        if (this.chart.dynamicBPM) {
            let fastestSection = Chart.getSectionDuration(this.chart.maxBPM) / 1000;
            this.pixelsPerSecond = this.canvas.height / fastestSection;
            return;
        }
        this.pixelsPerSecond = this.canvas.height / (this.chart.getDuration() / 1000);
    }

    setInstrumental(waveform) {
        this._waveformInstrumental = waveform;
        this.waveformInstrumental = this._resampleWaveform(waveform);
        this._drawBg();
    }

    setVoice(waveform) {
        this._waveformVoice = waveform;
        this.waveformVoice = this._resampleWaveform(waveform);
        this._drawBg();
    }

    setWaveforms(voices, instrumental) {
        this._waveformVoice = voices;
        this._waveformInstrumental = instrumental;
        this.waveformVoice = this._resampleWaveform(voices);
        this.waveformInstrumental = this._resampleWaveform(instrumental);
        this._drawBg();
    }

    clearWaveforms() {
        this.waveformInstrumental = null;
        this.waveformVoice = null;
    }

    _resampleWaveform(waveform) {
        // scale should never be rounded, use always full precision
        let scale = waveform.sample_rate / this.pixelsPerSecond;
        return waveform.resample({ scale });
    }

    _resizeWaveforms() {
        let newScale = 0;
        if (this._waveformInstrumental) {
            newScale = this.waveformInstrumental.sample_rate / this.pixelsPerSecond;
            if (this.waveformInstrumental.scale != newScale) {
                this.waveformInstrumental = this._resampleWaveform(this._waveformInstrumental);
            }
        }
        if (this._waveformVoice) {
            newScale = this.waveformVoice.sample_rate / this.pixelsPerSecond;
            if (this.waveformVoice.scale != newScale) {
                this.waveformVoice = this._resampleWaveform(this._waveformVoice);
            }
        }
    }

    // TODO: This function can be simplified for clarity,
    // right now is too convoluted and hard to follow what's going on.
    _drawWaveform(waveform, track, section = this.chart.currentSection) {
        let scale = 1.0;
        let { height } = this.canvas;

        let position = this.chart.getPosition(section) / 1000;
        let end = position + this.chart.getDuration(section) / 1000;

        let posX = 0;

        if (track == this.instTrack) {
            posX = this.waveInstPosX;
            this.ctxBg.fillStyle = this.waveformStyles.instrumental;
            this.ctxBg.strokeStyle = this.waveformStyles.instrumental;
        } else if (track == this.voiceTrack) {
            posX = this.waveVoicePosX;
            this.ctxBg.fillStyle = this.waveformStyles.voices;
            this.ctxBg.strokeStyle = this.waveformStyles.voices;
        }

        if (position > waveform.duration) {
            this.ctxBg.lineWidth = 1;
            this.ctxBg.strokeStyle = "rgba(255,255,255,0.1)";
            this._fillHatchedRect(this.ctxBg, posX, 0, this.waveAmplitude, height);
            return;
        }

        let offsetFloat = this.pixelsPerSecond * position;

        if (this.chart.dynamicBPM) {
            scale = this.chart.getBPM(section) / this.chart.maxBPM;
        }

        // always round offset values
        let offset = Math.round(offsetFloat);
        let reverseOffset = Math.round(offsetFloat + height / scale - 1);

        if (offset >= waveform.length - height * scale) {
            offset = waveform.length - height * scale;
        }

        this.ctxBg.lineWidth = 1;

        let h = height - 1;
        if (reverseOffset > waveform.length) {
            reverseOffset = waveform.length - 1;
            h = (waveform.length - offset) * scale;
            const prevStyle = this.ctxBg.strokeStyle;
            this.ctxBg.strokeStyle = "rgba(255,255,255,0.1)";
            this._fillHatchedRect(this.ctxBg, posX, h, this.waveAmplitude, height - h);
            this.ctxBg.strokeStyle = prevStyle;
        }

        const waveformWidth = this.waveAmplitude / waveform.channels;

        this.ctxBg.beginPath();
        for (let c = 0, offsetX = posX; c < waveform.channels; c++, offsetX += waveformWidth) {
            const channel = waveform.channel(c);

            for (let y = 0, i = offset; y < height && i < waveform.length; y += scale, i++) {
                const val = channel.max_sample(i);
                this.ctxBg.lineTo(offsetX + this._scaleX(val, waveformWidth) + 0.5, y + 0.5);
            }

            for (let y = h, i = reverseOffset; y >= 0 && i >= offset; y -= scale, i--) {
                const val = channel.min_sample(i);
                this.ctxBg.lineTo(offsetX + this._scaleX(val, waveformWidth) + 0.5, y + 0.5);
            }
        }

        this.ctxBg.fill();
        this.ctxBg.stroke();
        this.ctxBg.closePath();
    }

    _scaleX(amplitude, height) {
        const range = 256;
        const offset = 128;

        return height - ((amplitude + offset) * height) / range;
    }

    _drawSectionNotes(section = this.chart.currentSection, overlap, fromSection) {
        let step;

        const mustHitSection = this.chart.getMustHitSection(section);
        let notes = this.chart.getSectionNotes(section);

        let offset = 0;

        if (!overlap) {
            const duration = this.chart.getDuration(section);
            step = duration / this.stepsPerSection;

            // Fill with a rectangle which player is focused on camera
            let x = this.chartPosX;
            if (mustHitSection) {
                x += this.singleChartWidth + this.cellSize * 0.5;
            }

            this.ctxBg.fillStyle = this.focusGradient;
            this.ctxBg.fillRect(x, 0, this.singleChartWidth, this.canvas.height);

            // confusing shit
            if (this.chart.overlaps.has(section)) {
                const sections = this.chart.overlaps.get(section);
                sections.forEach((s) => {
                    this._drawSectionNotes(s, true, section);
                });
            }
        } else {
            // confusing shit pt. 2
            const duration = this.chart.getDuration(fromSection);
            step = duration / this.stepsPerSection;

            offset = (section - fromSection) * this.canvas.height;
        }

        const bothPlayers = notes.map((n) => n[1]).some((k) => k > 3);

        if (mustHitSection && !bothPlayers) {
            // if it's "player one" (BF) solo/turn, shift the notes [to the right] before drawing them
            notes = notes.map((note) => {
                let n = note.slice();
                n[1] += 4;
                return n;
            });
        } else if (mustHitSection && bothPlayers) {
            // if both players are singing, swap positions.
            let b = notes
                .filter((note) => note[1] >= 4)
                .map((note) => {
                    let n = note.slice();
                    n[1] = note[1] - 4;
                    return n;
                });

            let a = notes
                .filter((note) => note[1] < 4)
                .map((note) => {
                    let n = note.slice();
                    n[1] = note[1] + 4;
                    return n;
                });

            notes = [...a, ...b];
        }

        let position = this.chart.getPosition(section);
        notes.forEach((note) => {
            const index = (note[0] - position) / step; // note[0]/step
            const key = note[1];
            const sustain = note[2] / step;
            this._drawNote(index, key, sustain, offset);
        });
    }

    _drawNote(index, key, sustain, offset = 0) {
        const x = this.cellSize * key + this.chartPosX + (key > 3 ? this.cellSize * 0.5 : 0);
        const y = offset + this.cellSize * index; // offset + this.cellSize * (index % this.stepsPerSection)

        const i = key % 4;

        this._drawArrow(i, x, y);

        if (sustain > 0) {
            const xd = x + this.cellSize * (0.25 + 0.25 / 2);
            const yd = y + this.cellSize;

            this.ctxBg.fillStyle = arrowFillStyles[i];

            const w = this.cellSize / 4;
            const h = this.cellSize * sustain;

            this.ctxBg.beginPath();
            this.ctxBg.rect(xd, yd, w, h);
            this.ctxBg.fill();

            const lineWidthOutside = this.cellSize / 27;
            const lineWidthInner = this.cellSize / 16;

            this.ctxBg.strokeStyle = "white";
            this.ctxBg.lineWidth = lineWidthInner;
            this._insetRectStroke(this.ctxBg, xd, yd, w, h);

            this.ctxBg.strokeStyle = arrowStrokeStyles[i];
            this.ctxBg.lineWidth = lineWidthOutside;
            this._insetRectStroke(this.ctxBg, xd, yd, w, h, true);

            /*this.ctxBg.beginPath();
            this.ctxBg.rect(xd, yd, w, h);
            this.ctxBg.lineWidth = 1;
            this.ctxBg.stroke();*/
        }
    }

    // drawing an arrow with shape
    _drawArrow = (index, x = 0, y = 0) => {
        const arrow = arrows[index];
        this.ctxBg.moveTo(...arrow[0]);

        this.ctxBg.beginPath();

        arrow.forEach((c) => {
            this.ctxBg.lineTo(c[0] * this.cellSize + x, c[1] * this.cellSize + y);
        });

        this.ctxBg.closePath();

        // complex way to draw inset borders
        this.ctxBg.save();
        this.ctxBg.clip();

        this.ctxBg.fillStyle = arrowFillStyles[index];
        this.ctxBg.fill();

        this.ctxBg.lineWidth = this.cellSize / 7.5;
        this.ctxBg.strokeStyle = "white";

        this.ctxBg.stroke();

        this.ctxBg.lineWidth = this.cellSize / 20;
        this.ctxBg.strokeStyle = arrowStrokeStyles[index];
        this.ctxBg.stroke();
        this.ctxBg.restore();

        // "fixing" clip antialiasing artifacts
        // minimum outline
        this.ctxBg.lineWidth = 1;
        this.ctxBg.strokeStyle = arrowStrokeStyles[index];
        this.ctxBg.stroke();
    };

    // dumb way to do sustain notes rectagles borders
    _insetRectStroke(ctx, x, y, w, h, final) {
        const { lineWidth } = ctx;
        const { strokeStyle } = ctx;
        ctx.save();

        ctx.fillStyle = strokeStyle;
        ctx.beginPath();

        ctx.rect(x, y, w, lineWidth);
        ctx.rect(x, y, lineWidth, h);
        ctx.rect(x, y + h - lineWidth, w, lineWidth);
        ctx.rect(x + w - lineWidth, y, lineWidth, h);
        ctx.fill();

        // an attempt to remove artifacts
        if (final) {
            ctx.beginPath();
            ctx.lineWidth = 1;
            ctx.rect(x, y, w, h);
            ctx.stroke();
        }

        ctx.restore();
    }

    _fillHatchedRect(ctx, x, y, w, h, divisions = 8) {
        if (w <= 0 || h <= 0) {
            return;
        }

        const hatchSeparation = w / divisions;
        const top = [];
        const left = [];
        const right = [];
        for (let i = 0; i < divisions; i++) {
            const xd = hatchSeparation * i + x;
            top.push({ x: xd, y });
        }

        const a = Math.round(h / hatchSeparation);
        for (let i = 0; i < a; i++) {
            const yd = y + hatchSeparation * i;
            left.push({ x, y: yd });
            right.push({ x: x + w, y: yd });
        }

        ctx.beginPath();

        top.forEach((c, i) => {
            ctx.moveTo(c.x, c.y);
            ctx.lineTo(left[i].x, left[i].y);
        });

        for (let i = top.length, j = 0; i < left.length; i++, j++) {
            const c = left[i];
            ctx.moveTo(c.x, c.y);
            ctx.lineTo(right[j].x, right[j].y);
        }

        for (let i = left.length - top.length; i < right.length; i++) {
            const c = right[i];
            let xd = x + (w + (c.y - (h + y)));
            let yd = y + h;
            if (xd < x) {
                yd = y + h - (x - xd);
                xd = x;
            }

            ctx.moveTo(c.x, c.y);
            ctx.lineTo(xd, yd);
        }
        ctx.stroke();

        return;
    }

    update() {
        let { width, height } = this.canvas;

        this.canvasBg.width = width;
        this.canvasBg.height = height;

        this._computeSizes();
        this._drawBg(this.playing ? this._playbackSection : undefined);
    }

    updateSection() {
        this._drawBg(this.playing ? this._playbackSection : undefined);
    }

    setAudioMixer(audioMixer) {
        this.audioMixer = audioMixer;
    }

    startPlaying() {
        this.playing = true;
        this._sectionDuration = this.chart.getDuration();
        this._playbackSection = this.chart.currentSection;
        this._songDuration = this.chart.getSongDuration();
        this._sectionStart = this.chart.getPosition(this._playbackSection);
        this._sectionEnd = this._sectionStart + this._sectionDuration;

        if (this.chart.dynamicBPM) {
            this._currentBPM = this.chart.getBPM();
            this._previousBPM = this._currentBPM;
        }

        window.requestAnimationFrame((t) => {
            this._animate(t);
        });
    }

    stopPlaying() {
        this.playing = false;
    }

    _animate(timestamp) {
        if (!this.playing) {
            this._drawBg();
            return;
        }

        let event = {};

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        let currentTime = this.audioMixer.getCurrentTime(); // seconds
        let currentTimeMs = currentTime * 1000; // milliseconds
        event.currentTime = currentTime;

        if (currentTimeMs > this._sectionEnd || currentTimeMs < this._sectionStart) {
            if (currentTimeMs >= this._songDuration) {
                this.dispatch("animationframe", { songEnded: true });
                return;
            }
            this._playbackSection = this.chart.getSectionFromPos(currentTimeMs);

            event.changedSection = true;
            event.currentSection = this._playbackSection;

            this._sectionStart = this.chart.getPosition(this._playbackSection);

            if (this.chart.dynamicBPM) {
                let bpm = this.chart.getBPM(this._playbackSection);
                this._previousBPM = this._currentBPM;
                this._currentBPM = bpm;

                event.changedBPM = true;
                event.bpm = bpm;

                this._sectionDuration = this.chart.getDuration(this._playbackSection);
            }

            this._sectionEnd = this._sectionStart + this._sectionDuration;

            this._drawBg(this._playbackSection);
        } else {
            this.ctx.drawImage(this.canvasBg, 0, 0);
        }

        let offset = (currentTimeMs - this._sectionStart) / this._sectionDuration;
        let index = offset * this.stepsPerSection;
        offset *= this.canvas.height;

        this.ctx.beginPath();
        this.ctx.strokeStyle = "white";
        this.ctx.moveTo(this.waveInstPosX, offset);
        this.ctx.lineTo(this.chartPosX - this.chartSeparatorWidth, offset);
        this.ctx.stroke();

        this.ctx.fillStyle = "rgba(255, 255, 255, 0.1)";

        let ya = this.cellSize * Math.floor(index);
        this.ctx.fillRect(this.chartPosX, ya, this.canvas.width, this.cellSize);

        /*this.ctx.fillStyle = "#888";
        this.ctx.globalCompositeOperation = "multiply";
        this.ctx.fillRect(this.waveInstPosX, 0, this.chartPosX - this.waveInstPosX, offset);
        this.ctx.globalCompositeOperation = "source-over";*/

        this.dispatch("animationframe", event);

        window.requestAnimationFrame((t) => {
            this._animate(t);
        });
    }
}

export { Draw };