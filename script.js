const container = document.getElementById('container');

// カスタムアラート表示
function showCustomAlert(message) {
    const overlay = document.getElementById('custom-alert-overlay');
    const msg = document.getElementById('custom-alert-message');
    msg.textContent = message;
    overlay.classList.remove('hidden');
}

document.getElementById('custom-alert-close-btn').addEventListener('click', () => {
    document.getElementById('custom-alert-overlay').classList.add('hidden');
});

// タイマー開始
function startTimer(minutes, endDisplay, remainingDisplay) {
    const endTime = new Date(Date.now() + minutes * 60000);
    endDisplay.textContent = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;

    const intervalId = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((endTime - now) / 60000);
        if (diff <= 0) {
            clearInterval(intervalId);
            remainingDisplay.textContent = '0';
        } else {
            remainingDisplay.textContent = diff.toString();
        }
    }, 1000);
}

function createInputSet() {
    const inputSet = document.createElement('div');
    inputSet.className = 'input-set';

    // タイトル欄
    const titleSection = document.createElement('div');
    titleSection.className = 'title-section';
    titleSection.innerHTML = `<input type="text" placeholder="タイトルを入力">`;
    inputSet.appendChild(titleSection);

    // タイマー
    const timerContainer = document.createElement('div');
    timerContainer.className = 'timer-container';
    timerContainer.innerHTML = `
        <div class="timer-input-and-button">
            <input type="number" class="timer-input" placeholder="分">
            <button class="timer-button">開始</button>
        </div>
        <div class="timer-info-displays">
            <div class="timer-end-time-display">--:--</div>
            <div class="timer-remaining-minutes-display">--</div>
        </div>
    `;
    inputSet.appendChild(timerContainer);

    // 座標入力欄
    const coordLogContainer = document.createElement('div');
    coordLogContainer.className = 'coord-log-container';
    coordLogContainer.innerHTML = `
        <div class="coord-inputs">
            <div><label>X</label><input type="number" class="coord-x"></div>
            <div><label>Y</label><input type="number" class="coord-y"></div>
        </div>
        <button class="log-btn">記録</button>
    `;
    inputSet.appendChild(coordLogContainer);

    // コメント欄
    const commentSection = document.createElement('div');
    commentSection.className = 'comment-section';
    commentSection.innerHTML = `
        <textarea class="comment-input" placeholder="コメントを入力"></textarea>
    `;
    inputSet.appendChild(commentSection);

    // 表
    const logDisplay = document.createElement('div');
    logDisplay.className = 'log-display';
    logDisplay.innerHTML = `
        <table class="log-table">
            <thead>
                <tr><th>時刻</th><th>X</th><th>Y</th></tr>
            </thead>
            <tbody></tbody>
        </table>
    `;
    inputSet.appendChild(logDisplay);

    container.appendChild(inputSet);

    // イベント設定
    const startBtn = inputSet.querySelector('.timer-button');
    const minuteInput = inputSet.querySelector('.timer-input');
    const endDisplay = inputSet.querySelector('.timer-end-time-display');
    const remainingDisplay = inputSet.querySelector('.timer-remaining-minutes-display');

    startBtn.addEventListener('click', () => {
        const minutes = parseInt(minuteInput.value);
        if (isNaN(minutes) || minutes <= 0) {
            showCustomAlert("正しい時間（分）を入力してください。");
            return;
        }
        startTimer(minutes, endDisplay, remainingDisplay);
    });

    const logBtn = inputSet.querySelector('.log-btn');
    const xInput = inputSet.querySelector('.coord-x');
    const yInput = inputSet.querySelector('.coord-y');
    const logTable = inputSet.querySelector('.log-table tbody');

    logBtn.addEventListener('click', () => {
        const x = xInput.value.trim();
        const y = yInput.value.trim();
        if (x === '' || y === '') {
            showCustomAlert("XとYの座標を入力してください。");
            return;
        }

        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const row = document.createElement('tr');
        row.innerHTML = `<td>${time}</td><td>${x}</td><td>${y}</td>`;
        logTable.appendChild(row);

        // Firestoreに保存する場合（オプション）
        if (window.db) {
            const title = inputSet.querySelector('.title-section input').value.trim();
            const comment = inputSet.querySelector('.comment-input').value.trim();
            const docData = {
                timestamp: now,
                title,
                x: Number(x),
                y: Number(y),
                comment
            };

            import { collection, addDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
            const logsRef = collection(window.db, "coordinateLogs");
            addDoc(logsRef, docData).catch((error) => {
                console.error("Firestore書き込みエラー:", error);
                showCustomAlert("Firestoreへの保存に失敗しました。");
            });
        }

        xInput.value = '';
        yInput.value = '';
    });
}

// 初期に1つ生成（必要に応じて複数対応可）
createInputSet();
