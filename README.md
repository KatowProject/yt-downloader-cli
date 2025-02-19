# Youtube Downloader CLI
A simple CLI tool to download youtube videos and playlists.

## Pre-requisites
- Node.js or Bun.js
- FFmpeg (for audio only downloads)

## How to Install FFmpeg
**Windows**
1. Install [chocolatey](https://chocolatey.org/install)
2. Run the following command in cmd
```bash
choco install ffmpeg
```

**Linux**
Run the following command in terminal
```bash
sudo apt-get install ffmpeg
```

**Mac**
Run the following command in terminal
```bash
brew install ffmpeg
```

**Termux**
Run the following command in termux
```bash
pkg install ffmpeg
```

## Installation
```bash
# if using nodejs
npm i

# if using bun
bun install
```

## Usage
**Node.js**
```bash
node index.js
```

**Bun.js**
```bash
bun index.js
```

## Build
**Node.js**
Not available

**Bun.js**
```bash
bun build index.js --compile --outfile dist/yt-downloader.exe
```

## Features
- Download video
- Download video audio only
- Download playlist video
- Download playlist audio only.