import fs from 'fs';
import Ffmpeg from 'fluent-ffmpeg';

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';

import ytdl from 'ytdl-core';
import yts from 'yt-search';

const DOWNLOADS_DIR = 'downloads';
const TEMP_DIR = 'temp';

const promptForUrl = async (type) => {
    let isValidUrl = false;
    let url = '';

    while (!isValidUrl) {
        const input = await inquirer.prompt([
            {
                type: 'input',
                name: 'url',
                message: chalk.blue(`Masukkan URL ${type}`)
            }
        ]);

        url = input.url;

        if (type === 'video' && ytdl.validateURL(url)) {
            isValidUrl = true;
        } else if (type === 'playlist' && url.includes('playlist')) {
            isValidUrl = true;
        } else {
            console.error(chalk.red('URL tidak valid. Silakan coba lagi.'));
            const retry = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'retry',
                    message: chalk.yellow('Apakah Anda ingin mencoba lagi?'),
                    default: true
                }
            ]);

            if (!retry.retry) return null;
        }
    }

    return url;
};

const getVideoInfo = async (videoUrl) => {
    const spinner = ora('Mendapatkan info video...').start();
    try {
        const info = await ytdl.getInfo(videoUrl);
        spinner.succeed('Mendapatkan info video berhasil!');
        return info;
    } catch (error) {
        spinner.fail('Gagal mendapatkan info video.');
        console.error(chalk.red(error));
        return null;
    }
};

const displayVideoDetails = (detail) => {
    console.log(chalk.yellow(`Judul: ${detail.title}`));
    console.log(chalk.yellow(`Channel: ${detail.author.name}`));
    console.log(chalk.yellow(`Durasi: ${detail.lengthSeconds} detik`));
    console.log(chalk.yellow(`Thumbnail: ${detail.thumbnails[0].url}`));
};

const downloadMedia = async (videoUrl, options, filePath) => {
    const spinner = ora('Downloading...').start();
    const media = ytdl(videoUrl, options);

    const title = (filePath.split('/').pop()).split('.')[0];

    const audioStream = fs.createWriteStream(`${TEMP_DIR}/${title}.opus`);

    media.pipe(audioStream);

    return new Promise((resolve, reject) => {
        media.on('progress', (chunkLength, downloaded, total) => {
            const percent = downloaded / total * 100;
            spinner.text = `${percent.toFixed(2)}% downloaded (${(downloaded / (1024 * 1024)).toFixed(2)} MB of ${(total / (1024 * 1024)).toFixed(2)} MB)`;
        });

        media.on('end', async () => {
            if (filePath.includes('.mp4')) {
                spinner.succeed(chalk.green(`Download ${title} selesai!`));
            } else {
                spinner.succeed(chalk.green(`Download ${title} selesai!, proses konversi ke mp3...`));

                const mp3FilePath = filePath.replace('.opus', '.mp3');
                try {
                    await convertToMP3(`${TEMP_DIR}/${title}.opus`, `${DOWNLOADS_DIR}/${mp3FilePath}`, options);
                } catch (error) {
                    spinner.fail('Gagal mengonversi ke MP3');
                    console.error(error);
                    reject(error);
                }
            }
            resolve();
        });

        media.on('error', async (error) => {
            spinner.fail('Error downloading media:');
            console.error(chalk.red(error));
            reject(error);

            const retry = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'retry',
                    message: chalk.yellow('Apakah Anda ingin mencoba lagi?'),
                    default: true
                }
            ]);

            if (!retry.retry) reject(new Error('ExitPromptError'));

            downloadMedia(videoUrl, options, filePath);
        });
    });
};

