
# Audio Joiner

A browser-based static website that joins a fixed audio track with an audio file selected by a visitor.

## Features

- Plays the repository's fixed audio first.
- Appends the visitor's selected audio after it.
- Enforces a maximum combined duration of 6 minutes and 59 seconds.
- Provides an audio preview and WAV download.
- Exports ordinary 16-bit PCM WAV without embedded title, artist, copyright, comment, or other optional metadata chunks.
- Processes audio locally in the visitor's browser.
- Requires no server, database, API key, or backend.

## Repository files

Keep these files in the repository's root directory:

- `index.html`
- `style.css`
- `app.js`
- `source-audio.mp3`

The `README.md` file can also remain in the root directory.

## Add your fixed audio

Upload your original audio file to the repository's root directory and name it:

`source-audio.mp3`

If your file has a different name, edit the `SOURCE_AUDIO` constant at the top of `app.js` to match the filename.

The original audio is served as a static file by the hosting provider.

## Deploy to Render

1. Sign in to Render.
2. Choose **New** and then **Static Site**.
3. Connect your GitHub account if necessary.
4. Select the repository containing these files.
5. Configure the site:
   - **Build Command:** leave blank.
   - **Publish Directory:** `.`
6. Create the static site and wait for deployment.
7. Open the Render URL to test the website.

## Test the website

1. Confirm that the original audio shows as ready.
2. Select an audio file.
3. Click **Join audio**.
4. If the combined duration is 6:59 or less, preview the result and download it.

## Privacy and limitations

Audio processing takes place in the visitor's browser. The website code does not upload the selected audio to a backend.

The WAV encoder writes standard PCM audio and does not add optional metadata chunks. This is metadata minimization, not a guarantee that every possible identifying signal is removed from the sound itself.

Audio format support depends on the visitor's browser. The website needs JavaScript and Web Audio API support.

The output WAV may be larger than the original compressed audio files.

Removing file metadata does not remove audible watermarks or defeat acoustic fingerprinting or duplicate-detection systems.
