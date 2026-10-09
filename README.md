# Mouth String

> Turn spoken words into playful typographic ribbons.

[**View live demo →**](https://michmich02.github.io/mouth-string/)

## Overview

Mouth String treats speech and facial movement as visual material. Spoken text becomes an animated ribbon that responds to the performer, connecting voice, typography, and motion.

## Interaction

- Allow camera and microphone access.
- Speak a short phrase.
- Move in front of the camera to shape the typographic response.

## Built with

`JavaScript` · `Face tracking` · `Web Speech API` · `Canvas`

## Run locally

```sh
python3 -m http.server 8000 --directory docs
```

Open [http://localhost:8000](http://localhost:8000) in a desktop browser. Camera and microphone APIs require localhost or HTTPS; external models and CDN dependencies require an internet connection.

## Design notes

- Immediate visual feedback keeps the gesture-to-effect relationship legible.
- The experience is designed as a focused, full-screen interaction.
- Processing happens in the browser; camera and microphone streams are not uploaded by this project.