const downloadMediaExtends = async (videoUrl, videoFormat, audioFormat, filePath) => {
    const spinner = ora('Downloading...').start();

    if (!fs.existsSync('temp')) fs.mkdirSync('temp');

    const video = ytdl(videoUrl, { format: videoFormat });
    const audio = ytdl(videoUrl, { format: audioFormat });

    const title = (filePath.split('/').pop()).split('.')[0];
    const videoStream = fs.createWriteStream(TEMP_DIR +'/' + title + '.mp4');

    video.pipe(videoStream);

    const updateProgress = (spinner, downloaded, total) => {
        const percent = (downloaded / total) * 100;
        spinner.text = `${percent.toFixed(2)}% downloaded (${(downloaded / (1024 * 1024)).toFixed(2)} MB of ${(total / (1024 * 1024)).toFixed(2)} MB)`;
    };

    return new Promise((resolve, reject) => {
        video.on('progress', (chunkLength, downloaded, total) => {
            updateProgress(spinner, downloaded, total);
        });

        video.on('end', () => {
            spinner.succeed(chalk.green(`Download Video ${title} selesai!, proses download audio...`));
            const audioStream = fs.createWriteStream(TEMP_DIR + '/' + title + '.opus');

            audio.pipe(audioStream);

            audio.on('progress', (chunkLength, downloaded, total) => {
                updateProgress(spinner, downloaded, total);
            });

            audio.on('end', async () => {
                spinner.succeed(chalk.green(`Download Audio ${title} selesai!, proses menggabungkan video dan audio...`));

                try {
                    await mergeVideoAudio(TEMP_DIR + '/' + title + '.mp4', TEMP_DIR + '/' + title + '.opus', DOWNLOADS_DIR + '/' + filePath);
                    resolve();
                } catch (error) {
                    spinner.fail('Gagal mengonversi ke MP3');
                    console.error(error);
                    reject(error);
                }
            });

            audio.on('error', (error) => {
                spinner.fail('Error downloading audio:');
                console.error(chalk.red(error));
                reject(error);
            });
        });

        video.on('error', (error) => {
            spinner.fail('Error downloading video:');
            console.error(chalk.red(error));
            reject(error);
        });
    });
};

const convertToMP3 = (rawFilePath, mp3FilePath, options) => {
    return new Promise((resolve, reject) => {
        const spinner = ora('Mengonversi ke MP3...').start();

        const bitrate = options?.format?.audioBitrate || '192';
        const audioSampleRate = options?.format?.audioSampleRate || '44100';
        const audioChannels = options?.format?.audioChannels || '2';

        Ffmpeg()
            .input(rawFilePath)
            .audioBitrate(bitrate)
            .audioFrequency(audioSampleRate)
            .audioChannels(audioChannels)
            .format('mp3')
            .on('progress', (progress) => {
                spinner.text = `Mengonversi ke MP3... ${progress.percent.toFixed(2)}% selesai`;
            })
            .on('end', () => {
                spinner.succeed(chalk.green(`Konversi ke MP3 berhasil: ${mp3FilePath}`));
                fs.unlinkSync(rawFilePath);
                resolve(mp3FilePath);
            })
            .on('error', (error) => {
                spinner.fail('Gagal mengonversi ke MP3');
                reject(error);
            })
            .save(mp3FilePath);
    });
};

const mergeVideoAudio = (videoFilePath, audioFilePath, outputFilePath) => {
    return new Promise((resolve, reject) => {
        const spinner = ora('Menggabungkan video dan audio...').start();

        Ffmpeg()
            .input(videoFilePath)
            .input(audioFilePath)
            .outputOptions(['-c:v copy', '-c:a aac'])
            .on('progress', (progress) => {
                spinner.text = `Menggabungkan video dan audio... ${progress.percent.toFixed(2)}% selesai`;
            })
            .on('end', () => {
                spinner.succeed(chalk.green(`Gabungan video dan audio berhasil: ${outputFilePath}`));
                fs.unlinkSync(videoFilePath);
                fs.unlinkSync(audioFilePath);
                resolve(outputFilePath);
            })
            .on('error', (error) => {
                spinner.fail('Gagal menggabungkan video dan audio');
                reject(error);
            })
            .save(outputFilePath);
    });
};

