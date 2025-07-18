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
    // 各タイマーの通知/アラートが一度表示されたか追跡するフラグ
    // キーはセットID (0-4), 値はboolean (true: 表示済み, false: 未表示)
    const timerNotifiedStatus = {}; 
    console.log("DOM Content Loaded. Initializing app.");

    // カスタムアラート要素の取得
    const customAlertOverlay = document.getElementById('custom-alert-overlay');
    const customAlertBox = document.getElementById('custom-alert-box');
    const customAlertMessage = document.getElementById('custom-alert-message');
    const customAlertCloseBtn = document.getElementById('custom-alert-close-btn');
    
    // 新しく追加した通知有効化ボタンの要素を取得
    const enableNotificationsBtn = document.getElementById('enable-notifications-btn');

    // Firebase Firestore のインスタンスを取得
    const db = window.db; 
    if (!db) {
        console.error("Firebase Firestore is not initialized. Make sure Firebase SDK is loaded correctly in index.html.");
        // ここでの改行コードを \n に修正
        showCustomAlert("データの同期機能が利用できません。\nブラウザのコンソールをご確認ください。");
        return; 
    }

    /**
     * カスタムアラートを表示する関数
     * @param {string} message - 表示するメッセージ
     */
    function showCustomAlert(message) {
        console.log("showCustomAlert called with message:", message); // デバッグログ
        customAlertMessage.textContent = message;
        customAlertOverlay.classList.remove('hidden'); // 非表示クラスを削除して表示
        console.log("Custom alert overlay hidden class after showCustomAlert:", customAlertOverlay.classList.contains('hidden') ? 'hidden' : 'visible'); // デバッグログ
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
        console.log("closeCustomAlert called."); // デバッグログ
        customAlertOverlay.classList.add('hidden'); // 非表示クラスを追加して非表示
        console.log("Custom alert overlay hidden class after closeCustomAlert:", customAlertOverlay.classList.contains('hidden') ? 'hidden' : 'visible'); // デバッグログ
        // イベントリスナーを削除（重複して追加されないように）
        customAlertOverlay.removeEventListener('click', closeCustomAlert);
        customAlertCloseBtn.removeEventListener('click', closeCustomAlert);
        customAlertBox.removeEventListener('click', (e) => e.stopPropagation());
    }

    /**
     * ブラウザの通知許可をリクエストする関数
     */
    function requestNotificationPermission() {
        console.log("requestNotificationPermission called."); // デバッグログ
        if (!("Notification" in window)) {
            console.warn("このブラウザは通知に対応していません。");
            return;
        }
        // すでに許可されているか拒否されている場合は処理を終える
        if (Notification.permission === "granted") {
            console.log("通知はすでに許可されています。");
            showCustomAlert("通知はすでに許可されています。");
            // ボタンを無効にするなどのUI変更
            if (enableNotificationsBtn) enableNotificationsBtn.disabled = true;
            return;
        }
        if (Notification.permission === "denied") {
            console.warn("通知が拒否されています。ブラウザ設定から変更してください。");
            // ここでの改行コードを \n に修正
            showCustomAlert("ブラウザ通知