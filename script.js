let selectedFile = null;

document.getElementById('traj-file-input').addEventListener('change', (event) => {
    selectedFile = event.target.files[0];
    if (selectedFile) {
        document.getElementById('file-name').textContent = `選択中のファイル: ${selectedFile.name}`;
    } else {
        document.getElementById('file-name').textContent = '';
    }
});

document.getElementById('convert-btn').addEventListener('click', () => {
    // 変換開始時に以前の結果をクリアする
    const downloadContainer = document.getElementById('download-container');
    const messageBox = document.getElementById('message-box');
    downloadContainer.innerHTML = '';
    messageBox.style.display = 'none';

    if (!selectedFile) {
        showMessage('最初にファイルを選択してください。', 'error');
        return;
    }

    const startStep = parseInt(document.getElementById('start-step').value, 10);
    const endStep = parseInt(document.getElementById('end-step').value, 10);
    const intervalStep = parseInt(document.getElementById('interval-step').value, 10);

    if (isNaN(startStep) || isNaN(endStep) || isNaN(intervalStep) || startStep < 0 || endStep < startStep || intervalStep < 1) {
        showMessage('パラメータの値が無効です。もう一度確認してください。', 'error');
        return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
        const trajContent = e.target.result;
        showMessage('ファイルを処理中...', 'info');

        try {
            const zip = new JSZip();
            const frames = trajContent.trim().split('ITEM: TIMESTEP').slice(1);
            
            if (frames.length === 0) {
                showMessage('有効なタイムステップが見つかりませんでした。', 'error');
                return;
            }

            let fileCount = 0;
            frames.forEach(frameText => {
                const lines = frameText.trim().split('\n');
                const timestep = parseInt(lines[0].trim(), 10);

                // タイムステップが指定範囲内かつインターバルに合致するかチェック
                if (timestep >= startStep && timestep <= endStep && (timestep - startStep) % intervalStep === 0) {
                    const numAtomsIndex = lines.findIndex(line => line.includes('ITEM: NUMBER OF ATOMS'));
                    const boxBoundsIndex = lines.findIndex(line => line.includes('ITEM: BOX BOUNDS'));
                    const atomsIndex = lines.findIndex(line => line.includes('ITEM: ATOMS'));
                    
                    if (numAtomsIndex === -1 || boxBoundsIndex === -1 || atomsIndex === -1) {
                        console.warn(`Skipping invalid frame for timestep ${timestep}`);
                        return;
                    }

                    const numAtoms = parseInt(lines[numAtomsIndex + 1].trim(), 10);
                    const boxBoundsLines = lines.slice(boxBoundsIndex + 1, boxBoundsIndex + 4);
                    const [xlo, xhi] = boxBoundsLines[0].trim().split(/\s+/).map(Number);
                    const [ylo, yhi] = boxBoundsLines[1].trim().split(/\s+/).map(Number);
                    const [zlo, zhi] = boxBoundsLines[2].trim().split(/\s+/).map(Number);
                    const atomLines = lines.slice(atomsIndex + 1);

                    let xyzContent = `${numAtoms}\n`;
                    xyzContent += `Timestep: ${timestep}, Box: [${xlo.toFixed(6)}, ${xhi.toFixed(6)}] [${ylo.toFixed(6)}, ${yhi.toFixed(6)}] [${zlo.toFixed(6)}, ${zhi.toFixed(6)}]\n`;
                    
                    let processedAtoms = 0;
                    for(const line of atomLines) {
                        if (processedAtoms >= numAtoms) break;
                        const parts = line.trim().split(/\s+/);
                        if (parts.length < 5) continue;

                        const type = parts[1];
                        const xs = parseFloat(parts[2]);
                        const ys = parseFloat(parts[3]);
                        const zs = parseFloat(parts[4]);

                        const x = xlo + xs * (xhi - xlo);
                        const y = ylo + ys * (yhi - ylo);
                        const z = zlo + zs * (zhi - zlo);
                        
                        xyzContent += `${type} ${x.toFixed(8)} ${y.toFixed(8)} ${z.toFixed(8)}\n`;
                        processedAtoms++;
                    }
                    
                    // xyzファイルをZIPに追加
                    zip.file(`timestep_${timestep}.xyz`, xyzContent);
                    fileCount++;
                }
            });

            if (fileCount > 0) {
                showMessage('ZIPファイルを生成中...', 'info');
                zip.generateAsync({ type: "blob" }).then(content => {
                    createDownloadLink(content, "converted_xyz_files.zip");
                    showMessage(`${fileCount}個のファイルがZIPに圧縮されました。`, 'success');
                });
            } else {
                showMessage('指定された範囲に該当するタイムステップが見つかりませんでした。', 'error');
            }

        } catch (error) {
            console.error("An error occurred during conversion:", error);
            showMessage('変換中にエラーが発生しました。コンソールで詳細を確認してください。', 'error');
        }
    };
    
    reader.onerror = () => {
         showMessage('ファイルの読み込み中にエラーが発生しました。', 'error');
    };

    reader.readAsText(selectedFile);
});

function createDownloadLink(content, filename) {
    const downloadContainer = document.getElementById('download-container');
    downloadContainer.innerHTML = ''; // 既存のリンクをクリア

    const blob = new Blob([content], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.textContent = `ダウンロード: ${filename}`;
    a.className = 'inline-block bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300';
    
    downloadContainer.appendChild(a);
}

function showMessage(text, type) {
    const resultContainer = document.getElementById('result-container');
    const messageBox = document.getElementById('message-box');
    resultContainer.style.display = 'block';
    messageBox.textContent = text;
    
    let bgColor = 'bg-blue-100';
    let textColor = 'text-blue-800';

    if (type === 'success') {
        bgColor = 'bg-green-100';
        textColor = 'text-green-800';
    } else if (type === 'error') {
        bgColor = 'bg-red-100';
        textColor = 'text-red-800';
    }
    
    messageBox.className = `mt-4 p-4 rounded-md text-center ${bgColor} ${textColor}`;
    messageBox.style.display = 'block';
}
