document.addEventListener('DOMContentLoaded', () => {
    const NUM_SETS = 5;
    const MAX_LOG_ENTRIES = 15;

    const timerIntervals = {};

    // カスタムアラート要素の取得
    const customAlertOverlay = document.getElementById('custom-alert-overlay');
    const customAlertBox = document.getElementById('custom-alert-box');
    const customAlertMessage = document.getElementById('custom-alert-message');
    const customAlertCloseBtn = document.getElementById('custom-alert-close-btn');

    /**
     * カスタムアラートを表示する関数
     * @param {string} message - 表示するメッセージ
     */
    function showCustomAlert(message) {
        customAlertMessage.textContent = message;
        customAlertOverlay.classList.remove('hidden'); // 非表示クラスを削除して表示
        // ポップアップの外側をクリックしたら閉じるイベントリスナー
        customAlertOverlay.addEventListener('click', closeCustomAlert);
        // ポップアップボックス内の「閉じる」ボタンのイベントリスナー
        customAlertCloseBtn.addEventListener('click', closeCustomAlert);
        // ポップアップボックス自体へのクリックは伝播させない
        customAlertBox.addEventListener('click', (e) => e.stopPropagation());
    }

    /**
     * カスタムアラートを非表示にする関数
     */
    function closeCustomAlert() {
        customAlertOverlay.classList.add('hidden'); // 非表示クラスを追加して非表示
        // イベントリスナーを削除（重複して追加されるのを防ぐため）
        customAlertOverlay.removeEventListener('click', closeCustomAlert);
        customAlertCloseBtn.removeEventListener('click', closeCustomAlert);
        customAlertBox.removeEventListener('click', (e) => e.stopPropagation());
    }

    /**
     * ローカルストレージからログを読み込む関数
     * @param {number} setId - セットID
     * @returns {Array} ログエントリの配列
     */
    function loadLogs(setId) {
        const logsJson = localStorage.getItem(`logs_set_${setId}`);
        return logsJson ? JSON.parse(logsJson) : [];
    }

    /**
     * ローカルストレージにログを保存する関数
     * @param {number} setId - セットID
     * @param {Array} logs - ログエントリの配列
     */
    function saveLogs(setId, logs) {
        localStorage.setItem(`logs_set_${setId}`, JSON.stringify(logs));
    }

    /**
     * ログをテーブルに表示する関数
     * @param {number} setId - セットID
     * @param {Array} logs - ログエントリの配列
     * @param {HTMLElement} tbody - テーブルのtbody要素
     */
    function displayLogs(setId, logs, tbody) {
        tbody.innerHTML = '';
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">ログはありません。</td></tr>';
            return;
        }

        let lastDateForSeparator = ''; // 日付区切り用の変数
        logs.forEach((log, index) => {
            const row = tbody.insertRow(0); // 最新のログを上に追加
            row.dataset.logIndex = index; // ログ配列内のインデックスを保持

            const date = new Date(log.timestamp);
            
            // 日付区切り線の判定用（yyyy/mm/dd形式で比較）
            const currentDateForSeparator = date.toLocaleDateString('ja-JP');

            if (currentDateForSeparator !== lastDateForSeparator && lastDateForSeparator !== '') {
                const separatorRow = tbody.insertRow(0); // 日付区切り行を挿入
                const separatorCell = separatorRow.insertCell(0);
                separatorCell.colSpan = 3;
                separatorCell.className = 'log-entry-date-separator';
            }
            lastDateForSeparator = currentDateForSeparator;

            // 日時の表示形式を mm/dd hh/mm に変更
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const formattedDateTime = `${month}/${day} ${hours}:${minutes}`;

            const timeCell = row.insertCell(0);
            timeCell.textContent = formattedDateTime;

            const xCell = row.insertCell(1);
            xCell.textContent = log.x;

            const yCell = row.insertCell(2);
            yCell.textContent = log.y;

            // XとYのセルに編集可能クラスを付与
            xCell.classList.add('editable-cell');
            yCell.classList.add('editable-cell');
        });
    }

    /**
     * 新しいログエントリを追加する関数
     * @param {number} setId - セットID
     * @param {string} x - X座標
     * @param {string} y - Y座標
     * @param {HTMLElement} tbody - テーブルのtbody要素
     */
    function addLogEntry(setId, x, y, tbody) {
        let logs = loadLogs(setId);
        const newLog = {
            timestamp: new Date().toISOString(),
            x: x,
            y: y
        };
        logs.push(newLog);

        if (logs.length > MAX_LOG_ENTRIES) {
            logs = logs.slice(logs.length - MAX_LOG_ENTRIES); // 古いログを削除
        }
        saveLogs(setId, logs);
        displayLogs(setId, logs, tbody);
    }

    /**
     * タイマーを開始/更新する関数
     * @param {number} timerId - タイマーの識別子 (0-4)
     * @param {number} minutes - 設定分数
     * @param {HTMLElement} displayElement - タイマーを表示する要素
     * @param {number} setId - セットID
     * @param {HTMLInputElement} titleInput - タイトル入力要素
     */
    function startTimer(timerId, minutes, displayElement, setId, titleInput) {
        if (timerIntervals[timerId]) {
            clearInterval(timerIntervals[timerId]);
        }

        let totalSeconds = minutes * 60;
        const endTime = Date.now() + totalSeconds * 1000;

        const updateTimer = () => {
            const remainingSeconds = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
            const mins = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
            const secs = String(remainingSeconds % 60).padStart(2, '0');
            displayElement.textContent = `${mins}:${secs}`;

            if (remainingSeconds <= 0) {
                clearInterval(timerIntervals[timerId]);
                delete timerIntervals[timerId];
                displayElement.textContent = '00:00';
                showCustomAlert(`タイマー終了: ${titleInput.value}`);
            }
        };

        updateTimer();
        timerIntervals[timerId] = setInterval(updateTimer, 1000);
    }

    /**
     * タイマーをリセットする関数
     * @param {number} timerId - タイマーの識別子
     * @param {HTMLElement} displayElement - タイマーを表示する要素
     */
    function resetTimer(timerId, displayElement) {
        if (timerIntervals[timerId]) {
            clearInterval(timerIntervals[timerId]);
            delete timerIntervals[timerId];
        }
        displayElement.textContent = '00:00';
    }


    /**
     * 表のセルを編集可能にする関数
     * @param {Event} event - クリックイベント
     * @param {number} setId - 編集対象のログセットID
     */
    function handleCellEdit(event, setId) {
        const cell = event.target;
        // 日付セルや既に編集中のセル、空白のセルは編集しない
        if (!cell.classList.contains('editable-cell') || cell.querySelector('input') || cell.textContent === 'ログはありません。') {
            return;
        }

        const originalText = cell.textContent;
        const rowIndex = cell.parentNode.dataset.logIndex; // 保存されているログ配列のインデックス
        const colIndex = cell.cellIndex; // 列のインデックス (1:X, 2:Y)

        // input要素を作成
        const input = document.createElement('input');
        input.type = 'text'; // 数字以外も編集できるようにtextに
        input.value = originalText;
        input.style.width = '100%'; // セル幅に合わせる
        input.style.padding = '2px';
        input.style.boxSizing = 'border-box';
        input.style.border = '1px solid #007bff';
        input.style.borderRadius = '3px';
        input.style.textAlign = 'center';
        input.style.fontSize = 'inherit'; // 親のフォントサイズを継承

        // セルの内容をinputに置き換える
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();

        // 編集終了時の処理
        const saveEdit = () => {
            let newValue = input.value.trim();
            // X,Y座標の場合は数値に変換（あるいは空文字列を許可）
            if (colIndex === 1 || colIndex === 2) { // X or Y
                // 数値に変換できない場合は元の値に戻すか、空を許可するか選択
                // 今回は数値でない場合もそのまま文字列として保存できるように変更
                // newValue = parseFloat(newValue) || ''; // 数値に変換できない場合は空文字列
            }
            
            // 元のログ配列を取得
            const logs = loadLogs(setId);
            // ログ配列は新しいものが上に来るように表示されているため、
            // クリックした行のデータインデックス (logIndex) を使って元の配列の正しい位置を特定
            // displayLogsでrow.dataset.logIndexに格納しているのは、logs配列における元のインデックス
            if (logs[rowIndex]) {
                if (colIndex === 1) { // X座標
                    logs[rowIndex].x = newValue;
                } else if (colIndex === 2) { // Y座標
                    logs[rowIndex].y = newValue;
                }
                saveLogs(setId, logs);
            }
            
            // 表示を元のテキストに戻す
            cell.textContent = newValue;
            cell.removeEventListener('click', handleCellEdit); // 一時的にイベントリスナーを削除して再追加しない
        };

        // Enterキーで保存
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveEdit();
            }
        });

        // フォーカスが外れたら保存
        input.addEventListener('blur', saveEdit);
    }

    // 各入力セットを初期化
    for (let i = 0; i < NUM_SETS; i++) {
        try {
            const setId = i; // セットのID (0-4)
            const inputSet = document.getElementById(`input-set-${setId}`);
            if (!inputSet) {
                console.warn(`Input set with ID 'input-set-${setId}' not found. Skipping initialization for this set.`);
                continue;
            }

            const titleInput = inputSet.querySelector('.title-section input[type="text"]');
            const xInput = inputSet.querySelector('.coord-inputs .x-coord input[type="number"]');
            const yInput = inputSet.querySelector('.coord-inputs .y-coord input[type="number"]');
            const logBtn = inputSet.querySelector('.log-btn');
            const tbody = inputSet.querySelector('.log-table tbody');

            const timerMinutesInput = inputSet.querySelector('.timer-input');
            const timerStartBtn = inputSet.querySelector('.timer-start-btn');
            const timerResetBtn = inputSet.querySelector('.timer-reset-btn');
            const timerDisplay = inputSet.querySelector('.timer-display');

            // ログの読み込みと表示
            displayLogs(setId, loadLogs(setId), tbody);

            // 記録ボタンのイベントリスナー
            if (logBtn && xInput && yInput && tbody) {
                logBtn.addEventListener('click', () => {
                    addLogEntry(setId, xInput.value, yInput.value, tbody);
                    xInput.value = ''; // 記録後にクリア
                    yInput.value = ''; // 記録後にクリア
                });
                console.log(`Log button event listener attached for set ${i}.`);
            } else {
                console.warn(`Log button event listener NOT attached for set ${i} due to missing elements.`);
            }

            // タイマー関連のイベントリスナー
            if (timerStartBtn && timerMinutesInput && timerDisplay && titleInput) {
                timerStartBtn.addEventListener('click', () => {
                    console.log(`Timer start button clicked for set ${i}`);
                    try {
                        const minutes = parseInt(timerMinutesInput.value);
                        if (isNaN(minutes) || minutes <= 0) {
                            showCustomAlert('1分以上の整数を入力してください。');
                            return;
                        }
                        startTimer(setId, minutes, timerDisplay, setId, titleInput); // currentTimerId を setId に変更
                    } catch (e) {
                        console.error(`Error in timer start button click handler for set ${i}:`, e);
                        showCustomAlert(`タイマー開始中に予期せぬエラーが発生しました:\\n${e.message}`);
                    }
                });
                console.log(`Timer start button event listener attached for set ${i}.`);
            } else {
                console.warn(`Timer start button event listener NOT attached for set ${i} due to missing elements.`);
            }

            if (timerResetBtn && timerDisplay) {
                timerResetBtn.addEventListener('click', () => {
                    resetTimer(setId, timerDisplay);
                });
                console.log(`Timer reset button event listener attached for set ${i}.`);
            } else {
                console.warn(`Timer reset button event listener NOT attached for set ${i} due to missing elements.`);
            }

            // 表のセル編集機能のセットアップ
            tbody.addEventListener('click', (event) => handleCellEdit(event, setId));

        } catch (error) {
            console.error(`Critical error initializing input set ${i}:`, error);
        }
    }
});