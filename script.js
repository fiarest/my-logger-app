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
     * ブラウザの通知許可をリクエストする関数
     */
    function requestNotificationPermission() {
        if (!("Notification" in window)) {
            console.warn("このブラウザは通知に対応していません。");
            return;
        }
        if (Notification.permission === "granted") {
            console.log("通知はすでに許可されています。");
            return;
        }
        if (Notification.permission === "denied") {
            console.warn("通知が拒否されています。ブラウザ設定から変更してください。");
            showCustomAlert("ブラウザ通知が拒否されています。\nブラウザの設定から通知を許可してください。");
            return;
        }

        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("通知が許可されました。");
            } else {
                console.warn("通知が拒否されました。");
                showCustomAlert("通知の許可がされませんでした。\nタイマー終了時に通知を表示できません。");
            }
        }).catch(error => {
            console.error("通知許可のリクエスト中にエラーが発生しました:", error);
            showCustomAlert("通知許可のリクエスト中にエラーが発生しました。\n" + error.message);
        });
    }

    // ページロード時に通知許可を求める (またはボタンクリック時など、ユーザーの操作に応じて)
    // 初回アクセス時に自動で許可を求めるとユーザーに嫌がられる可能性があるので、
    // ここではページロード時に自動でリクエストするようになっています。
    // 必要に応じて、例えば「通知を有効にする」ボタンを押したときにこの関数を呼び出すように変更できます。
    requestNotificationPermission();


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
            
            // タイマー終了時のアラートと通知
            const title = titleInput.value.trim();
            const message = title ? `${title}のタイマーが終了しました！` : `セット${setId + 1}のタイマーが終了しました！`;
            
            showCustomAlert(message); // カスタムアラート表示

            // ブラウザ通知を表示
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("タイマー終了", {
                    body: message,
                    icon: '/path/to/your/icon.png' // 通知に表示するアイコンのパス (任意、相対パスでOK)
                });
            }

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
                            showCustomAlert(message); // カスタムアラート表示

                            // ブラウザ通知を表示
                            if ("Notification" in window && Notification.permission === "granted") {
                                new Notification("タイマー終了", {
                                    body: message,
                                    // icon: '/path/to/your/icon.png' // 通知に表示するアイコンのパス (任意、ウェブサイトのルートからの相対パスで指定)
                                });
                            }

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
                
                // 日付が変わる場合にセパレータ行を挿入
                if (addSeparator) {
                    const separatorRow = document.createElement('tr');
                    const separatorCell = separatorRow.insertCell(0);
                    separatorCell.colSpan = 3;
                    separatorCell.className = 'log-entry-date-separator';
                    tableBodyElement.prepend(separatorRow); // セパレータはログ行の前に挿入
                }

                tableBodyElement.prepend(row); // 最新のログを上に追加
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
            
            // タイマー分数入力時の処理をFirebaseに保存するように変更
            if (timerMinutesInput) {
                timerMinutesInput.addEventListener('input', () => {
                    const minutes = parseInt(timerMinutesInput.value);
                    // 1分未満の無効な入力でない場合のみ保存
                    if (!isNaN(minutes) && minutes > 0) {
                         setDoc(doc(db, `settings/${i}`), { timerMinutes: minutes }, { merge: true }).catch(e => {
                            console.error(`Error saving timer minutes for set ${i} to Firestore:`, e);
                            showCustomAlert("タイマー設定の保存に失敗しました。\nネットワーク接続をご確認ください。");
                        });
                    }
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
                        const timestampVal = now.getTime(); // ソート用にミリ秒単位のUnixタイムスタンプ

                        const logData = {
                            datetime: datetimeStr, // 表示用 (例: "MM/DD HH:MM")
                            x: x,
                            y: y,
                            timestamp: timestampVal // ソート用
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
                        
                    } catch (e) {
                        console.error(`Error in timer start button click handler for set ${i}:`, e);
                        showCustomAlert(`タイマー開始中に予期せぬエラーが発生しました:\\n${e.message}`);
                    }
                });
                console.log(`Timer start button event listener attached for set ${i}.`);
            } else {
                console.warn(`Timer start button event listener NOT attached for set ${i} due to missing elements.`);
            }

            // タイマーリセットボタンのイベントリスナーを追加
            if (timerResetBtn && timerDisplay && timerMinutesInput) {
                timerResetBtn.addEventListener('click', () => {
                    const initialMinutes = parseInt(timerMinutesInput.value) || 5; // 初期値を取得
                    resetTimer(currentTimerId, timerDisplay, i, initialMinutes);
                });
                console.log(`Timer reset button event listener attached for set ${i}.`);
            }

            // 表のセル編集機能のセットアップ
            logDisplayTableBody.addEventListener('click', async (event) => {
                const cell = event.target;
                // 日付セルや既に編集中のセル、空白のセルは編集しない
                if (!cell.classList.contains('editable-cell') || cell.querySelector('input') || cell.textContent === 'ログはありません。') {
                    return;
                }

                const originalText = cell.textContent;
                const row = cell.closest('tr');
                if (!row) return; // 行が見つからなければ何もしない

                const docId = row.dataset.docId; // ドキュメントID
                const currentSetId = parseInt(row.dataset.setId); // セットID
                const fieldToUpdate = cell.dataset.field; // 'x' or 'y'

                if (!docId || isNaN(currentSetId) || !fieldToUpdate) {
                    console.error("Missing data-docId, data-setId, or data-field for cell edit.");
                    return;
                }

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
                const saveEdit = async () => {
                    let newValue = input.value.trim();
                    if (newValue === originalText) { // 変更がなければ何もしない
                        cell.textContent = originalText;
                        return;
                    }

                    try {
                        // Firebaseのドキュメントを更新
                        const logRef = doc(db, `logs/${currentSetId}/entries`, docId);
                        await updateDoc(logRef, { [fieldToUpdate]: newValue });
                        console.log(`Updated log ${fieldToUpdate} for doc ${docId} in set ${currentSetId}`);
                        cell.textContent = newValue; // UIを更新
                    } catch (e) {
                        console.error(`Error updating log ${fieldToUpdate} for set ${currentSetId} in Firestore:`, e);
                        showCustomAlert(`ログの更新に失敗しました。\nエラー: ${e.message}`);
                        cell.textContent = originalText; // エラー時は元に戻す
                    }
                };

                // Enterキーで保存
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        saveEdit();
                        input.blur(); // フォーカスを外してblurイベントもトリガー
                    }
                });

                // フォーカスが外れたら保存
                input.addEventListener('blur', saveEdit);
            });


        } catch (error) {
            console.error(`Critical error initializing input set ${i}:`, error);
        }
    }
});