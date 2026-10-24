
"use strict";

// Put your fixed audio file in the repository's root directory.
// Change this filename if your file has a different name.
const SOURCE_AUDIO = "source-audio.mp3";

// 6 minutes and 59 seconds, in seconds.
const MAX_DURATION_SECONDS = 6 * 60 + 59;

const fileInput = document.getElementById("audio-file");
const fileNameDisplay = document.getElementById("file-name");
const sourceStatus = document.getElementById("source-status");
const joinButton = document.getElementById("join-button");
const statusDisplay = document.getElementById("status");
const resultSection = document.getElementById("result");
const resultDuration = document.getElementById("result-duration");
const audioPreview = document.getElementById("audio-preview");
const downloadLink = document.getElementById("download-link");
const sourceDot = document.querySelector(".status-dot");

let audioContext = null;
let sourceBuffer = null;
let selectedFile = null;
let outputUrl = null;

function setStatus(message, type = "") {
  statusDisplay.textContent = message;
  statusDisplay.className = "status";

  if (type) {
    statusDisplay.classList.add(type);
  }
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function updateButton() {
  joinButton.disabled = !sourceBuffer || !selectedFile;
}

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("Your browser does not support audio processing.");
    }

    audioContext = new AudioContextClass();
  }

  return audioContext;
}

async function decodeFile(arrayBuffer) {
  const context = getAudioContext();

  // Pass a copy because some browsers consume the supplied ArrayBuffer.
  return context.decodeAudioData(arrayBuffer.slice(0));
}

async function loadSourceAudio() {
  try {
    sourceStatus.textContent = "Loading original audio…";

    const response = await fetch(SOURCE_AUDIO, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Could not find "${SOURCE_AUDIO}". Check that it is in your repository's root folder.`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    sourceBuffer = await decodeFile(arrayBuffer);

    if (sourceBuffer.duration > MAX_DURATION_SECONDS) {
      throw new Error(
        "The original audio is already longer than the 6:59 limit."
      );
    }

    sourceStatus.textContent =
      `Original audio ready (${formatTime(sourceBuffer.duration)})`;
    sourceDot.classList.add("ready");

    updateButton();
    setStatus("Choose your audio file to continue.");
  } catch (error) {
    sourceBuffer = null;
    sourceStatus.textContent = error.message;
    sourceDot.classList.add("error");
    setStatus(error.message, "error");
    updateButton();
  }
}

fileInput.addEventListener("change", () => {
  selectedFile = fileInput.files && fileInput.files[0]
    ? fileInput.files[0]
    : null;

  resultSection.hidden = true;

  if (outputUrl) {
    URL.revokeObjectURL(outputUrl);
    outputUrl = null;
  }

  if (selectedFile) {
    fileNameDisplay.textContent = selectedFile.name;
    setStatus("File selected. Click Join audio to process it.");
  } else {
    fileNameDisplay.textContent = "No file selected";
    setStatus("Choose an audio file to get started.");
  }

  updateButton();
});

joinButton.addEventListener("click", async () => {
  if (!sourceBuffer || !selectedFile) {
    setStatus("Please make sure the original audio is available and select a file.", "error");
    return;
  }

  joinButton.disabled = true;
  joinButton.textContent = "Processing…";
  resultSection.hidden = true;
  setStatus("Reading and processing your audio. Please wait.");

  try {
    const context = getAudioContext();

    if (context.state === "suspended") {
      await context.resume();
    }

    const uploadedArrayBuffer = await selectedFile.arrayBuffer();
    const uploadedBuffer = await decodeFile(uploadedArrayBuffer);

    const totalDuration =
      sourceBuffer.duration + uploadedBuffer.duration;

    // A small tolerance avoids rejecting audio due to floating-point rounding.
    if (totalDuration > MAX_DURATION_SECONDS + 0.001) {
      throw new Error(
        `The combined audio is ${formatTime(totalDuration)} long. ` +
        "The maximum allowed duration is 6:59. Please choose a shorter file."
      );
    }

    const sampleRate = context.sampleRate;
    const totalFrames = Math.ceil(totalDuration * sampleRate);

    // Create a stereo output buffer.
    const outputBuffer = context.createBuffer(
      2,
      totalFrames,
      sampleRate
    );

    appendAudio(sourceBuffer, outputBuffer, 0);
    appendAudio(
      uploadedBuffer,
      outputBuffer,
      Math.round(sourceBuffer.duration * sampleRate)
    );

    const wavBlob = encodeWav(outputBuffer);

    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
    }

    outputUrl = URL.createObjectURL(wavBlob);

    audioPreview.src = outputUrl;
    downloadLink.href = outputUrl;
    downloadLink.download = "joined-audio.wav";

    resultDuration.textContent =
      `Total duration: ${formatTime(totalDuration)}`;

    resultSection.hidden = false;
    setStatus("Your audio has been joined successfully.", "success");
  } catch (error) {
    setStatus(
      error.message || "Something went wrong while processing the audio.",
      "error"
    );
  } finally {
    joinButton.textContent = "Join audio";
    updateButton();
  }
});

