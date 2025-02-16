import inquirer from 'inquirer';
import ytdl from 'ytdl-core';
import yts from 'yt-search';
import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';

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

            if (!retry.retry) {
                return null;
            }
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

    media.pipe(fs.createWriteStream(filePath));

    return new Promise((resolve, reject) => {
        media.on('progress', (chunkLength, downloaded, total) => {
            const percent = downloaded / total * 100;
            spinner.text = `${percent.toFixed(2)}% downloaded (${(downloaded / (1024 * 1024)).toFixed(2)} MB of ${(total / (1024 * 1024)).toFixed(2)} MB)`;
        });

        media.on('end', () => {
            spinner.succeed(chalk.green(`Download ${title} selesai!`));
            resolve();
        });

        media.on('error', (error) => {
            spinner.fail('Error downloading media:');
            console.error(chalk.red(error));
            reject(error);
        });
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

    await downloadMedia(videoUrl, { quality: 'highest', filter: 'audioandvideo' }, `downloads/${detail.title}.mp4`);
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

    const download = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'download',
            message: chalk.blue('Apakah Anda ingin mendownload audio dari video ini?'),
            default: true
        }
    ]);

    if (!download.download) return;

    await downloadMedia(videoUrl, { quality: 'highestaudio' }, `downloads/${detail.title}.mp3`);
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
    if (!fs.existsSync(`downloads/${playlistTitle}`)) fs.mkdirSync(`downloads/${playlistTitle}`);

    for (const item of playlistItems) {
        const videoId = item.videoId;
        const title = item.title;

        if (fs.existsSync(`downloads/${playlistTitle}/${title}.mp4`)) {
            const stats = fs.statSync(`downloads/${playlistTitle}/${title}.mp4`);
            if (stats.size > 0) {
                spinner.warn(chalk.yellow(`Video ${title} sudah ada. Lewati...`));
                continue;
            }
        }

        try {
            await downloadMedia(`https://www.youtube.com/watch?v=${videoId}`, { quality: 'highest', filter: 'audioandvideo' }, `downloads/${playlistTitle}/${title}.mp4`);
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
    if (!fs.existsSync(`downloads/${playlistTitle}`)) fs.mkdirSync(`downloads/${playlistTitle}`);

    for (const item of playlistItems) {
        const videoId = item.videoId;
        const title = item.title;

        if (fs.existsSync(`downloads/${playlistTitle}/${title}.mp4`)) {
            const stats = fs.statSync(`downloads/${playlistTitle}/${title}.mp4`);
            if (stats.size > 0) {
                spinner.warn(chalk.yellow(`Video ${title} sudah ada. Lewati...`));
                continue;
            }
        }

        await downloadMedia(`https://www.youtube.com/watch?v=${videoId}`, { quality: 'highestaudio' }, `downloads/${playlistTitle}/${title}.mp3`);
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