// script.js の一番上に追加または変更

// Firebase Firestore の関数をインポート
// index.html で使用している Firebase SDK のバージョンに合わせてください (例: 9.23.0)
import { 
    doc, 
    setDoc, 
    onSnapshot, 
    collection, 
    query, 
    orderBy, 
    limit, 
    addDoc 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const NUM_SETS = 5;
    const MAX_LOG_ENTRIES = 15;

    const timerIntervals = {};

    // カスタムアラート要素の取得
    const customAlertOverlay = document.getElementById('custom-alert-overlay');
    const customAlertBox = document.getElementById('custom-alert-box');
    const customAlertMessage = document.getElementById('custom-alert-message');
    const customAlertCloseBtn = document.getElementById('custom-alert-close-btn');

    // Firebase Firestore のインスタンスを取得
    const db = window.db; 
    if (!db) {
        console.error("Firebase Firestore is not initialized. Make sure Firebase SDK is loaded correctly in index.html.");
        showCustomAlert("データの同期機能が利用できません。\nブラウザのコンソールをご確認ください。");
        return; 
    }

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
            // Firebaseからタイマー残りをクリア
            setDoc(doc(db, `timer_states/${setId}`), { remainingSeconds: 0, isActive: false }, { merge: true }).catch(e => console.error("Error updating timer state in Firestore:", e));
            const title = titleInput.value.trim();
            const message = title ? `${title}のタイマーが終了しました！` : `セット${setId + 1}のタイマーが終了しました！`;
            showCustomAlert(message);
            return;
        }

        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const displayTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        displayElement.textContent = displayTime;

        // タイマーの残り時間をFirebaseに保存
        setDoc(doc(db, `timer_states/${setId}`), { remainingSeconds: totalSeconds, isActive: true }, { merge: true }).catch(e => console.error("Error saving timer remaining to Firestore:", e));
    }

    /**
     * タイマーを開始する関数
     * @param {string} timerId - タイマー要素のID
     * @param {number} initialSeconds - 初期設定する秒数
     * @param {HTMLElement} displayElement - タイマー表示のDOM要素
     * @param {number} setId - セットのインデックス
     * @param {HTMLElement} titleInput - タイトル入力欄のDOM要素
     */
    function startTimer(timerId, initialSeconds, displayElement, setId, titleInput) {
        if (timerIntervals[timerId]) {
            clearInterval(timerIntervals[timerId]);
        }

        let totalSeconds = initialSeconds;

        updateCountdown(timerId, totalSeconds, displayElement, setId, titleInput);

        timerIntervals[timerId] = setInterval(() => {
            totalSeconds--;
            updateCountdown(timerId, totalSeconds, displayElement, setId, titleInput);
        }, 1000);

        // タイマー開始時にFirebaseのisActiveをtrueに設定
        setDoc(doc(db, `timer_states/${setId}`), { isActive: true, initialSeconds: initialSeconds, startTime: new Date().getTime() }, { merge: true }).catch(e => console.error("Error setting timer active state in Firestore:", e));
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

            // 日時入力欄を削除したHTML構造
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
            const commentInput = document.getElementById(`comment-${i}`);
            // datetimeInput は削除されたので取得しない

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
            if (!commentInput) {
                console.error(`Error: commentInput not found for set ${i}.`);
            }

            // タイトルとコメントをFirebaseからリアルタイムで読み込み・同期
            // settingsコレクションの各セットIDのドキュメントを監視
            onSnapshot(doc(db, `settings/${i}`), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    titleInput.value = data.title || '';
                    commentInput.value = data.comment || '';
                    if (data.timerMinutes) { // タイマー初期値も同期したい場合
                        timerMinutesInput.value = data.timerMinutes;
                    }
                } else {
                    // ドキュメントが存在しない場合はデフォルト値
                    titleInput.value = '';
                    commentInput.value = '';
                    timerMinutesInput.value = '5'; // デフォルト値
                }
            }, (error) => {
                console.error(`Error loading settings for set ${i} from Firestore:`, error);
                showCustomAlert(`設定の読み込みに失敗しました。\nエラー: ${error.message}`);
            });


            // ログデータをFirebaseからリアルタイムで読み込み・同期
            // logs/{setId}/entries のサブコレクションを監視
            const logsQuery = query(
                collection(db, `logs/${i}/entries`),
                orderBy("timestamp", "desc"), // タイムスタンプで降順にソート
                limit(MAX_LOG_ENTRIES) // 最新の15件のみ取得
            );

            onSnapshot(logsQuery, (snapshot) => {
                // テーブルを一度クリア
                while (logDisplayTableBody.firstChild) {
                    logDisplayTableBody.removeChild(logDisplayTableBody.firstChild);
                }
                let lastLoggedDate = null;
                snapshot.forEach((doc) => {
                    const logData = doc.data();
                    // Firebaseに保存したdatetimeフィールドから日付部分を抽出
                    const currentDate = logData.datetime.substring(0, 5); // "MM/DD"形式を想定
                    const needsSeparator = lastLoggedDate && lastLoggedDate !== currentDate;
                    addLogToTable(logData, logDisplayTableBody, needsSeparator);
                    lastLoggedDate = currentDate;
                });
            }, (error) => {
                console.error(`Error loading logs for set ${i} from Firestore:`, error);
                showCustomAlert(`ログの読み込みに失敗しました。\nエラー: ${error.message}`);
            });

            // タイマーの残り時間をFirebaseから読み込み・同期
            onSnapshot(doc(db, `timer_states/${i}`), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const remainingSeconds = data.remainingSeconds || 0;
                    const isActive = data.isActive || false;

                    if (isActive && remainingSeconds > 0) {
                        // アクティブなタイマーがあれば再開
                        if (!timerIntervals[currentTimerId]) { // 既に動いていなければ
                            let currentTotalSeconds = remainingSeconds;
                            timerIntervals[currentTimerId] = setInterval(() => {
                                currentTotalSeconds--;
                                updateCountdown(currentTimerId, currentTotalSeconds, timerDisplay, i, titleInput);
                            }, 1000);
                        }
                    } else if (remainingSeconds === 0 && timerIntervals[currentTimerId]) {
                        // タイマーが終了したか、別デバイスで停止された場合
                        clearInterval(timerIntervals[currentTimerId]);
                        delete timerIntervals[currentTimerId];
                        timerDisplay.textContent = '00:00';
                    } else if (!isActive && timerIntervals[currentTimerId]) {
                        // 別デバイスでタイマーが停止された場合
                        clearInterval(timerIntervals[currentTimerId]);
                        delete timerIntervals[currentTimerId];
                        timerDisplay.textContent = `${String(parseInt(timerMinutesInput.value)).padStart(2, '0')}:00`;
                    }
                } else {
                    timerDisplay.textContent = `${String(parseInt(timerMinutesInput.value)).padStart(2, '0')}:00`;
                }
            }, (error) => {
                console.error(`Error loading timer state for set ${i} from Firestore:`, error);
            });


            // 以下、イベントリスナーの追加
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

            // タイトル入力時の処理をFirebaseに保存するように変更
            if (titleInput) {
                titleInput.addEventListener('input', () => {
                    // Firebaseにタイトルを保存
                    setDoc(doc(db, `settings/${i}`), { title: titleInput.value }, { merge: true }).catch(e => {
                        console.error(`Error saving title for set ${i} to Firestore:`, e);
                        showCustomAlert("タイトルの保存に失敗しました。\nネットワーク接続をご確認ください。");
                    });
                });
            }

            // コメント入力時の処理をFirebaseに保存するように変更
            if (commentInput) {
                commentInput.addEventListener('input', () => {
                    // Firebaseにコメントを保存
                    setDoc(doc(db, `settings/${i}`), { comment: commentInput.value }, { merge: true }).catch(e => {
                        console.error(`Error saving comment for set ${i} to Firestore:`, e);
                        showCustomAlert("コメントの保存に失敗しました。\nネットワーク接続をご確認ください。");
                    });
                });
            }

            // ログ記録ボタンのイベントリスナー (日時入力欄の処理を削除)
            if (logButton && xCoordInput && yCoordInput && logDisplayTableBody) {
                logButton.addEventListener('click', async () => {
                    console.log(`Log button clicked for set ${i}`);
                    try {
                        const x = xCoordInput.value;
                        const y = yCoordInput.value;
                        
                        if (x === '' || y === '') {
                            showCustomAlert('XとYの両方を入力してください。');
                            return;
                        }

                        // 現在時刻を自動で取得して日時とする
                        const now = new Date();
                        const month = String(now.getMonth() + 1).padStart(2, '0');
                        const day = String(now.getDate()).padStart(2, '0');
                        const hours = String(now.getHours()).padStart(2, '0');
                        const minutes = String(now.getMinutes()).padStart(2, '0');
                        const datetimeStr = `${month}/${day} ${hours}:${minutes}`;
                        const timestampVal = now.getTime();

                        const logData = {
                            datetime: datetimeStr,
                            x: x,
                            y: y,
                            timestamp: timestampVal
                        };

                        // Firebaseにログを追加
                        await addDoc(collection(db, `logs/${i}/entries`), logData);
                        console.log(`Log added to Firestore for set ${i}:`, logData);

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
                        // タイマーの開始もFirebaseの状態として記録
                        setDoc(doc(db, `timer_states/${i}`), { 
                            remainingSeconds: minutes * 60, 
                            isActive: true,
                            initialMinutes: minutes, // 初期設定値も保存
                            startTime: new Date().getTime() // 開始時刻
                        }).catch(e => console.error("Error starting timer in Firestore:", e));
                        
                        // このデバイスでもタイマーを開始
                        startTimer(currentTimerId, minutes * 60, timerDisplay, i, titleInput);
                    } catch (e) {
                        console.error(`Error in timer start button click handler for set ${i}:`, e);
                        showCustomAlert(`タイマー開始中に予期せぬエラーが発生しました:\\n${e.message}`);
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