const downloadVideo = async () => {
    const videoUrl = await promptForUrl('video');
    if (!videoUrl) return;

    const info = await getVideoInfo(videoUrl);
    if (!info) return;

    const detail = info.videoDetails;
    displayVideoDetails(detail);

    const download = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'download',
            message: chalk.blue('Apakah Anda ingin mendownload video ini?'),
            default: true
        }
    ]);

    if (!download.download) return;

    const videoFormats = info.formats.filter((format) => format.hasVideo);

    const videoChoices = videoFormats.map((format, index) => ({
        name: `${format.qualityLabel} [${format.mimeType}] (${format.fps} fps) - ${format.hasAudio ? 'Include Sound' : `${format.container == 'mp4' ? '(Choose Audio Available with FFmpeg)' : '(No Audio)'}`}`,
        value: index
    }));

    const videoQuality = await inquirer.prompt([
        {
            type: 'list',
            name: 'quality',
            message: chalk.blue('Pilih kualitas video yang ingin diunduh'),
            choices: videoChoices
        }
    ]);

    // cek jika video tidak memiliki audio
    if (!videoFormats[videoQuality.quality].hasAudio) {
        console.log(chalk.yellow('Video ini tidak memiliki audio. Pilih kualitas video lain atau download audio menggunakan FFmpeg.'));
        
        const ffmpegDownload = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'ffmpeg',
                message: chalk.blue('Apakah Anda ingin mendownload audio menggunakan FFmpeg?'),
                default: true
            }
        ]);

        if (!ffmpegDownload.ffmpeg) return;

        const audioFormats = info.formats.filter((format) => format.hasAudio);
        const audioChoices = audioFormats.map((format, index) => ({
            name: `${format.audioBitrate} kbps - ${format.audioQuality} - ${format.container}`,
            value: index
        }));

        const audioQuality = await inquirer.prompt([
            {
                type: 'list',
                name: 'quality',
                message: chalk.blue('Pilih kualitas audio yang ingin diunduh'),
                choices: audioChoices
            }
        ]);

        const title = detail.title.replace(/[^\w\s]/gi, '');

        await downloadMediaExtends(videoUrl, videoFormats[videoQuality.quality], audioFormats[audioQuality.quality], `${title}.mp4`);
    } else {
        await downloadMedia(videoUrl, { quality: 'highest', filter: 'audioandvideo' }, `${DOWNLOADS_DIR}/${title}.mp4`);
    }

    setTimeout(() => {
        console.clear();
        menu();
    }, 2000);
};

const downloadAudio = async () => {
    const videoUrl = await promptForUrl('video');
    if (!videoUrl) return;

    const info = await getVideoInfo(videoUrl);
    if (!info) return;

    const detail = info.videoDetails;
    displayVideoDetails(detail);

    const audioFormats = info.formats.filter((format) => format.hasAudio);
    const audioChoices = audioFormats.map((format, index) => ({
        name: `${format.audioQuality} - ${format.audioBitrate} kbps [${format.mimeType}]`,
        value: index
    }));

    const audioQuality = await inquirer.prompt([
        {
            type: 'list',
            name: 'quality',
            message: chalk.blue('Pilih kualitas audio yang ingin diunduh'),
            choices: audioChoices
        }
    ]);

    const download = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'download',
            message: chalk.blue('Apakah Anda ingin mendownload audio dari video ini?'),
            default: true
        }
    ]);

    if (!download.download) return;

    const title = detail.title.replace(/[^\w\s]/gi, '');

    await downloadMedia(videoUrl, { format: audioFormats[audioQuality.quality] }, `${title}.opus`);

    setTimeout(() => {
        console.clear();
        menu();
    }, 2000);
};

const downloadPlaylist = async () => {
    const playlistUrl = await promptForUrl('playlist');
    if (!playlistUrl) return;

    const spinner = ora('Mendapatkan info playlist...').start();

    const idPlaylist = playlistUrl.split('list=')[1];
    const searchResults = await yts({ listId: idPlaylist });

    const playlistItems = searchResults.videos;

    if (playlistItems.length === 0) {
        spinner.fail(chalk.red('Gagal mendapatkan info playlist.'));
        return;
    }

    spinner.succeed(chalk.green('Mendapatkan info playlist berhasil!'));
    console.log(chalk.yellow(`Playlist berisi ${playlistItems.length} video.`));

    const download = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'download',
            message: chalk.blue('Apakah Anda ingin mendownload semua video di playlist ini?'),
            default: true
        }
    ]);

    if (!download.download) return;

    const playlistTitle = searchResults.title;
    if (!fs.existsSync(`${DOWNLOADS_DIR}/${playlistTitle}`)) fs.mkdirSync(`${DOWNLOADS_DIR}/${playlistTitle}`);

    for (const item of playlistItems) {
        const videoId = item.videoId;
        const title = item.title.replace(/[^\w\s]/gi, '');

        if (fs.existsSync(`${DOWNLOADS_DIR}/${playlistTitle}/${title}.mp4`)) {
            const stats = fs.statSync(`${DOWNLOADS_DIR}/${playlistTitle}/${title}.mp4`);
            if (stats.size > 0) {
                spinner.warn(chalk.yellow(`Video ${title} sudah ada. Lewati...`));
                continue;
            }
        }

        try {
            await downloadMedia(videoId, { quality: 'highest', filter: 'audioandvideo' }, `${playlistTitle}/${title}.mp4`);
        } catch (error) {
            spinner.fail(`Gagal mendownload video ${title}.`);
        }
    }

    console.log(chalk.green('Semua video di playlist berhasil didownload!'));
    setTimeout(() => {
        console.clear();
        menu();
    }, 2000);
};

