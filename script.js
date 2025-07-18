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
    addDoc,
    updateDoc // ドキュメント更新用にインポート
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
            delete timerIntervals[timerId]; // clearInterval後にtimerIntervalsから削除
            displayElement.textContent = '00:00';
            // タイマー終了時にFirebaseの状態を更新 ( isActiveをfalseに )
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

        // Firebaseへの残り時間の更新は、onSnapshotハンドラで行うため、ここでは行わない
        // setDoc(doc(db, `timer_states/${setId}`), { remainingSeconds: totalSeconds, isActive: true }, { merge: true }).catch(e => console.error("Error saving timer remaining to Firestore:", e));
    }

    /**
     * タイマーをリセットする関数
     * @param {string} timerId - タイマー要素のID
     * @param {HTMLElement} displayElement - タイマー表示のDOM要素
     * @param {number} setId - セットのインデックス
     * @param {number} initialMinutes - タイマーの初期設定分数 (Firestoreから取得)
     */
    function resetTimer(timerId, displayElement, setId, initialMinutes) {
        if (timerIntervals[timerId]) {
            clearInterval(timerIntervals[timerId]);
            delete timerIntervals[timerId];
        }
        const resetTime = `${String(initialMinutes).padStart(2, '0')}:00`;
        displayElement.textContent = resetTime;
        // Firebaseのタイマー状態をリセット
        setDoc(doc(db, `timer_states/${setId}`), { remainingSeconds: initialMinutes * 60, isActive: false, initialMinutes: initialMinutes, startTime: null }, { merge: true }).catch(e => console.error("Error resetting timer in Firestore:", e));
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
                        <button id="timer-start-btn-${i}" class="timer-button timer-start-btn">開始</button>
                        <button id="timer-reset-btn-${i}" class="timer-button timer-reset-btn">リセット</button>
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
                    <button id="log-btn-${i}" class="log-btn">記録</button>
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

            const timerMinutesInput = document.getElementById(`timer-minutes-${i}`);
            const timerStartBtn = document.getElementById(`timer-start-btn-${i}`);
            const timerResetBtn = document.getElementById(`timer-reset-btn-${i}`); // リセットボタン取得
            const timerDisplay = document.getElementById(`timer-display-${i}`);
            const currentTimerId = `timer-${i}`;

            if (!logButton) {
                console.error(`Error: logButton not found for set ${i}.`);
            }
            if (!timerStartBtn) {
                console.error(`Error: timerStartBtn not found for set ${i}.`);
            }
            if (!timerResetBtn) { // リセットボタンのチェックも追加
                console.error(`Error: timerResetBtn not found for set ${i}.`);
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
                let lastLoggedDate = null; // 日付区切り線の基準日
                snapshot.forEach((docSnap) => { // docSnapでドキュメント全体を取得
                    const logData = docSnap.data();
                    const logDocId = docSnap.id; // ドキュメントIDも取得 (更新用)

                    const logDate = new Date(logData.timestamp); // timestampを使う
                    const currentDateForSeparator = logDate.toLocaleDateString('ja-JP');

                    // 最初のログ行ではない、かつ、日付が変わった場合のみセパレータを追加
                    const needsSeparator = lastLoggedDate && lastLoggedDate !== currentDateForSeparator;
                    addLogToTable(logData, logDisplayTableBody, needsSeparator, logDocId, i); // docIdとsetIdを渡す
                    lastLoggedDate = currentDateForSeparator;
                });
                if (snapshot.empty) { // ログがない場合の表示
                    const row = logDisplayTableBody.insertRow(0);
                    const cell = row.insertCell(0);
                    cell.colSpan = 3;
                    cell.style.textAlign = 'center';
                    cell.textContent = 'ログはありません。';
                }
            }, (error) => {
                console.error(`Error loading logs for set ${i} from Firestore:`, error);
                showCustomAlert(`ログの読み込みに失敗しました。\nエラー: ${error.message}`);
            });

            // タイマーの残り時間をFirebaseから読み込み・同期
            onSnapshot(doc(db, `timer_states/${i}`), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const initialMinutes = data.initialMinutes || parseInt(timerMinutesInput.value) || 5;
                    const startTime = data.startTime; // nullまたはタイムスタンプ
                    const isActive = data.isActive || false;

                    if (timerIntervals[currentTimerId]) {
                        clearInterval(timerIntervals[currentTimerId]);
                        delete timerIntervals[currentTimerId];
                    }

                    if (isActive && startTime) {
                        // 開始時刻から現在までの経過時間を計算
                        const elapsedTime = (new Date().getTime() - startTime) / 1000;
                        let currentTotalSeconds = Math.max(0, (initialMinutes * 60) - Math.round(elapsedTime));

                        if (currentTotalSeconds <= 0) {
                            timerDisplay.textContent = '00:00';
                            // 終了をFirestoreに反映
                            setDoc(doc(db, `timer_states/${i}`), { remainingSeconds: 0, isActive: false, startTime: null }, { merge: true });
                            const title = titleInput.value.trim();
                            const message = title ? `${title}のタイマーが終了しました！` : `セット${i + 1}のタイマーが終了しました！`;
                            showCustomAlert(message);
                        } else {
                            // タイマーを再開/同期
                            updateCountdown(currentTimerId, currentTotalSeconds, timerDisplay, i, titleInput);
                            timerIntervals[currentTimerId] = setInterval(() => {
                                // 毎回正確な残り時間を計算し直す
                                const newElapsedTime = (new Date().getTime() - startTime) / 1000;
                                let newTotalSeconds = Math.max(0, (initialMinutes * 60) - Math.round(newElapsedTime));
                                updateCountdown(currentTimerId, newTotalSeconds, timerDisplay, i, titleInput);
                            }, 1000);
                        }
                    } else { // isActiveがfalseの場合、またはstartTimeがない場合 (リセット状態など)
                        const minutes = Math.floor((data.remainingSeconds || initialMinutes * 60) / 60);
                        const seconds = (data.remainingSeconds || initialMinutes * 60) % 60;
                        timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                    }
                } else {
                    // ドキュメントが存在しない場合はデフォルトの表示
                    timerDisplay.textContent = `${String(parseInt(timerMinutesInput.value)).padStart(2, '0')}:00`;
                }
            }, (error) => {
                console.error(`Error loading timer state for set ${i} from Firestore:`, error);
                showCustomAlert(`タイマー状態の読み込みに失敗しました。\nエラー: ${error.message}`);
            });


            // 以下、イベントリスナーの追加
            function addLogToTable(logData, tableBodyElement, addSeparator = false, docId, setId) {
                const row = document.createElement('tr');
                // ドキュメントIDをデータ属性として保持し、編集時に利用
                row.dataset.docId = docId; 
                row.dataset.setId = setId; // セットIDも保持

                // 日時の表示形式を mm/dd hh:mm に変更
                const date = new Date(logData.timestamp);
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const formattedDateTime = `${month}/${day} ${hours}:${minutes}`;

                row.innerHTML = `
                    <td>${formattedDateTime}</td>
                    <td class="editable-cell" data-field="x" style="text-align: center;">${logData.x !== undefined ? logData.x : ''}</td>
                    <td class="editable-cell" data-field="y" style="text-align: center;">${logData.y !== undefined ? logData.y : ''}</td>
                `;