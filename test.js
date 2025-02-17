import { exec } from 'child_process';
import NodeID3 from 'node-id3';
import axios from 'axios';
import fs from 'fs';
import imageType from 'image-type';
import ytdl from 'ytdl-core';
import ora from 'ora';
import chalk from 'chalk';

// 📌 Fungsi untuk mendownload audio dalam format asli dari YouTube
const downloadAudio = async (videoUrl, rawFilePath) => {
    return new Promise((resolve, reject) => {
        const spinner = ora('Downloading raw audio...').start();
        const stream = ytdl(videoUrl, { quality: 'highestaudio' });

        stream.pipe(fs.createWriteStream(rawFilePath));

        stream.on('end', () => {
            spinner.succeed(chalk.green(`Download selesai: ${rawFilePath}`));
            resolve(rawFilePath);
        });

        stream.on('error', (error) => {
            spinner.fail('Error saat mengunduh audio');
            reject(error);
        });
    });
};

// 📌 Fungsi untuk mengonversi ke MP3 menggunakan FFmpeg
const convertToMP3 = async (rawFilePath, mp3FilePath) => {
    return new Promise((resolve, reject) => {
        const spinner = ora('Mengonversi ke MP3...').start();
        const command = `ffmpeg -y -i "${rawFilePath}" -vn -ar 44100 -ac 2 -b:a 192k "${mp3FilePath}"`;

        exec(command, (error) => {
            if (error) {
                spinner.fail('Gagal mengonversi ke MP3');
                reject(error);
            } else {
                spinner.succeed(chalk.green(`Konversi selesai: ${mp3FilePath}`));
                resolve(mp3FilePath);
            }
        });
    });
};

// 📌 Fungsi untuk menambahkan metadata setelah konversi
const addMetadata = async (filePath, videoDetails) => {
    try {
        const spinner = ora('Menambahkan metadata...').start();

        // 🔥 Hapus metadata lama terlebih dahulu
        NodeID3.removeTags(filePath);

        // 🔥 Ambil thumbnail dari YouTube
        const response = await axios.get(videoDetails.thumbnails[0].url, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data);

        // 🔥 Deteksi MIME type otomatis
        const imageInfo = imageType(imageBuffer);
        if (!imageInfo) {
            spinner.fail('Format gambar tidak dikenali');
            return;
        }

        // 🔥 Siapkan metadata baru
        let tags = {
            title: videoDetails.title,
            artist: videoDetails.author.name,
            album: 'YouTube Download',
            TRCK: '1',
            APIC: {
                mime: imageInfo.mime, // Format gambar otomatis
                type: 3,
                description: 'Cover',
                imageBuffer
            }
        };

        // 🔥 Tambahkan metadata ke file MP3
        let success = NodeID3.write(tags, filePath);
        if (success) {
            spinner.succeed(chalk.green('Metadata berhasil ditambahkan dan cover diperbarui!'));
        } else {
            spinner.fail(chalk.red('Gagal menambahkan metadata.'));
        }

    } catch (error) {
        console.error(chalk.red('Gagal menambahkan metadata:', error));
    }
};


// 📌 Fungsi utama untuk download, konversi, dan menambahkan metadata
const processMP3 = async (videoUrl) => {
    const info = await ytdl.getInfo(videoUrl);
    const videoDetails = info.videoDetails;
    const rawFilePath = `downloads/${videoDetails.title}.webm`; // Simpan sebagai WebM terlebih dahulu
    const mp3FilePath = `downloads/${videoDetails.title}.mp3`;  // Konversi ke MP3

    // 🔥 Langkah 1: Download file dalam format asli
    await downloadAudio(videoUrl, rawFilePath);

    // 🔥 Langkah 2: Konversi ke MP3 dengan FFmpeg
    await convertToMP3(rawFilePath, mp3FilePath);

    // 🔥 Langkah 3: Tambahkan metadata setelah konversi
    await addMetadata(mp3FilePath, videoDetails);

    // 🔥 Langkah 4: Hapus file mentah setelah konversi selesai
    fs.unlinkSync(rawFilePath);
};

// 🛠 Tes fungsi dengan URL video
const testVideoUrl = 'https://music.youtube.com/watch?v=2ikMLG2sz8o&si=fZruvVTbn1h0Occ4';
processMP3(testVideoUrl);