/**
 * Copies audio into the output buffer.
 * Mono audio is placed in both stereo channels.
 * For multichannel input, the first two channels are used.
 */
function appendAudio(inputBuffer, outputBuffer, startFrame) {
  const leftOutput = outputBuffer.getChannelData(0);
  const rightOutput = outputBuffer.getChannelData(1);

  const leftInput = inputBuffer.getChannelData(0);
  const rightInput = inputBuffer.numberOfChannels > 1
    ? inputBuffer.getChannelData(1)
    : leftInput;

  const framesToCopy = Math.min(
    inputBuffer.length,
    outputBuffer.length - startFrame
  );

  for (let i = 0; i < framesToCopy; i++) {
    leftOutput[startFrame + i] = leftInput[i];
    rightOutput[startFrame + i] = rightInput[i];
  }
}

/**
 * Encodes audio as ordinary 16-bit PCM WAV.
 * The WAV contains only the required "fmt " and "data" chunks.
 * No title, artist, copyright, comments, or other metadata chunks
 * are added by this encoder.
 */
function encodeWav(audioBuffer) {
  const numberOfChannels = 2;
  const sampleRate = audioBuffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const numberOfFrames = audioBuffer.length;

  const dataSize =
    numberOfFrames * numberOfChannels * bytesPerSample;

  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset, value) {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  }

  // RIFF header.
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");

  // Format chunk.
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM format chunk size
  view.setUint16(20, 1, true); // 1 = uncompressed PCM
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(
    28,
    sampleRate * numberOfChannels * bytesPerSample,
    true
  );
  view.setUint16(
    32,
    numberOfChannels * bytesPerSample,
    true
  );
  view.setUint16(34, bitsPerSample, true);

  // Audio data chunk.
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(1);

  let offset = headerSize;

  for (let i = 0; i < numberOfFrames; i++) {
    // Clamp samples to the valid range for PCM audio.
    const leftSample = Math.max(-1, Math.min(1, left[i]));
    const rightSample = Math.max(-1, Math.min(1, right[i]));

    const leftPcm = leftSample < 0
      ? leftSample * 0x8000
      : leftSample * 0x7fff;

    const rightPcm = rightSample < 0
      ? rightSample * 0x8000
      : rightSample * 0x7fff;

    view.setInt16(offset, leftPcm, true);
    offset += 2;

    view.setInt16(offset, rightPcm, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], {
    type: "audio/wav"
  });
}

// Load the fixed track when the page opens.
loadSourceAudio();

// Release the temporary download URL when the page is closed.
window.addEventListener("beforeunload", () => {
  if (outputUrl) {
    URL.revokeObjectURL(outputUrl);
  }

  if (audioContext) {
    audioContext.close();
  }
});
