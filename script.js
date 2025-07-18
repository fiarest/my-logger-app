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
        // イベントリスナーを削除（重複して追加されないように）
        customAlertOverlay.removeEventListener('click', closeCustomAlert);
        customAlertCloseBtn.removeEventListener('click', closeCustomAlert);
        customAlertBox.removeEventListener('click', (e) => e.stopPropagation());
    }


    /**
     * カウントダウンタイマーを更新する関数
     * @param {string} timerId - タイマー要素のID (例: 'timer-display-0')
     * @param {number} totalSeconds - 残り秒数
     * @param {HTMLElement} displayElement - タイマー表示のDOM要素
     * @param {number} setId - セットのインデックス (0-4)
     * @param {HTMLElement} titleInput - タイトル入力欄のDOM要素
     */
    function updateCountdown(timerId, totalSeconds, displayElement, setId, titleInput) {
        if (totalSeconds < 0) {
            clearInterval(timerIntervals[timerId]);
            displayElement.textContent = '00:00';
            localStorage.removeItem(`timer-${setId}-remaining`); 
            const title = titleInput.value.trim();
            const message = title ? `${title}のタイマーが終了しました！` : `セット${setId + 1}のタイマーが終了しました！`;
            showCustomAlert(message); // alert() の代わりにカスタムポップアップを使用
            return;
        }

        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const displayTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        displayElement.textContent = displayTime;

        try {
            localStorage.setItem(`timer-${setId}-remaining`, totalSeconds.toString());
        } catch (e) {
            console.error(`Error saving timer remaining for set ${setId} to local storage:`, e);
            console.warn("ローカルストレージへの書き込みに失敗しました。ブラウザのプライベートモードや設定をご確認ください。");
        }
    }

    /**
     * タイマーを開始する関数
     * @param {string} timerId - タイマー要素のID
     * @param {number} initialMinutes - 初期設定する分数（入力欄の値）
     * @param {HTMLElement} displayElement - タイマー表示のDOM要素
     * @param {number} setId - セットのインデックス
     * @param {HTMLElement} titleInput - タイトル入力欄のDOM要素
     */
    function startTimer(timerId, initialMinutes, displayElement, setId, titleInput) {
        if (timerIntervals[timerId]) {
            clearInterval(timerIntervals[timerId]); // 既存のタイマーがあれば停止
        }

        let totalSeconds = initialMinutes * 60; // 新しいカウントダウンは常に引数の initialMinutes で開始

        updateCountdown(timerId, totalSeconds, displayElement, setId, titleInput);

        timerIntervals[timerId] = setInterval(() => {
            totalSeconds--;
            updateCountdown(timerId, totalSeconds, displayElement, setId, titleInput);
        }, 1000);
    }

    const container = document.getElementById('container');
    if (!container) {
        console.error("Error: #container element not found. Cannot initialize sets.");
        return;
    }

    for (let i = 0; i < NUM_SETS; i++) {
        try {
            const inputSet = document.createElement('div');
            inputSet.classList.add('input-set');
            inputSet.id = `input-set-${i}`;

            inputSet.innerHTML = `
                <div class="title-section">
                    <input type="text" id="title-${i}" placeholder="タイトル">
                </div>
                <div class="timer-container">
                    <div class="timer-controls">
                        <input type="number" id="timer-minutes-${i}" class="timer-input" placeholder="分" min="1" value="5">
                        <button id="timer-start-btn-${i}" class="timer-button">開始</button>
                    </div>
                    <div class="timer-display" id="timer-display-${i}">00:00</div>
                </div>
                <div class="coord-log-container">
                    <div class="coord-inputs">
                        <div>
                            <label for="x-coord-${i}">X</label>
                            <input type="number" id="x-coord-${i}" step="any">
                        </div>
                        <div>
                            <label for="y-coord-${i}">Y</label>
                            <input type="number" id="y-coord-${i}" step="any">
                        </div>
                    </div>
                    <button id="log-btn-${i}">記録</button>
                </div>
                <div class="log-display" id="log-display-${i}">
                    <table class="log-table">
                        <thead>
                            <tr>
                                <th>日時</th>
                                <th>X</th>
                                <th>Y</th>
                            </tr>
                        </thead>
                        <tbody>
                            </tbody>
                    </table>
                </div>
                <div class="comment-section">
                    <textarea id="comment-${i}" class="comment-input" rows="2" placeholder="コメント"></textarea>
                </div>
            `;
            container.appendChild(inputSet);

            const titleInput = document.getElementById(`title-${i}`);
            const xCoordInput = document.getElementById(`x-coord-${i}`);
            const yCoordInput = document.getElementById(`y-coord-${i}`);
            const logButton = document.getElementById(`log-btn-${i}`);
            const logDisplayTableBody = inputSet.querySelector(`#log-display-${i} tbody`);
            const commentInput = document.getElementById(`comment-${i}`); // Add this line

            const timerMinutesInput = document.getElementById(`timer-minutes-${i}`);
            const timerStartBtn = document.getElementById(`timer-start-btn-${i}`);
            const timerDisplay = document.getElementById(`timer-display-${i}`);
            const currentTimerId = `timer-${i}`;

            if (!logButton) {
                console.error(`Error: logButton not found for set ${i}.`);
            }
            if (!timerStartBtn) {
                console.error(`Error: timerStartBtn not found for set ${i}.`);
            }
            if (!xCoordInput || !yCoordInput || !logDisplayTableBody) {
                console.error(`Error: Missing essential input/display elements for set ${i}. Log functionality might be broken.`);
            }
            if (!commentInput) { // Add this check
                console.error(`Error: commentInput not found for set ${i}.`);
            }

            try {
                const savedTitle = localStorage.getItem(`title-${i}`);
                if (savedTitle) {
                    titleInput.value = savedTitle;
                }
            } catch (e) {
                console.error(`Error loading title for set ${i} from local storage:`, e);
            }

            // Load saved comment (similar to title)
            try {
                const savedComment = localStorage.getItem(`comment-${i}`);
                if (savedComment) {
                    commentInput.value = savedComment;
                }
            } catch (e) {
                console.error(`Error loading comment for set ${i} from local storage:`, e);
            }


            let savedLogs = [];
            try {
                const storedLogsJson = localStorage.getItem(`logs-${i}`);
                if (storedLogsJson) {
                    const parsed = JSON.parse(storedLogsJson);
                    if (Array.isArray(parsed) && parsed.every(log => typeof log === 'object' && log !== null && 'datetime' in log)) {
                        savedLogs = parsed;
                    } else {
                        console.warn(`Corrupted logs data found for set ${i}, clearing.`, parsed);
                        savedLogs = [];
                        localStorage.removeItem(`logs-${i}`);
                    }
                }
            } catch (e) {
                console.error(`Error loading or parsing logs for set ${i} from local storage:`, e);
                console.warn("ローカルストレージからのログ読み込みに失敗しました。不正なデータが保存されている可能性があります。");
                savedLogs = [];
                localStorage.removeItem(`logs-${i}`);
            }

            let lastLoggedDate = null;
            const logsToDisplay = [...savedLogs].reverse().slice(0, MAX_LOG_ENTRIES);
            logsToDisplay.forEach(log => {
                if (log && log.datetime) {
                    const currentDate = log.datetime.substring(0, 5);
                    const needsSeparator = lastLoggedDate && lastLoggedDate !== currentDate;
                    addLogToTable(log, logDisplayTableBody, needsSeparator);
                    lastLoggedDate = currentDate;
                } else {
                    console.warn(`Skipping malformed log entry for set ${i}:`, log);
                }
            });


            const initialSavedRemaining = localStorage.getItem(`timer-${i}-remaining`);
            if (initialSavedRemaining !== null && !isNaN(parseInt(initialSavedRemaining))) {
                const parsedRemaining = parseInt(initialSavedRemaining);
                if (parsedRemaining > 0) {
                    startTimer(currentTimerId, 0, timerDisplay, i, titleInput);
                } else {
                     timerDisplay.textContent = '00:00';
                }
            } else {
                timerDisplay.textContent = `${String(parseInt(timerMinutesInput.value)).padStart(2, '0')}:00`;
            }

            function addLogToTable(logData, tableBodyElement, addSeparator = false) {
                const row = document.createElement('tr');
                const displayX = logData.x !== undefined ? logData.x : '';
                const displayY = logData.y !== undefined ? logData.y : '';
                row.innerHTML = `
                    <td>${logData.datetime}</td>
                    <td style="text-align: center;">${displayX}</td>
                    <td style="text-align: center;">${displayY}</td>
                `;
                if (addSeparator) {
                    row.classList.add('log-entry-date-separator');
                }
                tableBodyElement.prepend(row);
            }

            if (titleInput) {
                titleInput.addEventListener('input', () => {
                    try {
                        localStorage.setItem(`title-${i}`, titleInput.value);
                    } catch (e) {
                        console.error(`Error saving title for set ${i} to local storage:`, e);
                        console.warn("ローカルストレージへの書き込みに失敗しました。ブラウザのプライベートモードや設定をご確認ください。");
                    }
                });
            }

            if (commentInput) { // Add this block for comment input saving
                commentInput.addEventListener('input', () => {
                    try {
                        localStorage.setItem(`comment-${i}`, commentInput.value);
                    } catch (e) {
                        console.error(`Error saving comment for set ${i} to local storage:`, e);
                        console.warn("ローカルストレージへのコメント書き込みに失敗しました。ブラウザのプライベートモードや設定をご確認ください。");
                    }
                });
            }


            if (logButton && xCoordInput && yCoordInput && logDisplayTableBody) {
                logButton.addEventListener('click', () => {
                    console.log(`Log button clicked for set ${i}`);
                    try {
                        const x = xCoordInput.value;
                        const y = yCoordInput.value;

                        if (x === '' || y === '') {
                            showCustomAlert('XとYの両方を入力してください。');
                            return;
                        }

                        const now = new Date();
                        const month = String(now.getMonth() + 1).padStart(2, '0');
                        const day = String(now.getDate()).padStart(2, '0');
                        const hours = String(now.getHours()).padStart(2, '0');
                        const minutes = String(now.getMinutes()).padStart(2, '0');
                        const datetimeStr = `${month}/${day} ${hours}:${minutes}`;

                        const logData = {
                            datetime: datetimeStr,
                            x: x,
                            y: y
                        };

                        let needsSeparator = false;
                        if (savedLogs.length > 0) {
                            if (savedLogs[0] && savedLogs[0].datetime) {
                                const latestLogDate = savedLogs[0].datetime.substring(0, 5);
                                const newLogDate = datetimeStr.substring(0, 5);
                                if (latestLogDate !== newLogDate) {
                                    needsSeparator = true;
                                }
                            }
                        }

                        addLogToTable(logData, logDisplayTableBody, needsSeparator);

                        savedLogs.unshift(logData);

                        if (savedLogs.length > MAX_LOG_ENTRIES) {
                            savedLogs.splice(MAX_LOG_ENTRIES);
                            while (logDisplayTableBody.children.length > MAX_LOG_ENTRIES) {
                                logDisplayTableBody.removeChild(logDisplayTableBody.lastChild);
                            }
                        }

                        try {
                            localStorage.setItem(`logs-${i}`, JSON.stringify(savedLogs));
                            console.log(`Logs saved for set ${i}:`, savedLogs);
                        } catch (e) {
                            console.error(`Error saving logs for set ${i} to local storage:`, e);
                            console.warn("ログのローカルストレージへの書き込みに失敗しました。ブラウザのプライベートモードや設定をご確認ください。");
                            showCustomAlert("ログの保存に失敗しました。\nブラウザのプライベートモードやストレージ設定をご確認ください。");
                        }

                        xCoordInput.value = '';
                        yCoordInput.value = '';
                    } catch (e) {
                        console.error(`Error in log button click handler for set ${i}:`, e);
                        showCustomAlert(`ログ記録中に予期せぬエラーが発生しました:\n${e.message}`);
                    }
                });
                console.log(`Log button event listener attached for set ${i}.`);
            } else {
                console.warn(`Log button event listener NOT attached for set ${i} due to missing elements.`);
            }

            if (timerStartBtn && timerMinutesInput && timerDisplay && titleInput) {
                timerStartBtn.addEventListener('click', () => {
                    console.log(`Timer start button clicked for set ${i}`);
                    try {
                        const minutes = parseInt(timerMinutesInput.value);
                        if (isNaN(minutes) || minutes <= 0) {
                            showCustomAlert('1分以上の整数を入力してください。');
                            return;
                        }
                        startTimer(currentTimerId, minutes, timerDisplay, i, titleInput);
                    } catch (e) {
                        console.error(`Error in timer start button click handler for set ${i}:`, e);
                        showCustomAlert(`タイマー開始中に予期せぬエラーが発生しました:\n${e.message}`);
                    }
                });
                console.log(`Timer start button event listener attached for set ${i}.`);
            } else {
                console.warn(`Timer start button event listener NOT attached for set ${i} due to missing elements.`);
            }

        } catch (error) {
            console.error(`Critical error initializing input set ${i}:`, error);
        }
    }
});