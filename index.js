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

const downloadVideo = async () => {
    const videoUrl = await promptForUrl('video');
    if (!videoUrl) return;

    const spinner = ora('Mendapatkan info video...').start();
    const info = await ytdl.getInfo(videoUrl);

    if (!info) {
        spinner.fail('Gagal mendapatkan info video.');
        return;
    }

    const detail = info.videoDetails;
    const title = detail.title;

    spinner.succeed('Mendapatkan info video berhasil!');
    console.log(chalk.yellow(`Judul: ${title}`));
    console.log(chalk.yellow(`Channel: ${detail.author.name}`));
    console.log(chalk.yellow(`Durasi: ${detail.lengthSeconds} detik`));
    console.log(chalk.yellow(`Thumbnail: ${detail.thumbnails[0].url}`));

    const download = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'download',
            message: chalk.blue('Apakah Anda ingin mendownload video ini?'),
            default: true
        }
    ]);

    if (!download.download) return;

    spinner.start('Downloading video...');
    const video = ytdl(videoUrl, { quality: 'highest', filter: 'audioandvideo' });

    video.pipe(fs.createWriteStream(`downloads/${title}.mp4`));

    video.on('progress', (chunkLength, downloaded, total) => {
        const percent = downloaded / total * 100;
        spinner.text = `${percent.toFixed(2)}% downloaded (${(downloaded / (1024 * 1024)).toFixed(2)} MB of ${(total / (1024 * 1024)).toFixed(2)} MB)`;
    });

    video.on('end', () => {
        spinner.succeed('Download selesai!');
        setTimeout(() => {
            console.clear();
            menu();
        }, 2000);
    });

    video.on('error', (error) => {
        spinner.fail('Error downloading video:');
        console.error(chalk.red(error));
    });
};

const downloadAudio = async () => {
    const videoUrl = await promptForUrl('video');
    if (!videoUrl) return;

    const spinner = ora('Mendapatkan info video...').start();
    const info = await ytdl.getInfo(videoUrl);

    if (!info) {
        spinner.fail('Gagal mendapatkan info video.');
        return;
    }

    const detail = info.videoDetails;
    const title = detail.title;

    spinner.succeed('Mendapatkan info video berhasil!');
    console.log(chalk.yellow(`Judul: ${title}`));
    console.log(chalk.yellow(`Channel: ${detail.author.name}`));
    console.log(chalk.yellow(`Durasi: ${detail.lengthSeconds} detik`));
    console.log(chalk.yellow(`Thumbnail: ${detail.thumbnails[0].url}`));

    const download = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'download',
            message: chalk.blue('Apakah Anda ingin mendownload audio dari video ini?'),
            default: true
        }
    ]);

    if (!download.download) return;

    spinner.start('Downloading audio...');
    const audio = ytdl(videoUrl, { quality: 'highestaudio' });

    audio.pipe(fs.createWriteStream(`downloads/${title}.mp3`));

    audio.on('progress', (chunkLength, downloaded, total) => {
        const percent = downloaded / total * 100;
        spinner.text = `${percent.toFixed(2)}% downloaded (${(downloaded / (1024 * 1024)).toFixed(2)} MB of ${(total / (1024 * 1024)).toFixed(2)} MB)`;
    });

    audio.on('end', () => {
        spinner.succeed('Download selesai!');
        setTimeout(() => {
            console.clear();
            menu();
        }, 2000);
    });

    audio.on('error', (error) => {
        spinner.fail('Error downloading audio:');
        console.error(chalk.red(error));
    });
};

const downloadPlaylist = async () => {
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

        spinner.start(`Downloading video: ${title}...`);
        const video = ytdl(videoId, { quality: 'highest', filter: 'audioandvideo' });

        video.pipe(fs.createWriteStream(`downloads/${playlistTitle}/${title}.mp4`));

        await new Promise((resolve, reject) => {
            video.on('progress', (chunkLength, downloaded, total) => {
                const percent = downloaded / total * 100;
                spinner.text = `${percent.toFixed(2)}% downloaded (${(downloaded / (1024 * 1024)).toFixed(2)} MB of ${(total / (1024 * 1024)).toFixed(2)} MB)`;
            });

            video.on('end', () => {
                spinner.succeed(`Download selesai: ${title}`);
                resolve();
            });

            video.on('error', (error) => {
                spinner.fail(`Error downloading video: ${title}`);
                console.error(chalk.red(error));
                reject(error);
            });
        });
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

        spinner.start(`Downloading audio: ${title}...`);
        const audio = ytdl(`https://www.youtube.com/watch?v=${videoId}`, { quality: 'highestaudio' });

        audio.pipe(fs.createWriteStream(`downloads/${playlistTitle}/${title}.mp3`));

        await new Promise((resolve, reject) => {
            audio.on('progress', (chunkLength, downloaded, total) => {
                const percent = downloaded / total * 100;
                spinner.text = `${percent.toFixed(2)}% downloaded (${(downloaded / (1024 * 1024)).toFixed(2)} MB of ${(total / (1024 * 1024)).toFixed(2)} MB)`;
            });

            audio.on('end', () => {
                spinner.succeed(`Download selesai: ${title}`);
                resolve();
            });

            audio.on('error', (error) => {
                spinner.fail(`Error downloading audio: ${title}`);
                console.error(chalk.red(error));
                reject(error);
            });
        });
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