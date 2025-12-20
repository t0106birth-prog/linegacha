document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const treasureBox = document.getElementById('treasureBox');
    const spinBtn = document.getElementById('spinBtn');
    const serialInput = document.getElementById('serialCode');
    const flashOverlay = document.getElementById('flashOverlay');
    const resultModal = document.getElementById('resultModal');
    const resultContent = document.getElementById('resultContent');
    const closeBtn = document.getElementById('closeBtn');

    // State
    const ASSETS = {
        boxClosed: 'assets/box_closed.png',
        boxOpen: 'assets/box_open.png',
        winEffect: 'assets/win_effect.png'
    };

    // -----------------------------------------------------------------
    // ★ IMPORTANT: 設定エリア
    // -----------------------------------------------------------------
    // 1. LINE Developersで発行したLIFF IDを入力してください
    const MY_LIFF_ID = '2006502233-yq0x2pDd';

    // 1. Google Apps Scriptをデプロイして発行されたURLをここに貼り付けてください。
    const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxL-jhXdS5SEjOSFJbPhw1h9pnAWQ0Q0XzIdjx5hXD4OgS0uAA2xvSCCNzxwmIrTRlcfA/exec'; 

    // 3. 本番通信を行う場合は false に、デモ（テスト）の場合は true にしてください。
    const USE_MOCK_BACKEND = false;
    // -----------------------------------------------------------------

    let currentUserId = 'anonymous';
    let currentUserName = 'Guest';

    // LIFFの初期化
    async function initializeLiff() {
        try {
            await liff.init({ liffId: MY_LIFF_ID });
            if (liff.isLoggedIn()) {
                const profile = await liff.getProfile();
                currentUserId = profile.userId;
                currentUserName = profile.displayName;
                console.log('LIFF Initialized. User:', currentUserName, '(', currentUserId, ')');
            } else {
                // 自動ログイン
                liff.login();
            }
        } catch (err) {
            console.error('LIFF Initialization failed', err);
        }
    }

    if (!USE_MOCK_BACKEND) {
        initializeLiff();
    }

    spinBtn.addEventListener('click', async () => {
        // ボタンが「CLOSE」モードならLIFFを閉じる
        if (spinBtn.textContent === 'CLOSE') {
            if (liff.isInClient()) {
                liff.closeWindow();
            } else {
                alert('ブラウザ版のため閉じません（本番のLINE内では閉じます）');
            }
            return;
        }

        const code = serialInput.value.trim();
        if (!code) {
            alert('シリアルコードを入力してください');
            return;
        }

        // Lock UI
        spinBtn.disabled = true;
        serialInput.disabled = true;

        // Start Animation (Shake)
        treasureBox.classList.add('shaking');

        try {
            // Call Backend
            let result;
            if (USE_MOCK_BACKEND) {
                console.log("現在デモモードで動作中...");
                result = await mockBackend(code);
            } else {
                if (!GAS_API_URL) {
                    throw new Error('API URLが設定されていません。script.jsを確認してください。');
                }
                // userIdとuserNameをパラメータに追加
                const response = await fetch(`${GAS_API_URL}?code=${code}&userId=${currentUserId}&userName=${encodeURIComponent(currentUserName)}`);
                result = await response.json();
                if (result.error) {
                    throw new Error(result.error);
                }
            }

            // Artificial delay for suspense (reduced for faster response)
            await new Promise(r => setTimeout(r, 500));

            // Stop Shake
            treasureBox.classList.remove('shaking');

            // Flash Effect
            flashOverlay.classList.add('flashing');

            // Switch to Open Box immediately after flash starts
            setTimeout(() => {
                treasureBox.src = ASSETS.boxOpen;
            }, 250); // halfway through flash fade in

            // Show Result after flash peaks
            setTimeout(() => {
                showResult(result);
                flashOverlay.classList.remove('flashing');

                // ★ メインボタンを「CLOSE」に切り替え、有効化する
                spinBtn.textContent = 'CLOSE';
                spinBtn.disabled = false;
            }, 600);

        } catch (error) {
            console.error(error);
            alert('エラーが発生しました: ' + error.message);
            resetUI();
            treasureBox.classList.remove('shaking'); // Ensure shaking stops on error
        }
    });

    closeBtn.addEventListener('click', () => {
        resetUI();
    });

    function showResult(data) {
        resultContent.innerHTML = '';

        if (data.status === 'win') {
            // SSR Result
            const img = document.createElement('img');
            img.src = ASSETS.winEffect;
            img.className = 'result-image';
            resultContent.appendChild(img);

            const text = document.createElement('div');
            text.className = 'result-text';
            text.textContent = 'SSR 獲得！';
            resultContent.appendChild(text);

            const details = document.createElement('p');
            details.textContent = data.prizeName || '高級シャンパン';
            details.style.color = '#fff';
            details.style.marginTop = '10px';
            resultContent.appendChild(details);

        } else {
            // Point Result (Lose)
            const pts = data.pointsAdded || 1;
            const current = data.currentPoints || 10;
            const target = data.targetPoints || 50;
            const percent = Math.min((current / target) * 100, 100);

            const title = document.createElement('div');
            title.className = 'result-text';
            title.textContent = `${pts}pt GET!`;
            resultContent.appendChild(title);

            const gaugeContainer = document.createElement('div');
            gaugeContainer.className = 'points-gauge-container';
            const fill = document.createElement('div');
            fill.className = 'points-gauge-fill';
            fill.style.width = '0%'; // Animate later
            gaugeContainer.appendChild(fill);
            resultContent.appendChild(gaugeContainer);

            const sub = document.createElement('p');
            sub.className = 'points-text';
            sub.textContent = `スタバチケットまであと ${target - current}pt`;
            resultContent.appendChild(sub);

            // Animate gauge
            setTimeout(() => {
                fill.style.width = `${percent}%`;
            }, 100);
        }

        resultModal.classList.remove('hidden');
        closeBtn.classList.remove('hidden');
        closeBtn.textContent = 'CLOSE'; // モーダル内のボタンもシンプルな表示に
    }

    function resetUI() {
        // Reset Box
        treasureBox.src = ASSETS.boxClosed;

        // Hide Modal
        resultModal.classList.add('hidden');

        // Enable Controls
        spinBtn.disabled = false;
        spinBtn.textContent = 'OPEN'; // 表示を戻す
        serialInput.disabled = false;
        serialInput.value = '';
    }

    // Mock Backend for Logic Verification
    async function mockBackend(code) {
        // Simulate network delay
        await new Promise(r => setTimeout(r, 1000));

        // Check "Mock" logic
        if (code === 'SSR') {
            return {
                status: 'win',
                prizeName: 'アルマンド・ゴールド'
            };
        } else if (code.startsWith('TEST')) {
            return {
                status: 'lose',
                pointsAdded: 1,
                currentPoints: Math.floor(Math.random() * 40),
                targetPoints: 50
            };
        } else {
            // Default: Make it error to allow user to understand it's a mock
            throw new Error('デモモード: 無効なシリアルコードです (テスト用コード: "SSR" または "TEST...")');
        }
    }
});