const downloadAudioPlaylist = async () => {
    const playlistUrl = await promptForUrl('playlist');
    if (!playlistUrl) return;

    const spinner = ora('Mendapatkan info playlist...').start();

    const idPlaylist = playlistUrl.split('list=')[1];
    const searchResults = await yts({ listId: idPlaylist });

    const playlistItems = searchResults.videos;

    if (playlistItems.length === 0) {
        spinner.fail('Gagal mendapatkan info playlist.');
        return;
    }

    spinner.succeed('Mendapatkan info playlist berhasil!');
    console.log(chalk.yellow(`Playlist berisi ${playlistItems.length} video.`));

    const download = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'download',
            message: chalk.blue('Apakah Anda ingin mendownload audio dari semua video di playlist ini?'),
            default: true
        }
    ]);

    if (!download.download) return;

    const playlistTitle = searchResults.title;
    if (!fs.existsSync(`${DOWNLOADS_DIR}/${playlistTitle}`)) fs.mkdirSync(`${DOWNLOADS_DIR}/${playlistTitle}`);

    for (const item of playlistItems) {
        const videoId = item.videoId;
        const title = item.title.replace(/[^\w\s]/gi, '');

        if (fs.existsSync(`${DOWNLOADS_DIR}/${playlistTitle}/${title}.mp3`)) {
            const stats = fs.statSync(`${DOWNLOADS_DIR}/${playlistTitle}/${title}.mp3`);
            if (stats.size > 0) {
                spinner.warn(chalk.yellow(`Video ${title} sudah ada. Lewati...`));
                continue;
            }
        }

        await downloadMedia(videoId, { quality: 'highestaudio' }, `${playlistTitle}/${title}.opus`);
    }

    console.log(chalk.green('Semua audio di playlist berhasil didownload!'));
    setTimeout(() => {
        console.clear();
        menu();
    }, 2000);
};

const menu = async () => {
    try {
        if (!fs.existsSync('downloads')) fs.mkdirSync('downloads');

        const menu = await inquirer.prompt([
            {
                type: 'list',
                name: 'menu',
                message: chalk.blue('Pilih menu'),
                choices: [
                    { name: 'Download video', value: 'video' },
                    { name: 'Download audio', value: 'audio' },
                    { name: 'Download playlist', value: 'playlist' },
                    { name: 'Download audio playlist', value: 'audio_playlist' },
                    { name: 'Exit', value: 'exit' }
                ]
            }
        ]);

        const { menu: selectedMenu } = menu;

        switch (selectedMenu) {
            case 'video':
                await downloadVideo();
                break;
            case 'audio':
                await downloadAudio();
                break;
            case 'playlist':
                await downloadPlaylist();
                break;
            case 'audio_playlist':
                await downloadAudioPlaylist();
                break;
            case 'exit':
                console.log(chalk.green('Terima kasih!'));
                break;
            default:
                console.error(chalk.red('Invalid menu option selected.'));
        }
    } catch (error) {
        if (error.name === 'ExitPromptError') {
            console.log(chalk.green('Terima kasih!'));
            process.exit(0);
        } else {
            console.error(chalk.red('An unexpected error occurred:'), error);
        }
    }
}

menu();